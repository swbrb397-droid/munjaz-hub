import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/lang";
import { COVERS } from "@/lib/catalog";
import type { Tables } from "@/integrations/supabase/types";

export type Order = Tables<"orders">;
export type OrderStatus = Order["status"];

/** Public single-listing fetch (anon-readable when published). */
export function useListing(id: string) {
  const { lang } = useLang();
  return useQuery({
    queryKey: ["listing", id, lang],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("id", id)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        raw: data,
        id: data.id,
        title: lang === "ar" ? data.title_ar : data.title_en,
        seller: lang === "ar" ? data.seller_ar : data.seller_en,
        tag: lang === "ar" ? data.tag_ar : data.tag_en,
        category: data.category,
        price: Number(data.price_usdt),
        rating: Number(data.rating),
        orders: data.orders_count,
        verified: data.verified,
        ownerId: data.owner_id,
        cover: COVERS[data.cover_key] ?? COVERS.product!,
      };
    },
  });
}

export type CreateOrderInput = {
  listingId: string;
  sellerId: string;
  title: string;
  category: string;
  amount: number;
  deliveryDays: number;
  sowTerms: string;
};

export function useCreateOrder() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { tr } = useLang();

  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      if (!user) throw new Error(tr("سجّل الدخول أولاً", "Please sign in first"));
      if (input.sellerId === user.id) throw new Error(tr("لا يمكنك شراء عرضك الخاص", "You cannot buy your own listing"));
      if (!(input.amount >= 3)) throw new Error(tr("الحد الأدنى 3 USDT", "Minimum amount is 3 USDT"));

      const { data, error } = await supabase
        .from("orders")
        .insert({
          listing_id: input.listingId,
          buyer_id: user.id,
          seller_id: input.sellerId,
          title: input.title,
          category: input.category,
          amount_usdt: input.amount,
          platform_fee_usdt: Number((input.amount * 0.1).toFixed(6)),
          delivery_days: input.deliveryDays,
          sow_terms: input.sowTerms,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

/** Allowed lifecycle transitions per actor. */
export function nextActions(order: Order, userId: string | undefined) {
  const isBuyer = order.buyer_id === userId;
  const isSeller = order.seller_id === userId;
  const actions: { key: OrderStatus; role: "buyer" | "seller"; tone: "primary" | "accent" | "danger" }[] = [];

  if (order.status === "pending" && isBuyer) {
    actions.push({ key: "in_progress", role: "buyer", tone: "primary" });
    actions.push({ key: "cancelled", role: "buyer", tone: "danger" });
  }
  if (order.status === "in_progress" && isSeller) {
    actions.push({ key: "delivered", role: "seller", tone: "accent" });
  }
  if (order.status === "delivered" && isBuyer) {
    actions.push({ key: "completed", role: "buyer", tone: "primary" });
  }
  return actions;
}

export function useOrderTransition() {
  const qc = useQueryClient();
  const { tr } = useLang();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) {
        if (error.message.includes("INSUFFICIENT_FUNDS")) {
          throw new Error(tr("رصيد USDT غير كافٍ لتمويل الضمان.", "Insufficient USDT balance to fund escrow."));
        }
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useDeliverables() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, deliverables }: { id: string; deliverables: string[] }) => {
      const { error } = await supabase.from("orders").update({ deliverables }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}
