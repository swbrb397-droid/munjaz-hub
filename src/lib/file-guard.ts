/** Shared MIME / extension integrity guards for every dropzone on the platform. */

export const DANGEROUS_EXTENSIONS = [
  "exe",
  "bat",
  "sh",
  "php",
  "js",
  "vbs",
  "msi",
  "cmd",
] as const;

export const EXECUTABLE_REJECTION =
  "نوع الملف غير مدعوم: يمنع رفع الملفات القابلة للتنفيذ لضمان سلامة وأمان المنصة";

export type UploadTier = "free" | "pro" | "corporate";

/** Single-file size ceiling per subscription tier, in megabytes. */
export function tierFileLimitMb(tier: string | null | undefined): number {
  if (tier === "corporate") return 2048;
  if (tier === "pro") return 500;
  return 50;
}

export function fileExtension(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? (parts.pop() ?? "") : "";
}

export function isDangerousFile(name: string): boolean {
  return (DANGEROUS_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

/**
 * Validates a single upload candidate.
 * Returns an Arabic error message, or null when the file is accepted.
 */
export function checkUpload(file: File, tier: string | null | undefined): string | null {
  if (isDangerousFile(file.name)) return EXECUTABLE_REJECTION;
  const limit = tierFileLimitMb(tier);
  if (file.size > limit * 1024 * 1024) {
    return `حجم الملف يتجاوز الحد المسموح لباقاتك (${limit}MB) — قم بترقية حسابك لرفع أحجام أكبر`;
  }
  return null;
}

const ARCHIVE_BLOCKED = ["exe", "bat", "cmd", "sh"];
export const ARCHIVE_REJECTION =
  "الملف المضغوط يحتوي على ملفات تنفيذية في جذره (exe / bat / cmd / sh) — يُمنع رفعها لحماية المشترين";

/**
 * Best-effort scan of a ZIP central directory for root-level executables.
 * Returns an Arabic error, or null when clean / not a ZIP / not parseable.
 */
export async function checkArchive(file: File): Promise<string | null> {
  if (fileExtension(file.name) !== "zip" || file.size < 22) return null;
  try {
    const tailSize = Math.min(file.size, 65_557);
    const tail = new DataView(await file.slice(file.size - tailSize).arrayBuffer());
    let eocd = -1;
    for (let i = tail.byteLength - 22; i >= 0; i--) {
      if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return null;
    const cdSize = tail.getUint32(eocd + 12, true);
    const cdOffset = tail.getUint32(eocd + 16, true);
    if (cdOffset === 0xffffffff || cdOffset + cdSize > file.size) return null; // ZIP64: skip
    const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
    const dec = new TextDecoder();
    let p = 0;
    while (p + 46 <= cd.byteLength && cd.getUint32(p, true) === 0x02014b50) {
      const nameLen = cd.getUint16(p + 28, true);
      const extraLen = cd.getUint16(p + 30, true);
      const commentLen = cd.getUint16(p + 32, true);
      const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
      const clean = name.replace(/^\.?\//, "");
      if (!clean.includes("/") && ARCHIVE_BLOCKED.includes(fileExtension(clean))) return ARCHIVE_REJECTION;
      p += 46 + nameLen + extraLen + commentLen;
    }
  } catch {
    return null;
  }
  return null;
}

/** Sync guard + archive scan in one call. */
export async function checkUploadDeep(file: File, tier: string | null | undefined): Promise<string | null> {
  return checkUpload(file, tier) ?? (await checkArchive(file));
}
