ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.enforce_listing_min_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.price_usdt < 3 THEN
    RAISE EXCEPTION 'Listing price must be at least 3 USDT';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS listings_min_price ON public.listings;
CREATE TRIGGER listings_min_price BEFORE INSERT OR UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_min_price();

CREATE POLICY "Users create own listings" ON public.listings
FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners read own listings" ON public.listings
FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Owners update own listings" ON public.listings
FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners delete own listings" ON public.listings
FOR DELETE TO authenticated USING (owner_id = auth.uid());