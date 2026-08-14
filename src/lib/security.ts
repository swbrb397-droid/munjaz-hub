// Client-side input sanitization + throttling helpers.
// Server-side validation (RPC functions with SECURITY DEFINER) remains the
// authoritative boundary — this layer only reduces obviously bad input.

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const HTML_CHARS = /[<>]/g;
const SQL_META = /(--|\/\*|\*\/|;|\bunion\s+select\b|\bdrop\s+table\b)/gi;

/** Strip HTML/script and SQL meta characters from free-text input. */
export function sanitizeText(value: string, maxLength = 500): string {
  return value
    .replace(CONTROL_CHARS, "")
    .replace(HTML_CHARS, "")
    .replace(SQL_META, "")
    .trim()
    .slice(0, maxLength);
}

/** Wallet addresses are alphanumeric only. */
export function sanitizeAddress(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").slice(0, 64);
}

export function isValidAddress(value: string): boolean {
  const a = sanitizeAddress(value);
  return a.length >= 26 && a.length <= 64;
}

/** Parse a USDT amount safely: max 6 decimals, finite, positive. */
export function parseUsdt(value: string): number | null {
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!/^\d*(\.\d{0,6})?$/.test(cleaned) || cleaned === "" || cleaned === ".") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000_000) return null;
  return Math.round(n * 1e6) / 1e6;
}

export function formatUsdt(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/** Simple client-side throttle for financial endpoints (brute-force guard). */
const hits = new Map<string, number[]>();

export function throttle(action: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(action) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    hits.set(action, list);
    return false;
  }
  list.push(now);
  hits.set(action, list);
  return true;
}
