CREATE OR REPLACE FUNCTION public.unspent_deposit_balance(_user_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH t AS (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE type='deposit' AND status='confirmed'),0) AS dep,
      COALESCE(SUM(abs(amount)) FILTER (WHERE type='escrow_lock' AND status='confirmed'),0) AS spent,
      COALESCE(SUM(amount) FILTER (WHERE type='escrow_refund' AND status='confirmed'),0) AS refunded,
      COALESCE(SUM(abs(amount)) FILTER (WHERE type='withdrawal' AND status IN ('pending','confirmed')),0) AS withdrawn
    FROM public.wallet_transactions WHERE user_id = _user_id
  )
  SELECT GREATEST(LEAST(dep - spent + refunded - withdrawn,
    COALESCE((SELECT available_usdt FROM public.wallets WHERE user_id=_user_id),0)), 0) FROM t;
$$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _network usdt_network, _address text)
 RETURNS withdrawal_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  uid uuid := auth.uid(); amt numeric(18,6); fee numeric(18,6); dep_part numeric(18,6);
  prof RECORD; bal numeric(18,6); score numeric(5,2) := 0; flags jsonb := '[]'::jsonb;
  sla integer; st public.withdrawal_status; addr text; tx_id uuid; row_out public.withdrawal_requests; prior integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT private.has_verified_totp(uid) THEN RAISE EXCEPTION 'MFA_VERIFICATION_MANDATORY'; END IF;
  IF COALESCE(auth.jwt() ->> 'aal','aal1') <> 'aal2' THEN RAISE EXCEPTION 'MFA_REQUIRED'; END IF;
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
  dep_part := LEAST(amt, public.unspent_deposit_balance(uid));
  fee := round(0.8 + dep_part * 0.05, 6);
  IF dep_part > 0 THEN flags := flags || jsonb_build_array('anti_mixing_fee'); END IF;
  IF bal IS NULL OR bal < amt + fee THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;

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

  PERFORM set_config('munjaz.escrow','on', true);
  UPDATE public.wallets SET available_usdt = available_usdt - (amt + fee), locked_usdt = locked_usdt + (amt + fee) WHERE user_id = uid;
  INSERT INTO public.wallet_transactions (user_id, type, status, amount, fee, network, address, note)
    VALUES (uid, 'withdrawal', 'pending', -amt, fee, _network, addr, 'Withdrawal request') RETURNING id INTO tx_id;
  PERFORM set_config('munjaz.escrow','off', true);

  INSERT INTO public.withdrawal_requests
    (user_id, amount_usdt, fee_usdt, net_usdt, network, address, status, tier, sla_hours, process_by, risk_score, risk_flags, transaction_id)
  VALUES (uid, amt, fee, amt - fee, _network, addr, st, prof.account_tier, sla, now() + make_interval(hours => sla), score, flags, tx_id)
  RETURNING * INTO row_out;
  RETURN row_out;
END; $function$;

CREATE OR REPLACE FUNCTION public.purchase_digital_asset_instant(p_listing_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); l RECORD; bal numeric(18,6); oid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO l FROM public.listings WHERE id = p_listing_id AND is_published;
  IF l.id IS NULL OR l.owner_id IS NULL THEN RAISE EXCEPTION 'LISTING_UNAVAILABLE'; END IF;
  IF l.category = 'freelance' THEN RAISE EXCEPTION 'NOT_INSTANT'; END IF;
  IF l.owner_id = uid THEN RAISE EXCEPTION 'OWN_LISTING'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND is_frozen) THEN RAISE EXCEPTION 'ACCOUNT_FROZEN'; END IF;
  SELECT available_usdt INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF bal IS NULL OR bal < l.price_usdt THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;

  INSERT INTO public.orders (buyer_id, seller_id, listing_id, title, category, sow_terms, amount_usdt, delivery_days, status)
  VALUES (uid, l.owner_id, l.id, l.title_ar, l.category::text, '', l.price_usdt, 0, 'pending') RETURNING id INTO oid;
  UPDATE public.orders SET status = 'in_progress' WHERE id = oid;  -- trigger locks funds
  UPDATE public.orders SET status = 'completed' WHERE id = oid;    -- trigger pays seller + referrals
  RETURN oid;
END; $$;
REVOKE EXECUTE ON FUNCTION public.purchase_digital_asset_instant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_digital_asset_instant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.attach_referral_after_oauth(p_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); inviter uuid; prof RECORD;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  SELECT * INTO prof FROM public.profiles WHERE id = uid;
  IF prof.id IS NULL OR prof.referred_by IS NOT NULL OR prof.created_at < now() - interval '1 day' THEN RETURN false; END IF;
  SELECT id INTO inviter FROM public.profiles WHERE referral_code = upper(trim(coalesce(p_code,'')));
  IF inviter IS NULL OR inviter = uid THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = uid) THEN RETURN false; END IF;
  PERFORM set_config('munjaz.escrow','on', true);
  UPDATE public.profiles SET referred_by = inviter WHERE id = uid;
  PERFORM set_config('munjaz.escrow','off', true);
  INSERT INTO public.referrals (referrer_id, referred_id, commission_rate, starts_at, expires_at, is_active)
  VALUES (inviter, uid, 0.20, now(), now() + interval '12 months', true) ON CONFLICT (referred_id) DO NOTHING;
  RETURN true;
END; $$;
REVOKE EXECUTE ON FUNCTION public.attach_referral_after_oauth(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_referral_after_oauth(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE ref_code TEXT; inviter UUID; chosen TEXT; is_owner BOOLEAN; tries INT := 0;
BEGIN
  LOOP
    ref_code := 'MJ-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = ref_code) OR tries > 10;
    tries := tries + 1;
  END LOOP;
  SELECT p.id INTO inviter FROM public.profiles p WHERE p.referral_code = upper(trim(NEW.raw_user_meta_data->>'referral_code'));
  IF inviter IS NOT NULL AND inviter = NEW.id THEN inviter := NULL; END IF;
  chosen := lower(coalesce(NEW.raw_user_meta_data->>'role',''));
  IF chosen NOT IN ('buyer','seller','hybrid','corporate') THEN chosen := 'buyer'; END IF;
  is_owner := lower(coalesce(NEW.email,'')) IN ('swbrb397@gmail.com','ddjj68513@gmail.com');

  INSERT INTO public.profiles (id, display_name, avatar_url, referral_code, referred_by, terms_accepted_at, active_view)
  VALUES (NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name',''), NULLIF(NEW.raw_user_meta_data->>'full_name',''),
             NULLIF(NEW.raw_user_meta_data->>'name',''), split_part(NEW.email,'@',1)),
    NULLIF(NEW.raw_user_meta_data->>'avatar_url',''),
    ref_code, inviter,
    CASE WHEN (NEW.raw_user_meta_data->>'terms_accepted') = 'true' THEN now() ELSE NULL END,
    CASE WHEN chosen = 'seller' THEN 'seller' ELSE 'buyer' END);
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, chosen::public.app_role) ON CONFLICT DO NOTHING;
  IF chosen = 'hybrid' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer'), (NEW.id, 'seller') ON CONFLICT DO NOTHING;
  END IF;
  IF is_owner THEN INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING; END IF;
  IF inviter IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id, commission_rate, starts_at, expires_at, is_active)
    VALUES (inviter, NEW.id, 0.20, now(), now() + interval '12 months', true) ON CONFLICT (referred_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE lower(email) = 'swbrb397@gmail.com'
ON CONFLICT DO NOTHING;