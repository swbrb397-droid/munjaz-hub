/** End-to-end referral attribution: capture `?ref=` once, attach it at sign-up. */
export const REFERRAL_KEY = "munjaz_referral_code";

function normalize(code: string) {
  return code.trim().toUpperCase().slice(0, 32);
}

/** Reads `?ref=` from the current URL and persists it for the sign-up flow. */
export function captureReferralFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const raw = new URLSearchParams(window.location.search).get("ref");
    if (!raw) return;
    const code = normalize(raw);
    if (code) window.localStorage.setItem(REFERRAL_KEY, code);
  } catch {
    /* storage disabled — referral attribution is best-effort */
  }
}

export function storedReferralCode(): string {
  if (typeof window === "undefined") return "";
  try {
    return normalize(window.localStorage.getItem(REFERRAL_KEY) ?? "");
  } catch {
    return "";
  }
}

export function clearStoredReferralCode() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REFERRAL_KEY);
  } catch {
    /* ignore */
  }
}
