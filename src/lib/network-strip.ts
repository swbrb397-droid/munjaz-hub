/** Static USDT peg + network fee reference strip (not user or order data). */
export const NETWORK_STRIP = [
  { pair: "USDT/USD", value: "1.0002", change: "+0.01%" },
  { pair: "USDT/SAR", value: "3.7506", change: "-0.02%" },
  { pair: "USDT/AED", value: "3.6731", change: "+0.00%" },
  { pair: "USDT/EUR", value: "0.9184", change: "+0.12%" },
  { pair: "TRC-20", value: "0.00 USDT", change: "internal" },
  { pair: "BEP-20", value: "0.12 USDT", change: "network" },
] as const;
