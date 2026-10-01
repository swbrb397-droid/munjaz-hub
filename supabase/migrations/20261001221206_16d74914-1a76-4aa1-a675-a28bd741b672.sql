-- ===== Gaming purge (no listings exist with this value) =====
DELETE FROM public.listings WHERE category::text = 'gaming';
ALTER TABLE public.listings ALTER COLUMN category DROP DEFAULT;
ALTER TYPE public.listing_category RENAME TO listing_category_old;
CREATE TYPE public.listing_category AS ENUM ('freelance','course','product');
ALTER TABLE public.listings ALTER COLUMN category TYPE public.listing_category USING category::text::public.listing_category;
ALTER TABLE public.listings ALTER COLUMN category SET DEFAULT 'freelance';
DROP TYPE public.listing_category_old;

-- ===== Listing description + code audit =====
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_code_audited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audit_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS audit_report text;

CREATE OR REPLACE FUNCTION public.protect_listing_audit_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR current_user IN ('postgres','supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.is_code_audited := false; NEW.audit_status := 'none'; NEW.audit_report := NULL;
  ELSE
    NEW.is_code_audited := OLD.is_code_audited; NEW.audit_status := OLD.audit_status; NEW.audit_report := OLD.audit_report;
  END IF;
  IF NEW.description IS NOT NULL AND length(NEW.description) > 2500 THEN
    RAISE EXCEPTION 'DESCRIPTION_TOO_LONG';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS listings_protect_audit ON public.listings;
CREATE TRIGGER listings_protect_audit BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.protect_listing_audit_columns();

-- Any edit to the payload invalidates a previous audit.
CREATE OR REPLACE FUNCTION public.reset_audit_on_payload_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.content IS DISTINCT FROM OLD.content OR NEW.file_path IS DISTINCT FROM OLD.file_path THEN
    UPDATE public.listings SET is_code_audited = false, audit_status = 'none', audit_report = NULL
      WHERE id = NEW.listing_id AND audit_status <> 'none';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS instant_payload_reset_audit ON public.listing_instant_delivery;
CREATE TRIGGER instant_payload_reset_audit AFTER INSERT OR UPDATE ON public.listing_instant_delivery
  FOR EACH ROW EXECUTE FUNCTION public.reset_audit_on_payload_change();

-- ===== 24h instant escrow =====
CREATE OR REPLACE FUNCTION public.purchase_digital_asset_instant(p_listing_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE uid uuid := auth.uid(); l RECORD; bal numeric(18,6); oid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO l FROM public.listings WHERE id = p_listing_id AND is_published;
  IF l.id IS NULL OR l.owner_id IS NULL THEN RAISE EXCEPTION 'LISTING_UNAVAILABLE'; END IF;
  IF l.category = 'freelance' THEN RAISE EXCEPTION 'NOT_INSTANT'; END IF;
  IF l.owner_id = uid THEN RAISE EXCEPTION 'OWN_LISTING'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND is_frozen) THEN RAISE EXCEPTION 'ACCOUNT_FROZEN'; END IF;
  SELECT available_usdt INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF bal IS NULL OR bal < l.price_usdt THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;

  INSERT INTO public.orders (buyer_id, seller_id, listing_id, title, category, sow_terms, amount_usdt, delivery_days, status)
  VALUES (uid, l.owner_id, l.id, l.title_ar, l.category::text, '', l.price_usdt, 0, 'pending') RETURNING id INTO oid;
  UPDATE public.orders SET status = 'in_progress' WHERE id = oid;  -- trigger locks funds in escrow
  UPDATE public.orders SET status = 'delivered' WHERE id = oid;    -- content handed over instantly
  UPDATE public.orders SET auto_release_hours = 24, auto_release_at = now() + interval '24 hours' WHERE id = oid;
  RETURN oid;
END; $function$;

CREATE OR REPLACE FUNCTION public.confirm_instant_delivery(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL OR o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF o.status <> 'delivered' THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
  UPDATE public.orders SET status = 'completed' WHERE id = p_order_id;
END $$;

CREATE OR REPLACE FUNCTION public.open_instant_dispute(p_order_id uuid, p_reason text, p_evidence jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders; cid uuid;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL OR o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF o.status <> 'delivered' THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
  IF o.auto_release_at IS NOT NULL AND o.auto_release_at <= now() THEN RAISE EXCEPTION 'DISPUTE_WINDOW_CLOSED'; END IF;
  IF length(trim(coalesce(p_reason,''))) < 20 THEN RAISE EXCEPTION 'REASON_TOO_SHORT'; END IF;
  IF p_evidence IS NULL OR jsonb_typeof(p_evidence) <> 'array' OR jsonb_array_length(p_evidence) = 0 THEN
    RAISE EXCEPTION 'EVIDENCE_REQUIRED';
  END IF;
  UPDATE public.orders SET status = 'disputed' WHERE id = p_order_id;
  INSERT INTO public.dispute_cases (order_id, kind, raised_by, against_user, reason, evidence, status)
    VALUES (p_order_id, 'dispute', o.buyer_id, o.seller_id, left(trim(p_reason), 2000), p_evidence, 'open')
    RETURNING id INTO cid;
  RETURN cid;
END $$;

REVOKE ALL ON FUNCTION public.confirm_instant_delivery(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_instant_dispute(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_instant_delivery(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_instant_dispute(uuid, text, jsonb) TO authenticated;

-- Buyers keep payload access while the order is in its hold window or disputed.
DROP POLICY IF EXISTS "Buyers read instant delivery after completed order" ON public.listing_instant_delivery;
CREATE POLICY "Buyers read instant delivery after purchase" ON public.listing_instant_delivery FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.listing_id = listing_instant_delivery.listing_id
    AND o.buyer_id = auth.uid() AND o.status IN ('delivered','disputed','completed')));
DROP POLICY IF EXISTS "Buyers read purchased deliverable files" ON storage.objects;
CREATE POLICY "Buyers read purchased deliverable files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'digital-deliverables' AND EXISTS (SELECT 1 FROM public.listing_instant_delivery d
    JOIN public.orders o ON o.listing_id = d.listing_id
    WHERE d.file_path = objects.name AND o.buyer_id = auth.uid() AND o.status IN ('delivered','disputed','completed')));

-- Dispute evidence upload into the order's private vault folder.
DROP POLICY IF EXISTS "Order parties upload dispute evidence" ON storage.objects;
CREATE POLICY "Order parties upload dispute evidence" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'digital-vault' AND (storage.foldername(name))[2] = 'disputes'
    AND public.is_order_party(((storage.foldername(name))[1])::uuid, auth.uid()));

-- ===== Meritocratic leaderboard =====
CREATE OR REPLACE FUNCTION public.get_merit_leaderboard(p_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, display_name text, avatar_url text, rating numeric, completed_orders integer, level integer,
  xp_points integer, is_verified boolean, dispute_rate numeric, speed_bonus numeric, merit_score numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH stats AS (
    SELECT o.seller_id,
      count(*) FILTER (WHERE o.status NOT IN ('pending','cancelled')) AS total,
      count(DISTINCT d.order_id) AS disputed,
      count(*) FILTER (WHERE o.delivered_at IS NOT NULL AND o.due_at IS NOT NULL) AS timed,
      count(*) FILTER (WHERE o.delivered_at IS NOT NULL AND o.due_at IS NOT NULL AND o.delivered_at <= o.due_at) AS on_time
    FROM public.orders o
    LEFT JOIN public.dispute_cases d ON d.order_id = o.id AND d.kind = 'dispute'
    GROUP BY o.seller_id
  ), scored AS (
    SELECT p.id, p.display_name, p.avatar_url, p.rating, p.completed_orders, p.level, p.xp_points, p.is_verified,
      ROUND(CASE WHEN coalesce(s.total,0) > 0 THEN s.disputed::numeric / s.total ELSE 0 END, 4) AS dispute_rate,
      ROUND(CASE WHEN coalesce(s.timed,0) > 0 THEN 15.0 * s.on_time / s.timed ELSE 0 END, 2) AS speed_bonus
    FROM public.profiles p LEFT JOIN stats s ON s.seller_id = p.id
    WHERE coalesce(p.is_frozen,false) = false AND coalesce(p.is_deactivated,false) = false AND p.completed_orders > 0
  )
  SELECT *, ROUND(completed_orders * 10 + coalesce(rating,0) * 20 - dispute_rate * 50 + speed_bonus, 2) AS merit_score
  FROM scored ORDER BY merit_score DESC, completed_orders DESC
  LIMIT LEAST(coalesce(p_limit,50),100);
$$;
GRANT EXECUTE ON FUNCTION public.get_merit_leaderboard(integer) TO anon, authenticated;