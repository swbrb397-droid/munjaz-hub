/**
 * Storage access that can never throw.
 *
 * In private/incognito windows, inside cross-origin iframes, or when the user
 * blocks third-party storage, merely touching `window.localStorage` throws a
 * SecurityError. An unguarded read during render or in an effect bubbles up to
 * the root error boundary and blanks the whole app, so every access in the
 * codebase goes through these helpers.
 */

type Kind = "local" | "session";

function store(kind: Kind): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function safeGet(kind: Kind, key: string): string | null {
  try {
    return store(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeSet(kind: Kind, key: string, value: string): void {
  try {
    store(kind)?.setItem(key, value);
  } catch {
    /* storage unavailable — non-critical */
  }
}

export function safeRemove(kind: Kind, key: string): void {
  try {
    store(kind)?.removeItem(key);
  } catch {
    /* storage unavailable — non-critical */
  }
}

export const localGet = (key: string) => safeGet("local", key);
export const localSet = (key: string, value: string) => safeSet("local", key, value);
export const localRemove = (key: string) => safeRemove("local", key);
export const sessionGet = (key: string) => safeGet("session", key);
export const sessionSet = (key: string, value: string) => safeSet("session", key, value);
export const sessionRemove = (key: string) => safeRemove("session", key);
