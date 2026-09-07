CREATE OR REPLACE FUNCTION public.preview_subscription_pass(_code text)
 RETURNS TABLE(tier account_tier, duration_days integer, expires_at timestamp with time zone, is_valid boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.tier,
         p.duration_days,
         p.expires_at,
         (p.used_by IS NULL AND p.expires_at > now()) AS is_valid
  FROM public.custom_subscription_passes p
  WHERE upper(regexp_replace(p.code, '[^A-Za-z0-9]', '', 'g'))
      = upper(regexp_replace(coalesce(_code,''), '[^A-Za-z0-9]', '', 'g'))
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.redeem_subscription_pass(_code text)
 RETURNS custom_subscription_passes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p public.custom_subscription_passes; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO p FROM public.custom_subscription_passes
   WHERE upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g'))
       = upper(regexp_replace(coalesce(_code,''), '[^A-Za-z0-9]', '', 'g'))
   FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'PASS_NOT_FOUND'; END IF;
  IF p.used_by IS NOT NULL THEN RAISE EXCEPTION 'PASS_ALREADY_USED'; END IF;
  IF p.expires_at <= now() THEN RAISE EXCEPTION 'PASS_EXPIRED'; END IF;
  UPDATE public.custom_subscription_passes SET used_by = uid, used_at = now() WHERE id = p.id RETURNING * INTO p;
  PERFORM set_config('munjaz.escrow','on', true);
  UPDATE public.profiles SET account_tier = p.tier WHERE id = uid;
  PERFORM set_config('munjaz.escrow','off', true);
  RETURN p;
END; $function$;

GRANT EXECUTE ON FUNCTION public.preview_subscription_pass(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_subscription_pass(text) TO authenticated;