/** Factual network fee reference for USDT rails (no simulated market prices). */
export const NETWORK_STRIP = [
  { pair: "USDT · TRC-20", value: "~1 USDT", change: "رسوم الشبكة" },
  { pair: "USDT · BEP-20", value: "~0.3 USDT", change: "رسوم الشبكة" },
  { pair: "USDT · Polygon", value: "~0.1 USDT", change: "رسوم الشبكة" },
  { pair: "الضمان الداخلي", value: "0 USDT", change: "بدون رسوم تحويل داخلي" },
] as const;
