/**
 * Withdrawal network fees. These values MUST mirror
 * `public.withdrawal_network_fee()` in the database, which is the enforced source.
 */

export type GasNetwork = "polygon" | "bep20" | "trc20";

export type GasEstimate = {
  value: GasNetwork;
  label: string;
  /** Exact platform withdrawal fee in USDT for this network. */
  fee: number;
  etaAr: string;
  etaEn: string;
  tone: "best" | "good" | "high";
};

export const NETWORK_WITHDRAWAL_FEE: Record<GasNetwork, number> = {
  polygon: 0.2,
  bep20: 0.3,
  trc20: 2,
};

const ROWS: GasEstimate[] = [
  { value: "polygon", label: "Polygon", fee: 0.2, etaAr: "أقل من دقيقة", etaEn: "Under 1 min", tone: "best" },
  { value: "bep20", label: "BEP-20 (BSC)", fee: 0.3, etaAr: "١–٣ دقائق", etaEn: "1–3 min", tone: "good" },
  { value: "trc20", label: "TRC-20 (Tron)", fee: 2, etaAr: "١–٢ دقيقة", etaEn: "1–2 min", tone: "high" },
];

export function gasEstimates(): GasEstimate[] {
  return ROWS;
}
