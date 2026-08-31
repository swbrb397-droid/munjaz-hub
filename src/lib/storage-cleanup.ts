/**
 * One-time purge of legacy/mock client storage keys.
 * Genuine Supabase auth tokens (`sb-*-auth-token`) are always preserved.
 */
const OBSOLETE_KEYS = [
  "munjaz_user",
  "munjaz-user",
  "auth_user",
  "mock_token",
  "mock_user",
  "temp_session",
  "munjaz_mock_orders",
  "munjaz_mock_listings",
  "munjaz-demo-state",
] as const;

const OBSOLETE_PREFIXES = ["mock_", "munjaz_mock", "demo_"] as const;

function purge(store: Storage) {
  const doomed: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (!key) continue;
    if (key.startsWith("sb-")) continue; // Supabase session tokens
    if (
      (OBSOLETE_KEYS as ReadonlyArray<string>).includes(key) ||
      OBSOLETE_PREFIXES.some((p) => key.startsWith(p))
    ) {
      doomed.push(key);
    }
  }
  doomed.forEach((k) => store.removeItem(k));
}

export function cleanupLegacyStorage() {
  if (typeof window === "undefined") return;
  try {
    purge(window.localStorage);
    purge(window.sessionStorage);
  } catch {
    /* storage may be unavailable (private mode) */
  }
}
