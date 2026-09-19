import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/cloud-client";

export type FrozenAccount = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  frozenAt: string | null;
  frozenReason: string | null;
  balance: number;
  locked: number;
  orders: number;
  disputes: number;
};

/** Live list of frozen accounts with their platform history (admin sentinel desk). */
export function useFrozenAccounts(enabled: boolean) {
  return useQuery({
    queryKey: ["frozen-accounts"],
    enabled,
    queryFn: async (): Promise<FrozenAccount[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, frozen_at, frozen_reason")
        .eq("is_frozen", true)
        .order("frozen_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [];

      const ids = rows.map((r) => r.id);
      const [wallets, orders, disputes] = await Promise.all([
        supabase.from("wallets").select("user_id, available_usdt, locked_usdt").in("user_id", ids),
        supabase.from("orders").select("id, buyer_id, seller_id").or(
          `buyer_id.in.(${ids.join(",")}),seller_id.in.(${ids.join(",")})`,
        ),
        supabase.from("dispute_cases").select("id, raised_by, against_user"),
      ]);

      const walletBy = new Map(
        (wallets.data ?? []).map((w) => [w.user_id, w]),
      );

      return rows.map((r) => {
        const w = walletBy.get(r.id);
        const orderCount = (orders.data ?? []).filter(
          (o) => o.buyer_id === r.id || o.seller_id === r.id,
        ).length;
        const disputeCount = (disputes.data ?? []).filter(
          (d) => d.raised_by === r.id || d.against_user === r.id,
        ).length;
        return {
          id: r.id,
          displayName: r.display_name,
          avatarUrl: r.avatar_url,
          frozenAt: r.frozen_at,
          frozenReason: r.frozen_reason,
          balance: Number(w?.available_usdt ?? 0),
          locked: Number(w?.locked_usdt ?? 0),
          orders: orderCount,
          disputes: disputeCount,
        };
      });
    },
  });
}
