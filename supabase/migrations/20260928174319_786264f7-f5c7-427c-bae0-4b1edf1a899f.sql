ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_deactivated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_commission_rate_check;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_commission_rate_check CHECK (commission_rate >= 0 AND commission_rate <= 0.20);

-- Protect new columns from self-edit
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF coalesce(current_setting('munjaz.escrow', true), '') = 'on' THEN RETURN NEW; END IF;
  IF NOT public.has_role(auth.uid(),'admin') THEN
    NEW.kyc_tier := OLD.kyc_tier; NEW.is_verified := OLD.is_verified; NEW.kyc_status := OLD.kyc_status;
    NEW.xp_points := OLD.xp_points; NEW.level := OLD.level; NEW.rating := OLD.rating;
    NEW.completed_orders := OLD.completed_orders; NEW.referral_code := OLD.referral_code;
    NEW.referred_by := OLD.referred_by; NEW.account_tier := OLD.account_tier;
    NEW.is_frozen := OLD.is_frozen; NEW.frozen_reason := OLD.frozen_reason; NEW.frozen_at := OLD.frozen_at;
    NEW.is_deactivated := OLD.is_deactivated; NEW.deactivated_at := OLD.deactivated_at;
  END IF;
  RETURN NEW;
END; $function$;

-- Single-lifecycle referral lock
CREATE OR REPLACE FUNCTION public.lock_referral_links()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.referrer_id <> OLD.referrer_id OR NEW.referred_id <> OLD.referred_id
     OR NEW.starts_at <> OLD.starts_at OR NEW.expires_at > OLD.expires_at
     OR (NEW.is_active AND NOT OLD.is_active) THEN
    RAISE EXCEPTION 'REFERRAL_LOCKED';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_lock_referral_links ON public.referrals;
CREATE TRIGGER trg_lock_referral_links BEFORE UPDATE ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.lock_referral_links();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  ref_code TEXT; inviter UUID; chosen TEXT; is_owner BOOLEAN; tries INT := 0;
BEGIN
  LOOP
    ref_code := 'MJ-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = ref_code) OR tries > 10;
    tries := tries + 1;
  END LOOP;

  SELECT p.id INTO inviter FROM public.profiles p
    WHERE p.referral_code = upper(trim(NEW.raw_user_meta_data->>'referral_code'));
  IF inviter IS NOT NULL AND inviter = NEW.id THEN inviter := NULL; END IF;

  chosen := lower(coalesce(NEW.raw_user_meta_data->>'role',''));
  IF chosen NOT IN ('buyer','seller','hybrid','corporate') THEN chosen := 'buyer'; END IF;
  is_owner := lower(coalesce(NEW.email,'')) IN ('swbrb397@gmail.com','ddjj68513@gmail.com');

  INSERT INTO public.profiles (id, display_name, referral_code, referred_by, terms_accepted_at, active_view)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)), ref_code, inviter,
    CASE WHEN (NEW.raw_user_meta_data->>'terms_accepted') = 'true' THEN now() ELSE NULL END,
    CASE WHEN chosen = 'seller' THEN 'seller' ELSE 'buyer' END);

  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, chosen::public.app_role) ON CONFLICT DO NOTHING;
  IF chosen = 'hybrid' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer'), (NEW.id, 'seller') ON CONFLICT DO NOTHING;
  END IF;
  IF is_owner THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;

  IF inviter IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id, commission_rate, starts_at, expires_at, is_active)
    VALUES (inviter, NEW.id, 0.20, now(), now() + interval '12 months', true)
    ON CONFLICT (referred_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.pay_referral_commission(_referred uuid, _order_id uuid, _fee numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ref RECORD; joined timestamptz; rate numeric; comm numeric(18,6);
BEGIN
  IF _fee IS NULL OR _fee <= 0 THEN RETURN; END IF;
  SELECT * INTO ref FROM public.referrals r
    WHERE r.referred_id = _referred AND r.is_active AND now() <= r.expires_at;
  IF ref.id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.referral_commissions WHERE referral_id = ref.id AND order_id = _order_id) THEN RETURN; END IF;
  SELECT created_at INTO joined FROM public.profiles WHERE id = _referred;
  rate := CASE WHEN now() <= coalesce(joined, ref.starts_at) + interval '30 days' THEN 0.20 ELSE 0.10 END;
  comm := ROUND(_fee * rate, 6);
  IF comm <= 0 THEN RETURN; END IF;
  INSERT INTO public.referral_commissions (referral_id, referrer_id, order_id, platform_fee_usdt, commission_usdt)
    VALUES (ref.id, ref.referrer_id, _order_id, _fee, comm);
  UPDATE public.referrals SET total_earned_usdt = total_earned_usdt + comm WHERE id = ref.id;
  UPDATE public.wallets SET available_usdt = available_usdt + comm, lifetime_earned = lifetime_earned + comm WHERE user_id = ref.referrer_id;
  INSERT INTO public.wallet_transactions (user_id, type, status, amount, order_id, note)
    VALUES (ref.referrer_id, 'referral_payout', 'confirmed', comm, _order_id, 'Referral commission ' || (rate*100)::int || '%');
END; $$;
REVOKE ALL ON FUNCTION public.pay_referral_commission(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_order_escrow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  net_amount NUMERIC(18,6); fee NUMERIC(18,6); fee_pct NUMERIC(6,4); seller_tier account_tier;
  buyer_balance NUMERIC(18,6); g RECORD; hold_hours INTEGER;
BEGIN
  PERFORM set_config('munjaz.escrow', 'on', true);
  SELECT * INTO g FROM public.governance_settings WHERE id = 1;

  IF NEW.status = 'in_progress' AND NOT NEW.escrow_locked THEN
    SELECT available_usdt INTO buyer_balance FROM public.wallets WHERE user_id = NEW.buyer_id FOR UPDATE;
    IF buyer_balance IS NULL OR buyer_balance < NEW.amount_usdt THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;
    UPDATE public.wallets SET available_usdt = available_usdt - NEW.amount_usdt, locked_usdt = locked_usdt + NEW.amount_usdt
      WHERE user_id = NEW.buyer_id;
    NEW.escrow_locked := true;
    NEW.due_at := COALESCE(NEW.due_at, now() + make_interval(days => NEW.delivery_days));
    INSERT INTO public.wallet_transactions (user_id, type, status, amount, order_id, note)
      VALUES (NEW.buyer_id, 'escrow_lock', 'confirmed', -NEW.amount_usdt, NEW.id, 'Escrow lock');
  END IF;

  IF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
    SELECT account_tier INTO seller_tier FROM public.profiles WHERE id = NEW.seller_id;
    hold_hours := CASE WHEN seller_tier IN ('pro','corporate') THEN COALESCE(g.sla_pro_hours, 24) ELSE COALESCE(g.auto_release_hours, 48) END;
    NEW.auto_release_hours := hold_hours;
    NEW.delivered_at := COALESCE(NEW.delivered_at, now());
    NEW.auto_release_at := NEW.delivered_at + make_interval(hours => hold_hours);
  END IF;

  IF NEW.status = 'completed' AND OLD.status <> 'completed' AND NEW.escrow_locked THEN
    SELECT account_tier INTO seller_tier FROM public.profiles WHERE id = NEW.seller_id;
    fee_pct := CASE seller_tier
      WHEN 'pro' THEN COALESCE(g.fee_pro_pct, 5) / 100.0
      WHEN 'corporate' THEN COALESCE(g.fee_corporate_pct, 2.5) / 100.0
      ELSE COALESCE(g.fee_free_pct, 10) / 100.0 END;
    fee := ROUND(COALESCE(NULLIF(NEW.platform_fee_usdt,0), NEW.amount_usdt * fee_pct), 6);
    net_amount := NEW.amount_usdt - fee;
    NEW.platform_fee_usdt := fee;
    NEW.completed_at := now();
    NEW.escrow_locked := false;

    UPDATE public.wallets SET locked_usdt = locked_usdt - NEW.amount_usdt WHERE user_id = NEW.buyer_id;
    UPDATE public.wallets SET available_usdt = available_usdt + net_amount, lifetime_earned = lifetime_earned + net_amount
      WHERE user_id = NEW.seller_id;
    INSERT INTO public.wallet_transactions (user_id, type, status, amount, fee, order_id, note)
      VALUES (NEW.seller_id, 'escrow_release', 'confirmed', net_amount, fee, NEW.id, 'Escrow release');

    UPDATE public.profiles
      SET completed_orders = completed_orders + 1,
          xp_points = xp_points + GREATEST(10, FLOOR(NEW.amount_usdt / 10)::int),
          level = GREATEST(1, FLOOR((xp_points + GREATEST(10, FLOOR(NEW.amount_usdt / 10)::int)) / 500) + 1)
      WHERE id = NEW.seller_id;

    IF NEW.listing_id IS NOT NULL THEN
      UPDATE public.listings SET orders_count = orders_count + 1 WHERE id = NEW.listing_id;
    END IF;

    -- Dual referral payouts: seller side and buyer side evaluated independently.
    PERFORM public.pay_referral_commission(NEW.seller_id, NEW.id, fee);
    IF NEW.buyer_id <> NEW.seller_id THEN
      PERFORM public.pay_referral_commission(NEW.buyer_id, NEW.id, fee);
    END IF;
  END IF;

  IF NEW.status IN ('refunded','cancelled') AND OLD.status NOT IN ('refunded','cancelled') AND NEW.escrow_locked THEN
    UPDATE public.wallets SET locked_usdt = locked_usdt - NEW.amount_usdt, available_usdt = available_usdt + NEW.amount_usdt
      WHERE user_id = NEW.buyer_id;
    NEW.escrow_locked := false;
    INSERT INTO public.wallet_transactions (user_id, type, status, amount, order_id, note)
      VALUES (NEW.buyer_id, 'escrow_refund', 'confirmed', NEW.amount_usdt, NEW.id, 'Escrow refund');
  END IF;

  PERFORM set_config('munjaz.escrow', 'off', true);
  RETURN NEW;
END; $function$;

-- ===== Admin user management RPCs =====
CREATE OR REPLACE FUNCTION public.admin_toggle_user_ban(p_user_id uuid, p_banned boolean, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'CANNOT_TARGET_SELF'; END IF;
  IF p_banned AND length(trim(coalesce(p_reason,''))) < 5 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  UPDATE public.profiles SET is_frozen = p_banned,
    frozen_reason = CASE WHEN p_banned THEN trim(p_reason) ELSE NULL END,
    frozen_at = CASE WHEN p_banned THEN now() ELSE NULL END
  WHERE id = p_user_id;
  INSERT INTO public.audit_logs (admin_id, action_type, target_table, target_id, meta)
    VALUES (auth.uid(), CASE WHEN p_banned THEN 'user_ban' ELSE 'user_unban' END, 'profiles', p_user_id, jsonb_build_object('reason', p_reason));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_deactivate_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'CANNOT_TARGET_SELF'; END IF;
  UPDATE public.profiles SET is_deactivated = true, deactivated_at = now(), is_frozen = true,
    frozen_reason = coalesce(frozen_reason, 'Account deactivated'), frozen_at = coalesce(frozen_at, now())
  WHERE id = p_user_id;
  UPDATE public.listings SET is_published = false WHERE owner_id = p_user_id;
  INSERT INTO public.audit_logs (admin_id, action_type, target_table, target_id, meta)
    VALUES (auth.uid(), 'user_deactivate', 'profiles', p_user_id, '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_send_user_notification(p_user_id uuid, p_title text, p_message text, p_type text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE nid uuid; k text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF length(trim(coalesce(p_title,''))) < 2 OR length(trim(coalesce(p_message,''))) < 2 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  k := CASE lower(coalesce(p_type,'info')) WHEN 'warning' THEN 'admin_warning' WHEN 'system' THEN 'admin_system' ELSE 'admin_info' END;
  INSERT INTO public.notifications (user_id, kind, title, body, meta)
    VALUES (p_user_id, k, left(trim(p_title),120), left(trim(p_message),2000), jsonb_build_object('from_admin', auth.uid()))
    RETURNING id INTO nid;
  INSERT INTO public.audit_logs (admin_id, action_type, target_table, target_id, meta)
    VALUES (auth.uid(), 'user_notify', 'notifications', nid, jsonb_build_object('user_id', p_user_id, 'type', k));
  RETURN nid;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_user_role(p_user_id uuid, p_role text, p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_role NOT IN ('admin','moderator','buyer','seller','hybrid','corporate') THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;
  IF p_user_id = auth.uid() AND p_role = 'admin' AND p_action = 'remove' THEN RAISE EXCEPTION 'CANNOT_TARGET_SELF'; END IF;
  IF p_action = 'add' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, p_role::public.app_role) ON CONFLICT DO NOTHING;
  ELSIF p_action = 'remove' THEN
    DELETE FROM public.user_roles WHERE user_id = p_user_id AND role = p_role::public.app_role;
  ELSE RAISE EXCEPTION 'INVALID_ACTION'; END IF;
  INSERT INTO public.audit_logs (admin_id, action_type, target_table, target_id, meta)
    VALUES (auth.uid(), 'role_' || p_action, 'user_roles', p_user_id, jsonb_build_object('role', p_role));
END; $$;

REVOKE ALL ON FUNCTION public.admin_toggle_user_ban(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_deactivate_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_send_user_notification(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_adjust_user_role(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_ban(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_send_user_notification(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_user_role(uuid, text, text) TO authenticated;

-- Avatars: public read, owner-only writes in own folder
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);