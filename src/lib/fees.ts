import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/cloud-client";

export type FeeRates = {
  /** Percent values (10 = 10%). */
  free: number;
  pro: number;
  corporate: number;
  auto_release_hours: number;
  sla_pro_hours: number;
};

/** Used only when the governance row cannot be read (offline/first paint). */
export const FEE_FALLBACK: FeeRates = {
  free: 10,
  pro: 5,
  corporate: 2.5,
  auto_release_hours: 48,
  sla_pro_hours: 24,
};

function num(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Live platform commission + escrow hold policy, straight from governance_settings. */
export async function fetchFeeRates(): Promise<FeeRates> {
  const { data, error } = await supabase.rpc("fee_rates");
  if (error || !data) return FEE_FALLBACK;
  const r = data as Record<string, unknown>;
  return {
    free: num(r["free"], FEE_FALLBACK.free),
    pro: num(r["pro"], FEE_FALLBACK.pro),
    corporate: num(r["corporate"], FEE_FALLBACK.corporate),
    auto_release_hours: num(r["auto_release_hours"], FEE_FALLBACK.auto_release_hours),
    sla_pro_hours: num(r["sla_pro_hours"], FEE_FALLBACK.sla_pro_hours),
  };
}

export function useFeeRates() {
  return useQuery({
    queryKey: ["fee-rates"],
    staleTime: 300_000,
    queryFn: fetchFeeRates,
  });
}

/** Commission as a fraction (0.05) for the given seller tier, using live governance values. */
export function rateForTier(rates: FeeRates | undefined, tier: string | null | undefined): number {
  const r = rates ?? FEE_FALLBACK;
  if (tier === "pro") return r.pro / 100;
  if (tier === "corporate") return r.corporate / 100;
  return r.free / 100;
}
