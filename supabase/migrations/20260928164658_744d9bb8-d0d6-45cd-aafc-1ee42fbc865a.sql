DROP VIEW IF EXISTS public.public_profiles;
CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE(id uuid, display_name text, avatar_url text, bio text, country text, is_verified boolean,
  xp_points integer, level integer, rating numeric, completed_orders integer, account_tier account_tier, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.avatar_url, p.bio, p.country, p.is_verified, p.xp_points, p.level,
         p.rating, p.completed_orders, p.account_tier, p.created_at
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.id = ANY(_ids)
  LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;