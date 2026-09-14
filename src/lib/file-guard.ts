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
