CREATE OR REPLACE FUNCTION public.preview_subscription_code(p_code text)
RETURNS TABLE(plan account_tier, duration_days integer, expires_at timestamptz, is_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_row public.subscription_codes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT * INTO v_row FROM public.subscription_codes WHERE upper(code) = v_code;
  IF NOT FOUND THEN RETURN; END IF;
  plan := v_row.plan;
  duration_days := v_row.duration_days;
  expires_at := v_row.expires_at;
  is_valid := (NOT v_row.is_redeemed) AND v_row.expires_at > now();
  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.preview_subscription_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.preview_subscription_code(text) TO authenticated;