CREATE OR REPLACE FUNCTION public.get_seller_reviews(p_seller_id uuid)
RETURNS TABLE(id uuid, rating integer, quality smallint, communication smallint, punctuality smallint, comment text, created_at timestamptz, reviewer_name text, order_title text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.rating, r.quality, r.communication, r.punctuality, r.comment, r.created_at, p.display_name, o.title
  FROM public.reviews r
  JOIN public.orders o ON o.id = r.order_id AND r.reviewer_id = o.buyer_id AND r.reviewee_id = o.seller_id
  LEFT JOIN public.profiles p ON p.id = r.reviewer_id
  WHERE o.seller_id = p_seller_id
  ORDER BY r.created_at DESC LIMIT 50;
$$;
GRANT EXECUTE ON FUNCTION public.get_seller_reviews(uuid) TO anon, authenticated;