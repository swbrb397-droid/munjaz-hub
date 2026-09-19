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

// ---- Anti-gibberish free-text validation ---------------------------------
/** Same character repeated 4+ times in a row ("aaaa", "ننننن"). */
export const REPEAT_CHAR_RE = /(.)\1{3,}/;
/** Repeated 2-3 character syllable loops ("djdjdjdj", "نينينيني"). */
export const SYLLABLE_LOOP_RE = /(.{2,3})\1{3,}/;
/** One uninterrupted word longer than 25 characters. */
export const LONG_WORD_RE = /\S{26,}/;

/**
 * Validates that free text reads like real, descriptive language.
 * Returns an Arabic error message, or null when the text is acceptable.
 */
export function gibberishError(
  value: string,
  opts: { minLength: number; maxLength?: number; minWords?: number },
): string | null {
  const text = value.trim();
  const minWords = opts.minWords ?? 4;
  if (text.length < opts.minLength) return `النص يجب ألا يقل عن ${opts.minLength} حرفاً.`;
  if (opts.maxLength && text.length > opts.maxLength)
    return `النص يجب ألا يزيد على ${opts.maxLength} حرفاً.`;
  if (REPEAT_CHAR_RE.test(text)) return "النص يحتوي على تكرار غير مفهوم لنفس الحرف.";
  if (SYLLABLE_LOOP_RE.test(text)) return "النص يحتوي على مقاطع مكرّرة غير مفهومة — اكتب وصفاً حقيقياً.";
  if (LONG_WORD_RE.test(text)) return "لا يمكن أن تتجاوز الكلمة الواحدة 25 حرفاً متصلاً بدون مسافة.";
  const words = text.split(/\s+/).filter(Boolean);
  const distinct = new Set(words.map((w) => w.toLocaleLowerCase()));
  if (words.length < minWords || distinct.size < minWords)
    return `اكتب ${minWords} كلمات مختلفة على الأقل تصف الحالة بوضوح.`;
  return null;
}
