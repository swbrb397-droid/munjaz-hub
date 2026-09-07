CREATE OR REPLACE FUNCTION public.preview_subscription_pass(_code text)
RETURNS TABLE (tier account_tier, duration_days integer, expires_at timestamptz, is_valid boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.tier,
         p.duration_days,
         p.expires_at,
         (p.used_by IS NULL AND p.expires_at > now()) AS is_valid
  FROM public.custom_subscription_passes p
  WHERE p.code = upper(btrim(_code))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.preview_subscription_pass(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_subscription_pass(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_stats()
RETURNS TABLE (listings_count bigint, sellers_count bigint, completed_orders bigint, volume_usdt numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.listings WHERE is_published),
    (SELECT count(DISTINCT owner_id) FROM public.listings WHERE is_published AND owner_id IS NOT NULL),
    (SELECT count(*) FROM public.orders WHERE status = 'completed'),
    (SELECT COALESCE(sum(amount_usdt), 0) FROM public.orders WHERE status = 'completed')
$$;

REVOKE ALL ON FUNCTION public.platform_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_stats() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_leaderboard(_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  display_name text,
  avatar_url text,
  rating numeric,
  completed_orders integer,
  level integer,
  xp_points integer,
  is_verified boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.id, pr.display_name, pr.avatar_url, pr.rating, pr.completed_orders, pr.level, pr.xp_points, pr.is_verified
  FROM public.profiles pr
  WHERE pr.completed_orders > 0 OR pr.rating > 0
  ORDER BY pr.rating DESC, pr.completed_orders DESC, pr.xp_points DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 20), 1), 100)
$$;

REVOKE ALL ON FUNCTION public.public_leaderboard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_leaderboard(integer) TO anon, authenticated;
