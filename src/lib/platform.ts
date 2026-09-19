import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/cloud-client";

/** Live platform counters (published offers, sellers, completed orders, volume). */
export function usePlatformStats() {
  return useQuery({
    queryKey: ["platform-stats"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_stats");
      if (error) throw error;
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

export type LeaderboardMetric = "rating" | "completed_orders" | "xp_points";

export type LeaderRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  rating: number;
  completed_orders: number;
  level: number;
  xp_points: number;
  is_verified: boolean;
};

/** Real seller ranking straight from the database — no boosting, no seeded rows. */
export function useLeaderboard(metric: LeaderboardMetric) {
  return useQuery({
    queryKey: ["leaderboard", metric],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaderboard", {
        p_filter: metric,
        p_limit: 50,
      });
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
      })) as LeaderRow[];
    },
    select: (rows) => [...rows].sort((a, b) => b[metric] - a[metric]),
  });
}

