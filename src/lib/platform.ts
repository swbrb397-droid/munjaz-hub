import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/cloud-client";

/** Live platform counters (published offers, sellers, completed orders, volume). */
export function usePlatformStats() {
  return useQuery({
    queryKey: ["platform-stats"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_stats");
      // Guests/RLS denials fall back to an empty state instead of crashing the page.
      if (error) {
        console.warn("[platform_stats] fallback", error.message);
        return { listings: 0, sellers: 0, completedOrders: 0, volume: 0 };
      }
      const row = (data ?? [])[0];
      return {
        listings: Number(row?.listings_count ?? 0),
        sellers: Number(row?.sellers_count ?? 0),
        completedOrders: Number(row?.completed_orders ?? 0),
        volume: Number(row?.volume_usdt ?? 0),
      };
    },
  });
}

export type LeaderRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  rating: number;
  completed_orders: number;
  level: number;
  xp_points: number;
  is_verified: boolean;
  dispute_rate: number;
  speed_bonus: number;
  merit_score: number;
};

/**
 * Meritocratic ranking computed in the database:
 * (completed × 10) + (rating × 20) − (dispute rate × 50) + speed bonus.
 * Frozen accounts and sellers without completed orders are excluded server-side.
 */
export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard", "merit"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_merit_leaderboard", { p_limit: 50 });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: String(r.id),
        display_name: r.display_name,
        avatar_url: r.avatar_url,
        rating: Number(r.rating ?? 0),
        completed_orders: Number(r.completed_orders ?? 0),
        level: Number(r.level ?? 1),
        xp_points: Number(r.xp_points ?? 0),
        is_verified: Boolean(r.is_verified),
        dispute_rate: Number(r.dispute_rate ?? 0),
        speed_bonus: Number(r.speed_bonus ?? 0),
        merit_score: Number(r.merit_score ?? 0),
      })) as LeaderRow[];
    },
  });
}
