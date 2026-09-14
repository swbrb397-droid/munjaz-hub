/** Public-surface identity masking (SEC-03): usernames become `usr_***98`. */
export function maskUser(seed: string | null | undefined): string {
  const base = (seed ?? "").replace(/[^a-zA-Z0-9]/g, "");
  if (!base) return "usr_***00";
  return `usr_***${base.slice(-2).toUpperCase()}`;
}
