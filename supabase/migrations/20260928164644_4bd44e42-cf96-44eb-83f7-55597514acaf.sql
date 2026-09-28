DROP POLICY IF EXISTS "Profiles are viewable by signed-in users" ON public.profiles;
CREATE POLICY "Users read own profile or admins read all" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, display_name, avatar_url, bio, country, is_verified, xp_points, level,
         rating, completed_orders, account_tier, created_at
  FROM public.profiles;
REVOKE ALL ON public.public_profiles FROM anon;
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO service_role;

DROP POLICY IF EXISTS "Signed-in users read governance_settings" ON public.governance_settings;
CREATE POLICY "Admins read governance_settings" ON public.governance_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Signed-in users read governance" ON public.platform_governance_settings;