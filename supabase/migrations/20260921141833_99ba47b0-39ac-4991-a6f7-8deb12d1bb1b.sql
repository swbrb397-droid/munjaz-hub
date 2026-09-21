CREATE TABLE public.listing_instant_delivery (
  listing_id UUID PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  content TEXT,
  file_path TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_instant_delivery TO authenticated;
GRANT ALL ON public.listing_instant_delivery TO service_role;

ALTER TABLE public.listing_instant_delivery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers manage their own instant delivery"
ON public.listing_instant_delivery FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Buyers read instant delivery after completed order"
ON public.listing_instant_delivery FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.listing_id = listing_instant_delivery.listing_id
    AND o.buyer_id = auth.uid()
    AND o.status = 'completed'
));

CREATE POLICY "Admins read instant delivery"
ON public.listing_instant_delivery FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_listing_instant_delivery_updated_at
BEFORE UPDATE ON public.listing_instant_delivery
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();