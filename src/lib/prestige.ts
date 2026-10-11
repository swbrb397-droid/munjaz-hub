/**
 * 8-tier hybrid prestige engine — purely cosmetic.
 * No tier ever restricts publishing: every user may list services freely.
 * A tier is earned when ALL four metrics meet its thresholds.
 */

export type PrestigeMetrics = {
  orders: number;
  volume: number; // USDT
  rating: number; // 0..5
  onTime: number; // 0..100 (%)
};

export type PrestigeTier = {
  level: number;
  ar: string;
  en: string;
  orders: number;
  volume: number;
  rating: number;
  onTime: number;
  /** Tailwind classes for the badge shell (semantic tokens + metal accents). */
  badge: string;
  aura?: boolean;
};

// Each rank owns a unique hue: bronze → emerald → cyan → royal blue → amethyst → gold → platinum → crimson.
export const PRESTIGE_TIERS: ReadonlyArray<PrestigeTier> = [
  { level: 1, ar: "الانطلاقة", en: "Starter", orders: 0, volume: 0, rating: 0, onTime: 0, badge: "border-[#cd7f32]/60 bg-[#cd7f32]/12 text-[#e0a06a]" },
  { level: 2, ar: "الصاعد", en: "Rising", orders: 5, volume: 150, rating: 4.2, onTime: 85, badge: "border-[#10b981]/60 bg-[#10b981]/12 text-[#34d399]" },
  { level: 3, ar: "المتمكن", en: "Proven", orders: 15, volume: 600, rating: 4.5, onTime: 90, badge: "border-[#06b6d4]/60 bg-[#06b6d4]/12 text-[#22d3ee]" },
  { level: 4, ar: "المحترف", en: "Pro", orders: 40, volume: 2000, rating: 4.7, onTime: 93, badge: "border-[#3b82f6]/65 bg-[#3b82f6]/14 text-[#60a5fa] shadow-[0_0_22px_-8px_#3b82f6]" },
  { level: 5, ar: "الخبير", en: "Expert", orders: 90, volume: 5000, rating: 4.8, onTime: 95, badge: "border-[#a855f7]/65 bg-[#a855f7]/14 text-[#c084fc] shadow-[0_0_26px_-8px_#a855f7]" },
  { level: 6, ar: "النخبة", en: "Elite", orders: 200, volume: 12000, rating: 4.85, onTime: 97, badge: "border-[#f59e0b]/70 bg-[#f59e0b]/14 text-[#fbbf24] shadow-[0_0_30px_-8px_#f59e0b]" },
  { level: 7, ar: "الأستاذ", en: "Master", orders: 450, volume: 30000, rating: 4.9, onTime: 98, badge: "border-[#e2e8f0]/80 bg-gradient-to-r from-[#e2e8f0]/10 via-[#ffffff]/20 to-[#e2e8f0]/10 text-[#f8fafc] shadow-[0_0_34px_-8px_#e2e8f0]" },
  { level: 8, ar: "الهيمنة", en: "Dominance", orders: 800, volume: 60000, rating: 4.95, onTime: 99, badge: "border-[#e11d48]/80 bg-gradient-to-r from-[#150507] via-[#2a0a0f] to-[#150507] text-[#fb7185] shadow-[0_0_36px_-6px_rgba(225,29,72,0.55)]", aura: true },
];

export function tierFor(m: PrestigeMetrics): PrestigeTier {
  let current = PRESTIGE_TIERS[0]!;
  for (const t of PRESTIGE_TIERS) {
    if (m.orders >= t.orders && m.volume >= t.volume && m.rating >= t.rating && m.onTime >= t.onTime) current = t;
  }
  return current;
}

export function nextTier(current: PrestigeTier): PrestigeTier | null {
  return PRESTIGE_TIERS.find((t) => t.level === current.level + 1) ?? null;
}

const ratio = (value: number, target: number) => (target <= 0 ? 1 : Math.min(1, value / target));

/** Progress (0..100) toward the next tier, averaged across the four metrics. */
export function progressToNext(m: PrestigeMetrics, next: PrestigeTier | null): number {
  if (!next) return 100;
  const parts = [
    ratio(m.orders, next.orders),
    ratio(m.volume, next.volume),
    ratio(m.rating, next.rating),
    ratio(m.onTime, next.onTime),
  ];
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
}

/** Per-metric breakdown used by the dashboard tracker. */
export function metricBreakdown(m: PrestigeMetrics, next: PrestigeTier | null) {
  return [
    { key: "orders" as const, ar: "الطلبات", en: "Orders", value: m.orders, target: next?.orders ?? m.orders, pct: Math.round(ratio(m.orders, next?.orders ?? 0) * 100) },
    { key: "volume" as const, ar: "حجم التداول (USDT)", en: "Volume (USDT)", value: m.volume, target: next?.volume ?? m.volume, pct: Math.round(ratio(m.volume, next?.volume ?? 0) * 100) },
    { key: "rating" as const, ar: "التقييم", en: "Rating", value: m.rating, target: next?.rating ?? m.rating, pct: Math.round(ratio(m.rating, next?.rating ?? 0) * 100) },
    { key: "onTime" as const, ar: "الالتزام بالمواعيد %", en: "On-time rate %", value: m.onTime, target: next?.onTime ?? m.onTime, pct: Math.round(ratio(m.onTime, next?.onTime ?? 0) * 100) },
  ];
}
