
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Trusted internal routines (escrow trigger, pass redemption) set this flag.
  IF coalesce(current_setting('munjaz.escrow', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  IF NOT public.has_role(auth.uid(),'admin') THEN
    NEW.kyc_tier := OLD.kyc_tier;
    NEW.is_verified := OLD.is_verified;
    NEW.kyc_status := OLD.kyc_status;
    NEW.xp_points := OLD.xp_points;
    NEW.level := OLD.level;
    NEW.rating := OLD.rating;
    NEW.completed_orders := OLD.completed_orders;
    NEW.referral_code := OLD.referral_code;
    NEW.referred_by := OLD.referred_by;
    NEW.account_tier := OLD.account_tier;
    NEW.is_frozen := OLD.is_frozen;
    NEW.frozen_reason := OLD.frozen_reason;
    NEW.frozen_at := OLD.frozen_at;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.redeem_subscription_pass(_code text)
RETURNS custom_subscription_passes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE p public.custom_subscription_passes; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO p FROM public.custom_subscription_passes WHERE code = upper(btrim(_code)) FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'PASS_NOT_FOUND'; END IF;
  IF p.used_by IS NOT NULL THEN RAISE EXCEPTION 'PASS_ALREADY_USED'; END IF;
  IF p.expires_at <= now() THEN RAISE EXCEPTION 'PASS_EXPIRED'; END IF;
  UPDATE public.custom_subscription_passes SET used_by = uid, used_at = now() WHERE id = p.id RETURNING * INTO p;
  PERFORM set_config('munjaz.escrow','on', true);
  UPDATE public.profiles SET account_tier = p.tier WHERE id = uid;
  PERFORM set_config('munjaz.escrow','off', true);
  RETURN p;
END; $function$;

REVOKE ALL ON FUNCTION public.protect_profile_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_subscription_pass(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_subscription_pass(text) TO authenticated;

DROP TABLE IF EXISTS public._smoke_log;
