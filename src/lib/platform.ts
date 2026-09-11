import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    queryKey: ["leaderboard"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_leaderboard", { _limit: 50 });
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

export type PassPreview = {
  tier: "free" | "pro" | "corporate";
  duration_days: number;
  expires_at: string;
  is_valid: boolean;
};

/** Preview a subscription pass before redeeming it (code lookup only). */
export function usePassPreview(code: string) {
  const normalized = code.replace(/\s+/g, "").toUpperCase();
  return useQuery({
    queryKey: ["pass-preview", normalized],
    enabled: normalized.length >= 8,
    retry: false,
    queryFn: async (): Promise<PassPreview | null> => {
      const { data, error } = await supabase.rpc("preview_subscription_code", { p_code: normalized });
      if (error) throw error;
      const row = ((data ?? []) as Array<{ plan: string; duration_days: number; expires_at: string; is_valid: boolean }>)[0];
      if (!row) return null;
      return {
        tier: row.plan as PassPreview["tier"],
        duration_days: Number(row.duration_days),
        expires_at: String(row.expires_at),
        is_valid: Boolean(row.is_valid),
      };
    },
  });
}

export function tierLabel(tier: PassPreview["tier"], ar: boolean) {
  if (tier === "corporate") return ar ? "Pro شركات" : "Pro Corporate";
  if (tier === "pro") return ar ? "Pro أفراد" : "Pro Individual";
  return ar ? "الباقة المجانية" : "Free plan";
}
