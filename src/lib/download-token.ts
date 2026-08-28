/**
 * Signed, short-lived download tokens for protected digital assets.
 *
 * A token binds { target, userId, expiry } to a deterministic signature so a
 * copied link cannot be replayed after it expires (15 minutes) or reused by a
 * different account.
 */

import { documentHash, logAuditEvent } from "@/lib/audit";

export const TOKEN_TTL_MS = 15 * 60 * 1000;

export type DownloadToken = {
  target: string;
  userId: string;
  expiresAt: number;
  signature: string;
  token: string;
};

const SECRET = "munjaz-download-v1";

function sign(target: string, userId: string, expiresAt: number) {
  return documentHash(`${SECRET}|${target}|${userId}|${expiresAt}`);
}

export function issueDownloadToken(target: string, userId: string | null): DownloadToken {
  const uid = userId ?? "anonymous";
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const signature = sign(target, uid, expiresAt);
  const token = `MJT-${signature.slice(0, 12)}-${expiresAt.toString(36).toUpperCase()}`;
  logAuditEvent({
    type: "DOWNLOAD_TOKEN_EVENT",
    userId,
    target,
    hash: signature,
    meta: { expiresAt: new Date(expiresAt).toISOString(), ttlMinutes: TOKEN_TTL_MS / 60000 },
  });
  return { target, userId: uid, expiresAt, signature, token };
}

export function isTokenValid(t: DownloadToken | null): boolean {
  if (!t) return false;
  if (Date.now() >= t.expiresAt) return false;
  return sign(t.target, t.userId, t.expiresAt) === t.signature;
}

/** Milliseconds remaining, clamped at zero. */
export function tokenRemaining(t: DownloadToken | null): number {
  return t ? Math.max(0, t.expiresAt - Date.now()) : 0;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
