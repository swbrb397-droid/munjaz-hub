/**
 * Lightweight client-side audit event bus.
 *
 * Events are buffered in sessionStorage and re-broadcast on `window` so any
 * listener (admin console, support widget) can react without a round-trip.
 */

export type AuditEventType =
  | "PDF_DOWNLOAD_EVENT"
  | "ASSET_DOWNLOAD_EVENT"
  | "TRANSLATION_CACHE_EVENT"
  | "DOWNLOAD_TOKEN_EVENT"
  | "DISPUTE_FLAG";

export type AuditEvent = {
  type: AuditEventType;
  userId: string | null;
  at: string;
  /** Target document / asset identifier. */
  target: string;
  /** Verification hash of the target document. */
  hash?: string;
  meta?: Record<string, string | number | boolean>;
};

const KEY = "munjaz-audit-events";

export function logAuditEvent(event: Omit<AuditEvent, "at">): AuditEvent {
  const full: AuditEvent = { ...event, at: new Date().toISOString() };
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as AuditEvent[]) : [];
    list.push(full);
    window.sessionStorage.setItem(KEY, JSON.stringify(list.slice(-200)));
    window.dispatchEvent(new CustomEvent("munjaz:audit", { detail: full }));
  } catch {
    /* storage unavailable */
  }
  return full;
}

export function readAuditEvents(): AuditEvent[] {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuditEvent[]) : [];
  } catch {
    return [];
  }
}

/** Deterministic 64-bit-ish document fingerprint (hex) used as the PDF verification hash. */
export function documentHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c + i, 2246822519) >>> 0;
  }
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).toUpperCase();
}
