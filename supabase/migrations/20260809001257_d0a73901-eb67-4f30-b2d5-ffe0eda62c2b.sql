DROP POLICY "Published listings are public" ON public.listings;
DROP POLICY "Published nfts are public" ON public.nft_items;

CREATE POLICY "Anon reads published listings" ON public.listings FOR SELECT TO anon USING (is_published = true);
CREATE POLICY "Users read listings" ON public.listings FOR SELECT TO authenticated USING (is_published = true OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Anon reads published nfts" ON public.nft_items FOR SELECT TO anon USING (is_published = true);
CREATE POLICY "Users read nfts" ON public.nft_items FOR SELECT TO authenticated USING (is_published = true OR public.has_role(auth.uid(),'admin'));