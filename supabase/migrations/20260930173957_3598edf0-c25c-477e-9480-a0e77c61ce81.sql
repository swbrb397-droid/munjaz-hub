CREATE OR REPLACE FUNCTION public.get_listing_reviews(p_listing_id uuid)
RETURNS TABLE(id uuid, rating integer, quality smallint, communication smallint, punctuality smallint, comment text, created_at timestamptz, reviewer_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.id, r.rating, r.quality, r.communication, r.punctuality, r.comment, r.created_at, p.display_name
  FROM public.reviews r
  JOIN public.orders o ON o.id = r.order_id AND r.reviewer_id = o.buyer_id
  LEFT JOIN public.profiles p ON p.id = r.reviewer_id
  WHERE o.listing_id = p_listing_id
  ORDER BY r.created_at DESC LIMIT 50;
$$;
GRANT EXECUTE ON FUNCTION public.get_listing_reviews(uuid) TO anon, authenticated;
COMMENT ON FUNCTION public.admin_get_users_directory() IS 'Admin-only: enforces has_role(auth.uid(),''admin'') internally.';