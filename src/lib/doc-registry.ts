/**
 * Local registry of stamped documents so the public /verify page can resolve a
 * verification hash back to its authenticity metadata.
 */

export type StampedDoc = {
  hash: string;
  docType: string;
  reference: string;
  issuedAt: string;
  target: string;
};

const KEY = "munjaz-doc-registry";

function readAll(): Record<string, StampedDoc> {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, StampedDoc>) : {};
  } catch {
    return {};
  }
}

export function registerDocument(doc: StampedDoc) {
  try {
    const all = readAll();
    all[doc.hash.toUpperCase()] = doc;
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

export function lookupDocument(hash: string): StampedDoc | null {
  const key = hash.trim().toUpperCase();
  if (!key) return null;
  return readAll()[key] ?? null;
}

export function listDocuments(): StampedDoc[] {
  return Object.values(readAll()).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}
