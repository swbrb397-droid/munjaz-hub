import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/lang";
import coverDesign from "@/assets/cover-design.jpg";
import coverCode from "@/assets/cover-code.jpg";
import coverCourse from "@/assets/cover-course.jpg";
import coverProduct from "@/assets/cover-product.jpg";
import coverGaming from "@/assets/cover-gaming.jpg";
import coverVideo from "@/assets/cover-video.jpg";

export const COVERS: Record<string, string> = {
  design: coverDesign,
  code: coverCode,
  course: coverCourse,
  product: coverProduct,
  gaming: coverGaming,
  video: coverVideo,
};

export type ListingCategory = "freelance" | "course" | "product" | "gaming";
export type SortKey = "recent" | "price_asc" | "price_desc" | "rating" | "popular";

export type Listing = {
  id: string;
  title: string;
  seller: string;
  category: ListingCategory;
  price: number;
  rating: number;
  orders: number;
  verified: boolean;
  tag: string;
  cover: string;
};

export type NftItem = { id: string; name: string; collection: string; price: number; hue: number };

function sortColumn(sort: SortKey) {
  switch (sort) {
    case "price_asc":
      return { column: "price_usdt", ascending: true };
    case "price_desc":
      return { column: "price_usdt", ascending: false };
    case "rating":
      return { column: "rating", ascending: false };
    case "popular":
      return { column: "orders_count", ascending: false };
    default:
      return { column: "created_at", ascending: false };
  }
}

export function useListings(opts: { search?: string; category?: ListingCategory | "all"; sort?: SortKey } = {}) {
  const { lang } = useLang();
  const search = (opts.search ?? "").trim();
  const category = opts.category ?? "all";
  const sort = opts.sort ?? "recent";

  return useQuery({
    queryKey: ["listings", { search, category, sort, lang }],
    queryFn: async (): Promise<Listing[]> => {
      const { column, ascending } = sortColumn(sort);
      let q = supabase
        .from("listings")
        .select("id,title_ar,title_en,seller_ar,seller_en,category,price_usdt,rating,orders_count,verified,tag_ar,tag_en,cover_key")
        .eq("is_published", true)
        .order(column, { ascending });

      if (category !== "all") q = q.eq("category", category);
      if (search) q = q.or(`title_ar.ilike.%${search}%,title_en.ilike.%${search}%,seller_ar.ilike.%${search}%,seller_en.ilike.%${search}%`);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        title: lang === "ar" ? r.title_ar : r.title_en,
        seller: lang === "ar" ? r.seller_ar : r.seller_en,
        category: r.category as ListingCategory,
        price: Number(r.price_usdt),
        rating: Number(r.rating),
        orders: r.orders_count,
        verified: r.verified,
        tag: lang === "ar" ? r.tag_ar : r.tag_en,
        cover: COVERS[r.cover_key] ?? coverProduct,
      }));
    },
  });
}

export function useNfts(opts: { search?: string; sort?: SortKey } = {}) {
  const search = (opts.search ?? "").trim();
  const sort = opts.sort ?? "recent";

  return useQuery({
    queryKey: ["nft_items", { search, sort }],
    queryFn: async (): Promise<NftItem[]> => {
      const { column, ascending } = sortColumn(sort);
      const col = column === "rating" || column === "orders_count" ? "price_usdt" : column;
      let q = supabase
        .from("nft_items")
        .select("id,name,collection,price_usdt,hue")
        .eq("is_published", true)
        .order(col, { ascending });

      if (search) q = q.or(`name.ilike.%${search}%,collection.ilike.%${search}%`);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        collection: r.collection,
        price: Number(r.price_usdt),
        hue: r.hue,
      }));
    },
  });
}
