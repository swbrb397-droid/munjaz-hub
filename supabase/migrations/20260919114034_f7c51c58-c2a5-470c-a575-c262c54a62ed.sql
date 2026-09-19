CREATE OR REPLACE FUNCTION public.has_verified_totp(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.mfa_factors
    WHERE user_id = _user_id
      AND factor_type = 'totp'
      AND status = 'verified'
  );
$$;

REVOKE ALL ON FUNCTION public.has_verified_totp(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_verified_totp(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_recent_mfa_verification(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT NOT public.has_verified_totp(_user_id)
    OR COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

REVOKE ALL ON FUNCTION public.has_recent_mfa_verification(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_recent_mfa_verification(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users update own wallet settings" ON public.wallets;
CREATE POLICY "Users update own wallet settings"
ON public.wallets
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND public.has_recent_mfa_verification(auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  AND public.has_recent_mfa_verification(auth.uid())
);

CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _network usdt_network, _address text)
RETURNS withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  uid uuid := auth.uid();
  amt numeric(18,6);
  fee numeric(18,6) := 0.8;
  prof RECORD;
  bal numeric(18,6);
  score numeric(5,2) := 0;
  flags jsonb := '[]'::jsonb;
  sla integer;
  st public.withdrawal_status;
  addr text;
  tx_id uuid;
  row_out public.withdrawal_requests;
  prior integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.has_recent_mfa_verification(uid) THEN RAISE EXCEPTION 'MFA_REQUIRED'; END IF;
  PERFORM public.check_rate_limit('withdrawal', 5, interval '1 hour');

  amt := round(_amount::numeric, 6);
  IF amt IS NULL OR amt <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  IF amt < 10 THEN RAISE EXCEPTION 'MIN_WITHDRAWAL_10'; END IF;

  addr := btrim(regexp_replace(coalesce(_address,''), '[^A-Za-z0-9]', '', 'g'));
  IF length(addr) < 26 OR length(addr) > 64 THEN RAISE EXCEPTION 'INVALID_ADDRESS'; END IF;

  SELECT * INTO prof FROM public.profiles WHERE id = uid;
  IF prof.is_frozen THEN
    INSERT INTO public.security_incidents (user_id, kind, severity, detail)
      VALUES (uid, 'frozen_account_attempt', 'high', 'Withdrawal attempted on frozen account');
    RAISE EXCEPTION 'ACCOUNT_FROZEN';
  END IF;

  SELECT available_usdt INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF bal IS NULL OR bal < amt + fee THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;

  IF NOT prof.is_verified THEN score := score + 25; flags := flags || jsonb_build_array('unverified_account'); END IF;
  IF prof.kyc_tier = 'tier0' THEN score := score + 20; flags := flags || jsonb_build_array('kyc_tier0'); END IF;
  IF prof.created_at > now() - interval '7 days' THEN score := score + 20; flags := flags || jsonb_build_array('new_account'); END IF;
  IF amt > bal * 0.9 THEN score := score + 15; flags := flags || jsonb_build_array('near_full_balance'); END IF;
  IF amt >= 5000 THEN score := score + 25; flags := flags || jsonb_build_array('large_amount'); END IF;
  SELECT count(*) INTO prior FROM public.withdrawal_requests
    WHERE user_id = uid AND created_at > now() - interval '24 hours';
  IF prior >= 2 THEN score := score + 15; flags := flags || jsonb_build_array('frequent_requests'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.withdrawal_requests WHERE user_id = uid AND address = addr AND status = 'paid') THEN
    score := score + 10; flags := flags || jsonb_build_array('new_payout_address');
  END IF;
  score := LEAST(score, 100);

  sla := CASE WHEN prof.account_tier IN ('pro','corporate') THEN 12 ELSE 48 END;
  IF score >= 50 THEN
    st := 'manual_review';
  ELSIF prof.account_tier IN ('pro','corporate') THEN
    st := 'auto_approved';
  ELSE
    st := 'queued';
  END IF;

  PERFORM set_config('munjaz.escrow','on', true);
  UPDATE public.wallets
    SET available_usdt = available_usdt - (amt + fee),
        locked_usdt = locked_usdt + (amt + fee)
    WHERE user_id = uid;

  INSERT INTO public.wallet_transactions (user_id, type, status, amount, fee, network, address, note)
    VALUES (uid, 'withdrawal', 'pending', -amt, fee, _network, addr, 'Withdrawal request')
    RETURNING id INTO tx_id;
  PERFORM set_config('munjaz.escrow','off', true);

  INSERT INTO public.withdrawal_requests
    (user_id, amount_usdt, fee_usdt, net_usdt, network, address, status, tier, sla_hours, process_by, risk_score, risk_flags, transaction_id)
  VALUES
    (uid, amt, fee, amt - fee, _network, addr, st, prof.account_tier, sla, now() + make_interval(hours => sla), score, flags, tx_id)
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$function$;