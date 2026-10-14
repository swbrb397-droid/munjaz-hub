DROP FUNCTION IF EXISTS public.get_public_profiles(uuid[]);
CREATE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE(id uuid, display_name text, avatar_url text, bio text, country text, is_verified boolean,
  xp_points integer, level integer, rating numeric, completed_orders integer, account_tier account_tier,
  created_at timestamptz, skills text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.avatar_url, p.bio, p.country, p.is_verified, p.xp_points, p.level,
         p.rating, p.completed_orders, p.account_tier, p.created_at, p.skills
  FROM public.profiles p
  WHERE p.id = ANY(_ids) AND COALESCE(p.is_deactivated, false) = false
  LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO anon, authenticated, service_role;