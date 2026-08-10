ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hybrid';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'corporate';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS active_view TEXT NOT NULL DEFAULT 'buyer';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ref_code TEXT;
  inviter UUID;
  chosen TEXT;
BEGIN
  ref_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  SELECT p.id INTO inviter FROM public.profiles p
    WHERE p.referral_code = upper(NEW.raw_user_meta_data->>'referral_code');

  chosen := lower(coalesce(NEW.raw_user_meta_data->>'role',''));
  IF chosen NOT IN ('buyer','seller','hybrid','corporate') THEN
    chosen := 'buyer';
  END IF;

  INSERT INTO public.profiles (id, display_name, referral_code, referred_by, terms_accepted_at, active_view)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
    ref_code,
    inviter,
    CASE WHEN (NEW.raw_user_meta_data->>'terms_accepted') = 'true' THEN now() ELSE NULL END,
    CASE WHEN chosen = 'seller' THEN 'seller' ELSE 'buyer' END
  );

  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, chosen::public.app_role) ON CONFLICT DO NOTHING;
  IF chosen = 'hybrid' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer'), (NEW.id, 'seller') ON CONFLICT DO NOTHING;
  END IF;

  IF inviter IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id) VALUES (inviter, NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$;