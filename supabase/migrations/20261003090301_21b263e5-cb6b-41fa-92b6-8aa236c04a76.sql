-- ===== Revision cycles =====
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS revisions_allowed integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS revisions_used integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.request_order_revision(p_deliverable_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.order_deliverables; o public.orders;
BEGIN
  SELECT * INTO d FROM public.order_deliverables WHERE id = p_deliverable_id;
  IF d.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = d.order_id FOR UPDATE;
  IF o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF o.status NOT IN ('in_progress','delivered') THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
  IF o.revisions_used >= o.revisions_allowed THEN RAISE EXCEPTION 'REVISION_LIMIT_REACHED'; END IF;
  UPDATE public.orders SET revisions_used = revisions_used + 1,
    status = CASE WHEN status = 'delivered' THEN 'in_progress'::order_status ELSE status END
    WHERE id = o.id;
  UPDATE public.order_deliverables SET approval_state = 'revision' WHERE id = d.id;
  RETURN o.revisions_used + 1;
END $$;
REVOKE ALL ON FUNCTION public.request_order_revision(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_order_revision(uuid) TO authenticated;

-- Buyers can no longer flag 'revision' directly; it must go through the counted RPC.
CREATE OR REPLACE FUNCTION public.guard_deliverable_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.approval_state = 'revision' AND OLD.approval_state IS DISTINCT FROM 'revision'
     AND current_user NOT IN ('postgres','service_role','supabase_admin')
     AND coalesce(current_setting('munjaz.revision_rpc', true),'') <> 'on' THEN
    RAISE EXCEPTION 'USE_REVISION_REQUEST';
  END IF;
  RETURN NEW;
END $$;
-- SECURITY DEFINER rpc runs as owner (postgres), so it passes the guard.
DROP TRIGGER IF EXISTS deliverable_revision_guard ON public.order_deliverables;
CREATE TRIGGER deliverable_revision_guard BEFORE UPDATE ON public.order_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.guard_deliverable_revision();

-- ===== License key inventory =====
CREATE TABLE public.listing_license_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  key_text text NOT NULL CHECK (length(key_text) BETWEEN 1 AND 500),
  is_redeemed boolean NOT NULL DEFAULT false,
  redeemed_by_order_id uuid REFERENCES public.orders(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listing_license_keys_avail ON public.listing_license_keys (listing_id) WHERE NOT is_redeemed;
GRANT SELECT, INSERT, DELETE ON public.listing_license_keys TO authenticated;
GRANT ALL ON public.listing_license_keys TO service_role;
ALTER TABLE public.listing_license_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own keys" ON public.listing_license_keys FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_id = auth.uid()));
CREATE POLICY "Buyers read their redeemed key" ON public.listing_license_keys FOR SELECT TO authenticated
  USING (is_redeemed AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = redeemed_by_order_id AND o.buyer_id = auth.uid()));
CREATE POLICY "Admins read keys" ON public.listing_license_keys FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners add keys" ON public.listing_license_keys FOR INSERT TO authenticated
  WITH CHECK (NOT is_redeemed AND redeemed_by_order_id IS NULL
    AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_id = auth.uid()));
CREATE POLICY "Owners delete unused keys" ON public.listing_license_keys FOR DELETE TO authenticated
  USING (NOT is_redeemed AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_id = auth.uid()));

-- Public stock count: NULL = listing does not use keys.
CREATE OR REPLACE FUNCTION public.listing_key_stock(p_listing_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN count(*) = 0 THEN NULL ELSE count(*) FILTER (WHERE NOT is_redeemed)::int END
  FROM public.listing_license_keys WHERE listing_id = p_listing_id
$$;
GRANT EXECUTE ON FUNCTION public.listing_key_stock(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.purchase_digital_asset_instant(p_listing_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE uid uuid := auth.uid(); l RECORD; bal numeric(18,6); oid uuid; uses_keys boolean; k uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO l FROM public.listings WHERE id = p_listing_id AND is_published;
  IF l.id IS NULL OR l.owner_id IS NULL THEN RAISE EXCEPTION 'LISTING_UNAVAILABLE'; END IF;
  IF l.category = 'freelance' THEN RAISE EXCEPTION 'NOT_INSTANT'; END IF;
  IF l.owner_id = uid THEN RAISE EXCEPTION 'OWN_LISTING'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND is_frozen) THEN RAISE EXCEPTION 'ACCOUNT_FROZEN'; END IF;

  uses_keys := EXISTS (SELECT 1 FROM public.listing_license_keys WHERE listing_id = l.id);
  IF uses_keys THEN
    SELECT id INTO k FROM public.listing_license_keys
      WHERE listing_id = l.id AND NOT is_redeemed ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF k IS NULL THEN RAISE EXCEPTION 'OUT_OF_STOCK'; END IF;
  END IF;

  SELECT available_usdt INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF bal IS NULL OR bal < l.price_usdt THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;

  INSERT INTO public.orders (buyer_id, seller_id, listing_id, title, category, sow_terms, amount_usdt, delivery_days, status)
  VALUES (uid, l.owner_id, l.id, l.title_ar, l.category::text, '', l.price_usdt, 0, 'pending') RETURNING id INTO oid;
  UPDATE public.orders SET status = 'in_progress' WHERE id = oid;
  UPDATE public.orders SET status = 'delivered' WHERE id = oid;
  UPDATE public.orders SET auto_release_hours = 24, auto_release_at = now() + interval '24 hours' WHERE id = oid;
  IF k IS NOT NULL THEN
    UPDATE public.listing_license_keys SET is_redeemed = true, redeemed_by_order_id = oid WHERE id = k;
  END IF;
  RETURN oid;
END; $function$;

-- ===== Orphaned vault file finder (completed orders, >180 days) =====
CREATE OR REPLACE FUNCTION public.orphaned_vault_objects(p_limit integer DEFAULT 500)
RETURNS TABLE(name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
  SELECT so.name FROM storage.objects so
  JOIN public.orders o ON o.id::text = (storage.foldername(so.name))[1]
  WHERE so.bucket_id = 'digital-vault'
    AND so.created_at < now() - interval '180 days'
    AND o.status = 'completed'
    AND NOT EXISTS (SELECT 1 FROM public.order_deliverables d WHERE d.storage_path = so.name)
    AND NOT EXISTS (SELECT 1 FROM public.order_messages m WHERE m.attachment_path = so.name)
    AND (storage.foldername(so.name))[2] IS DISTINCT FROM 'disputes'
  LIMIT greatest(1, least(p_limit, 1000))
$$;
REVOKE ALL ON FUNCTION public.orphaned_vault_objects(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orphaned_vault_objects(integer) TO service_role;