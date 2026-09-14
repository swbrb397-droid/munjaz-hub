-- 1. Security cooling-lock timestamps
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_last_changed_at timestamptz;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS payout_address_updated_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mfa_updated_at timestamptz;

-- 2. Inspection window on orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS inspection_window_hours integer NOT NULL DEFAULT 48;

-- 3. Delivery extension requests
CREATE TABLE IF NOT EXISTS public.extension_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  hours integer NOT NULL CHECK (hours IN (24, 48)),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.extension_requests TO authenticated;
GRANT ALL ON public.extension_requests TO service_role;
ALTER TABLE public.extension_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Order parties read extensions" ON public.extension_requests;
CREATE POLICY "Order parties read extensions" ON public.extension_requests
  FOR SELECT TO authenticated
  USING (public.is_order_party(order_id, auth.uid()));

DROP POLICY IF EXISTS "Seller requests extension" ON public.extension_requests;
CREATE POLICY "Seller requests extension" ON public.extension_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.seller_id = auth.uid())
  );

DROP POLICY IF EXISTS "Buyer resolves extension" ON public.extension_requests;
CREATE POLICY "Buyer resolves extension" ON public.extension_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.buyer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.buyer_id = auth.uid()));

DROP TRIGGER IF EXISTS update_extension_requests_updated_at ON public.extension_requests;
CREATE TRIGGER update_extension_requests_updated_at
  BEFORE UPDATE ON public.extension_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Buyer accepting an extension pushes the order deadline forward atomically.
CREATE OR REPLACE FUNCTION public.resolve_extension_request(_id uuid, _accept boolean)
RETURNS public.extension_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.extension_requests;
  ord public.orders;
BEGIN
  SELECT * INTO req FROM public.extension_requests WHERE id = _id FOR UPDATE;
  IF req IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'ALREADY_RESOLVED'; END IF;

  SELECT * INTO ord FROM public.orders WHERE id = req.order_id;
  IF ord.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  UPDATE public.extension_requests
     SET status = CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END,
         resolved_at = now()
   WHERE id = _id
   RETURNING * INTO req;

  IF _accept THEN
    UPDATE public.orders
       SET due_at = COALESCE(due_at, now()) + make_interval(hours => req.hours)
     WHERE id = req.order_id;
  END IF;

  RETURN req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_extension_request(uuid, boolean) TO authenticated;

-- 4. Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  reviewee_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, reviewer_id)
);

GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviews are public" ON public.reviews;
CREATE POLICY "Reviews are public" ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Order parties write reviews" ON public.reviews;
CREATE POLICY "Order parties write reviews" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.status = 'completed'
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Keep the reviewee's aggregate rating in sync.
CREATE OR REPLACE FUNCTION public.sync_profile_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles p
     SET rating = COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 2) FROM public.reviews r WHERE r.reviewee_id = NEW.reviewee_id), 0)
   WHERE p.id = NEW.reviewee_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_sync_rating ON public.reviews;
CREATE TRIGGER reviews_sync_rating
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_rating();

-- 5. Public leaderboard RPC
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_filter text DEFAULT 'rating', p_limit integer DEFAULT 50)
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
  SELECT p.id, p.display_name, p.avatar_url, p.rating, p.completed_orders, p.level, p.xp_points, p.is_verified
  FROM public.profiles p
  WHERE COALESCE(p.is_frozen, false) = false
  ORDER BY
    CASE WHEN p_filter = 'completed_orders' THEN p.completed_orders END DESC NULLS LAST,
    CASE WHEN p_filter = 'xp_points' THEN p.xp_points END DESC NULLS LAST,
    CASE WHEN p_filter = 'rating' THEN p.rating END DESC NULLS LAST,
    p.completed_orders DESC
  LIMIT LEAST(COALESCE(p_limit, 50), 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, integer) TO anon, authenticated;