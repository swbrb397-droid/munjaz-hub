import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_listings",
  title: "Search marketplace listings",
  description: "Search published Al-Munjaz marketplace listings by keyword, category and price.",
  inputSchema: {
    search: z.string().trim().optional().describe("Keyword matched against listing title or seller name."),
    category: z.enum(["freelance", "course", "product", "gaming"]).optional(),
    maxPrice: z.number().positive().optional().describe("Maximum price in USDT."),
    limit: z.number().int().min(1).max(50).default(10),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, category, maxPrice, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("listings")
      .select("id,title_ar,title_en,seller_ar,seller_en,category,price_usdt,rating,orders_count,delivery_days")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (category) q = q.eq("category", category);
    if (maxPrice) q = q.lte("price_usdt", maxPrice);
    if (search) q = q.or(`title_ar.ilike.%${search}%,title_en.ilike.%${search}%,seller_ar.ilike.%${search}%,seller_en.ilike.%${search}%`);

    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const listings = (data ?? []).map((r) => ({
      id: String(r.id),
      titleAr: r.title_ar ?? "",
      titleEn: r.title_en ?? "",
      sellerAr: r.seller_ar ?? "",
      sellerEn: r.seller_en ?? "",
      category: r.category ?? "",
      priceUsdt: Number(r.price_usdt ?? 0),
      rating: Number(r.rating ?? 0),
      ordersCount: Number(r.orders_count ?? 0),
      deliveryDays: Number(r.delivery_days ?? 0),
    }));
    return {
      content: [{ type: "text" as const, text: JSON.stringify(listings, null, 2) }],
      structuredContent: { listings },
    };
  },
});
