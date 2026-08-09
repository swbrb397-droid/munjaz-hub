CREATE TYPE public.listing_category AS ENUM ('freelance','course','product','gaming');

CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar text NOT NULL,
  title_en text NOT NULL,
  seller_ar text NOT NULL,
  seller_en text NOT NULL,
  category public.listing_category NOT NULL DEFAULT 'freelance',
  price_usdt numeric(18,6) NOT NULL DEFAULT 0,
  rating numeric(3,2) NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false,
  tag_ar text NOT NULL DEFAULT '',
  tag_en text NOT NULL DEFAULT '',
  cover_key text NOT NULL DEFAULT 'product',
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published listings are public" ON public.listings FOR SELECT USING (is_published = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage listings" ON public.listings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER listings_updated_at BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.nft_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  collection text NOT NULL,
  price_usdt numeric(18,6) NOT NULL DEFAULT 0,
  hue integer NOT NULL DEFAULT 165,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.nft_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nft_items TO authenticated;
GRANT ALL ON public.nft_items TO service_role;
ALTER TABLE public.nft_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published nfts are public" ON public.nft_items FOR SELECT USING (is_published = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage nfts" ON public.nft_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER nft_items_updated_at BEFORE UPDATE ON public.nft_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.listings (title_ar,title_en,seller_ar,seller_en,category,price_usdt,rating,orders_count,verified,tag_ar,tag_en,cover_key) VALUES
('تصميم هوية بصرية متكاملة','Complete brand identity design','استوديو نُون','Noon Studio','freelance',320,4.9,214,true,'تصميم','Design','design'),
('تطوير متجر إلكتروني Next.js','Next.js e-commerce development','م. خالد','Eng. Khaled','freelance',850,5.0,96,true,'برمجة','Development','code'),
('دورة: احتراف العقود الذكية','Course: Mastering smart contracts','أكاديمية بلوك','Block Academy','course',120,4.8,1320,true,'تعليم','Learning','course'),
('حزمة قوالب لوحات تحكم','Dashboard templates bundle','Pixel Vault','Pixel Vault','product',45,4.7,780,false,'منتج رقمي','Digital product','product'),
('جلسة تدريب Valorant احترافية','Pro Valorant coaching session','Coach Zaid','Coach Zaid','gaming',25,4.9,430,true,'قيمنق','Gaming','gaming'),
('مونتاج فيديو سينمائي','Cinematic video editing','دار الإطار','Frame House','freelance',190,4.6,152,false,'فيديو','Video','video'),
('دورة تسويق أداء متقدمة','Advanced performance marketing course','منصة رقم','Raqam Platform','course',95,4.7,640,true,'تعليم','Learning','course'),
('مكتبة أيقونات نيون 800+','800+ neon icon library','Neon Labs','Neon Labs','product',30,4.9,1105,true,'منتج رقمي','Digital product','product');

INSERT INTO public.nft_items (name,collection,price_usdt,hue) VALUES
('Desert Protocol #012','Munjaz Genesis',1450,165),
('Neon Falcon #204','Falcons',890,205),
('Cipher Mask #077','Ciphers',2100,300),
('Oasis Grid #305','Munjaz Genesis',640,185),
('Sand Ronin #018','Ronin',3200,320),
('Pulse Key #451','Keys',410,150);