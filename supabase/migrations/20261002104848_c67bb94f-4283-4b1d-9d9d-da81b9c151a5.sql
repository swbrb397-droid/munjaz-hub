ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS security_updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.stamp_profile_security()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.security_updated_at := NULL; RETURN NEW; END IF;
  NEW.security_updated_at := OLD.security_updated_at;
  IF NEW.password_last_changed_at IS DISTINCT FROM OLD.password_last_changed_at
     OR NEW.mfa_updated_at IS DISTINCT FROM OLD.mfa_updated_at THEN
    NEW.security_updated_at := now();
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS profiles_stamp_security ON public.profiles;
CREATE TRIGGER profiles_stamp_security BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.stamp_profile_security();

-- Single source of truth for the cooling-off window.
CREATE OR REPLACE FUNCTION public.withdrawal_cooldown_until(_user_id uuid DEFAULT auth.uid())
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN t > now() - interval '24 hours' THEN t + interval '24 hours' END
  FROM (SELECT GREATEST(
    (SELECT security_updated_at FROM public.profiles WHERE id = _user_id),
    (SELECT payout_address_updated_at FROM public.wallets WHERE user_id = _user_id),
    (SELECT max(updated_at) FROM auth.mfa_factors WHERE user_id = _user_id AND status = 'verified'
       AND created_at > (SELECT created_at FROM auth.users WHERE id = _user_id) + interval '1 hour'
       AND (SELECT count(*) FROM auth.mfa_factors f2 WHERE f2.user_id = _user_id) > 0
       AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.mfa_updated_at IS NOT NULL))
  ) AS t) s
  WHERE _user_id = auth.uid() OR public.has_role(auth.uid(), 'admin');
$$;
REVOKE EXECUTE ON FUNCTION public.withdrawal_cooldown_until(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.withdrawal_cooldown_until(uuid) TO authenticated;

-- Kill-switch
INSERT INTO public.platform_settings (key, value, description)
VALUES ('emergency_financial_halt', 'false', 'Global emergency financial kill-switch')
ON CONFLICT (key) DO NOTHING;

CREATE POLICY "Signed-in users read the financial halt flag" ON public.platform_settings
  FOR SELECT TO authenticated USING (key = 'emergency_financial_halt');

CREATE OR REPLACE FUNCTION public.financial_halt_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT value = 'true' FROM public.platform_settings WHERE key = 'emergency_financial_halt'), false);
$$;

CREATE OR REPLACE FUNCTION public.assert_financial_open()
RETURNS void LANGUAGE plpgsql STABLE SET search_path = public AS $$
BEGIN
  IF public.financial_halt_active() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SYSTEM_UNDER_EMERGENCY_MAINTENANCE',
      DETAIL = 'النظام المالي في وضع صيانة طارئة حالياً. جميع التحويلات معلقة مؤقتاً.';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.guard_financial_halt()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN PERFORM public.assert_financial_open(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS orders_financial_halt ON public.orders;
CREATE TRIGGER orders_financial_halt BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_financial_halt();
DROP TRIGGER IF EXISTS crypto_invoices_financial_halt ON public.crypto_invoices;
CREATE TRIGGER crypto_invoices_financial_halt BEFORE INSERT ON public.crypto_invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_financial_halt();
DROP TRIGGER IF EXISTS withdrawal_requests_financial_halt ON public.withdrawal_requests;
CREATE TRIGGER withdrawal_requests_financial_halt BEFORE INSERT ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_financial_halt();

CREATE OR REPLACE FUNCTION public.admin_set_financial_halt(p_on boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN RAISE EXCEPTION 'MFA_REQUIRED'; END IF;
  UPDATE public.platform_settings SET value = CASE WHEN p_on THEN 'true' ELSE 'false' END, updated_at = now()
    WHERE key = 'emergency_financial_halt';
  INSERT INTO public.audit_logs (admin_id, action_type, target_table, meta)
    VALUES (auth.uid(), CASE WHEN p_on THEN 'financial_halt_on' ELSE 'financial_halt_off' END, 'platform_settings',
            jsonb_build_object('emergency_financial_halt', p_on));
  RETURN p_on;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_financial_halt(boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_financial_halt(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.withdrawal_network_fee(_network usdt_network)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _network WHEN 'polygon' THEN 0.20 WHEN 'bep20' THEN 0.30 WHEN 'trc20' THEN 2.00 END::numeric;
$$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _network usdt_network, _address text)
 RETURNS withdrawal_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid(); amt numeric(18,6); fee numeric(18,6); net_fee numeric(18,6); dep_part numeric(18,6); net numeric(18,6);
  prof RECORD; bal numeric(18,6); score numeric(5,2) := 0; flags jsonb := '[]'::jsonb;
  sla integer; st public.withdrawal_status; addr text; tx_id uuid; row_out public.withdrawal_requests; prior integer;
BEGIN
  PERFORM public.assert_financial_open();
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT private.has_verified_totp(uid) THEN RAISE EXCEPTION 'MFA_VERIFICATION_MANDATORY'; END IF;
  IF COALESCE(auth.jwt() ->> 'aal','aal1') <> 'aal2' THEN RAISE EXCEPTION 'MFA_REQUIRED'; END IF;
  IF public.withdrawal_cooldown_until(uid) IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'WITHDRAWAL_LOCKED_SECURITY_COOLDOWN',
      DETAIL = 'تم تجميد السحب مؤقتاً لمدة 24 ساعة كإجراء احترازي لتحديث بيانات الأمان.';
  END IF;
  PERFORM public.check_rate_limit('withdrawal', 5, interval '1 hour');

  IF _network IS NULL THEN RAISE EXCEPTION 'INVALID_NETWORK'; END IF;
  net_fee := public.withdrawal_network_fee(_network);
  IF net_fee IS NULL THEN RAISE EXCEPTION 'INVALID_NETWORK'; END IF;

  amt := round(_amount::numeric, 6);
  IF amt IS NULL OR amt <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  addr := btrim(regexp_replace(coalesce(_address,''), '[^A-Za-z0-9]', '', 'g'));
  IF length(addr) < 26 OR length(addr) > 64 THEN RAISE EXCEPTION 'INVALID_ADDRESS'; END IF;

  SELECT * INTO prof FROM public.profiles WHERE id = uid;
  IF prof.is_frozen THEN
    INSERT INTO public.security_incidents (user_id, kind, severity, detail)
      VALUES (uid, 'frozen_account_attempt', 'high', 'Withdrawal attempted on frozen account');
    RAISE EXCEPTION 'ACCOUNT_FROZEN';
  END IF;

  SELECT available_usdt INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
  dep_part := GREATEST(0, LEAST(amt, amt - (COALESCE(bal,0) - public.unspent_deposit_balance(uid))));
  fee := round(net_fee + dep_part * 0.05, 6);
  IF dep_part > 0 THEN flags := flags || jsonb_build_array('anti_mixing_fee'); END IF;
  net := amt - fee;
  IF net < 10 THEN RAISE EXCEPTION 'MIN_NET_PAYOUT_10'; END IF;
  IF bal IS NULL OR bal < amt THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;

  IF NOT prof.is_verified THEN score := score + 25; flags := flags || jsonb_build_array('unverified_account'); END IF;
  IF prof.kyc_tier = 'tier0' THEN score := score + 20; flags := flags || jsonb_build_array('kyc_tier0'); END IF;
  IF prof.created_at > now() - interval '7 days' THEN score := score + 20; flags := flags || jsonb_build_array('new_account'); END IF;
  IF amt > bal * 0.9 THEN score := score + 15; flags := flags || jsonb_build_array('near_full_balance'); END IF;
  IF amt >= 5000 THEN score := score + 25; flags := flags || jsonb_build_array('large_amount'); END IF;
  SELECT count(*) INTO prior FROM public.withdrawal_requests WHERE user_id = uid AND created_at > now() - interval '24 hours';
  IF prior >= 2 THEN score := score + 15; flags := flags || jsonb_build_array('frequent_requests'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.withdrawal_requests WHERE user_id = uid AND address = addr AND status = 'paid') THEN
    score := score + 10; flags := flags || jsonb_build_array('new_payout_address');
  END IF;
  score := LEAST(score, 100);

  sla := CASE WHEN prof.account_tier IN ('pro','corporate') THEN 12 ELSE 48 END;
  IF score >= 50 THEN st := 'manual_review';
  ELSIF prof.account_tier IN ('pro','corporate') THEN st := 'auto_approved';
  ELSE st := 'queued'; END IF;

  -- Gross (amt) leaves available balance; amount_usdt + fee_usdt = amt so resolve_withdrawal stays consistent.
  PERFORM set_config('munjaz.escrow','on', true);
  UPDATE public.wallets SET available_usdt = available_usdt - amt, locked_usdt = locked_usdt + amt WHERE user_id = uid;
  INSERT INTO public.wallet_transactions (user_id, type, status, amount, fee, network, address, note)
    VALUES (uid, 'withdrawal', 'pending', -net, fee, _network, addr, 'Withdrawal request') RETURNING id INTO tx_id;
  PERFORM set_config('munjaz.escrow','off', true);

  INSERT INTO public.withdrawal_requests
    (user_id, amount_usdt, fee_usdt, net_usdt, network, address, status, tier, sla_hours, process_by, risk_score, risk_flags, transaction_id)
  VALUES (uid, net, fee, net, _network, addr, st, prof.account_tier, sla, now() + make_interval(hours => sla), score, flags, tx_id)
  RETURNING * INTO row_out;
  RETURN row_out;
END; $function$;