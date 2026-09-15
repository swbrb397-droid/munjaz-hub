import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/cloud-client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Only these order states still hold buyer funds inside escrow.
 * `completed`, `cancelled`, `refunded` and `pending` never count.
 */
export const ACTIVE_ESCROW_STATUSES = ["in_progress", "delivered", "disputed"] as const;

/**
 * Live "held in escrow" total for the signed-in buyer.
 *
 * Replaces the stale `wallets.locked_usdt` column so a fully completed order
 * can never keep showing a locked balance.
 */
export function useLockedEscrow() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["locked-escrow", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("amount_usdt,status")
        .eq("buyer_id", user!.id)
        .in("status", [...ACTIVE_ESCROW_STATUSES]);
      if (error) throw error;
      return (data ?? []).reduce((sum, row) => sum + Number(row.amount_usdt ?? 0), 0);
    },
  });
}
