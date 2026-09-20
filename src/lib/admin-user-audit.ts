import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/cloud-client";
import type { Tables } from "@/integrations/supabase/types";

export type UserAudit = {
  profile: Pick<
    Tables<"profiles">,
    "id" | "display_name" | "created_at" | "account_tier" | "completed_orders" | "rating" | "is_frozen" | "kyc_status"
  > | null;
  payoutAddress: string | null;
  disputesTotal: number;
  disputesWon: number;
  disputesLost: number;
  openDisputes: number;
};

/** Deep audit of a payout requester, read live from the database (admin only). */
export function useUserAudit(userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["admin-user-audit", userId],
    enabled: enabled && !!userId,
    queryFn: async (): Promise<UserAudit> => {
      const uid = userId!;

      const [profileRes, walletRes, caseRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, created_at, account_tier, completed_orders, rating, is_frozen, kyc_status")
          .eq("id", uid)
          .maybeSingle(),
        supabase.from("wallets").select("payout_address").eq("user_id", uid).maybeSingle(),
        supabase
          .from("dispute_cases")
          .select("id, status, order_id, raised_by, against_user")
          .or(`raised_by.eq.${uid},against_user.eq.${uid}`)
          .limit(200),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (caseRes.error) throw caseRes.error;

      const cases = caseRes.data ?? [];
      const orderIds = cases.map((c) => c.order_id).filter((v): v is string => !!v);
      let orders: Pick<Tables<"orders">, "id" | "status" | "buyer_id" | "seller_id">[] = [];
      if (orderIds.length) {
        const res = await supabase.from("orders").select("id, status, buyer_id, seller_id").in("id", orderIds);
        if (res.error) throw res.error;
        orders = res.data ?? [];
      }
      const byOrder = new Map(orders.map((o) => [o.id, o]));

      let won = 0;
      let lost = 0;
      let open = 0;
      for (const c of cases) {
        if (c.status === "open" || c.status === "ai_reviewed") {
          open += 1;
          continue;
        }
        if (c.status !== "resolved") continue;
        const order = c.order_id ? byOrder.get(c.order_id) : undefined;
        if (!order) continue;
        const isBuyer = order.buyer_id === uid;
        const buyerWon = order.status === "refunded";
        const sellerWon = order.status === "completed";
        if ((isBuyer && buyerWon) || (!isBuyer && sellerWon)) won += 1;
        else if (buyerWon || sellerWon) lost += 1;
      }

      return {
        profile: profileRes.data ?? null,
        payoutAddress: walletRes.data?.payout_address ?? null,
        disputesTotal: cases.length,
        disputesWon: won,
        disputesLost: lost,
        openDisputes: open,
      };
    },
  });
}
