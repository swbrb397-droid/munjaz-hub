import { useState } from "react";
import { Code2, Gamepad2, GraduationCap, Package } from "lucide-react";

const CATEGORY_ICON = {
  freelance: Code2,
  course: GraduationCap,
  product: Package,
  gaming: Gamepad2,
} as const;

export type CoverCategory = keyof typeof CATEGORY_ICON;

/**
 * Cover renderer with a sleek gradient placeholder fallback.
 * Never renders a broken <img>: a missing src or a load error swaps to the placeholder.
 */
export function CoverImage({
  src,
  alt,
  category,
  className = "",
  iconClassName = "size-8",
}: {
  src?: string | null | undefined;
  alt: string;
  category?: string | undefined;
  className?: string | undefined;
  iconClassName?: string | undefined;
}) {
  const [failed, setFailed] = useState(false);
  const clean = (src ?? "").trim();
  const Icon = CATEGORY_ICON[(category ?? "") as CoverCategory] ?? Package;

  if (!clean || failed) {
    return (
      <div
        className={`grid place-items-center bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_22%,transparent),color-mix(in_oklab,var(--violet)_26%,transparent))] ${className}`}
        role="img"
        aria-label={alt}
      >
        <Icon className={`${iconClassName} text-primary/70`} />
      </div>
    );
  }

  return (
    <img
      src={clean}
      alt={alt}
      loading="lazy"
      width={768}
      height={512}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
