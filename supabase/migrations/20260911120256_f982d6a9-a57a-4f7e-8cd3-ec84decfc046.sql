CREATE TABLE IF NOT EXISTS public.subscription_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  plan account_tier not null default 'pro',
  duration_days integer not null default 30,
  is_redeemed boolean not null default false,
  redeemed_by uuid,
  redeemed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_codes TO authenticated;
GRANT ALL ON public.subscription_codes TO service_role;
ALTER TABLE public.subscription_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage subscription codes" ON public.subscription_codes
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.redeem_subscription_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_row public.subscription_codes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_row FROM public.subscription_codes
  WHERE upper(code) = v_code FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'PASS_NOT_FOUND');
  END IF;
  IF v_row.is_redeemed THEN
    RETURN jsonb_build_object('success', false, 'message', 'PASS_ALREADY_USED');
  END IF;
  IF v_row.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'PASS_EXPIRED');
  END IF;

  UPDATE public.subscription_codes
  SET is_redeemed = true, redeemed_by = auth.uid(), redeemed_at = now()
  WHERE id = v_row.id;

  UPDATE public.profiles
  SET account_tier = v_row.plan,
      plan_expires_at = greatest(coalesce(plan_expires_at, now()), now()) + (v_row.duration_days || ' days')::interval
  WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'success', true,
    'tier', v_row.plan,
    'duration_days', v_row.duration_days,
    'message', 'تم تفعيل اشتراكك بنجاح!'
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.redeem_subscription_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_subscription_code(text) TO authenticated;