import { BadgeCheck } from "lucide-react";
import { useLang } from "@/lib/lang";

export function VerifiedBadge({ label = true }: { label?: boolean }) {
  const { t } = useLang();
  return (
    <span
      title={t("verified")}
      className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400"
    >
      <BadgeCheck className="size-3.5" />
      {label && <span className="hidden sm:inline">{t("verified")}</span>}
    </span>
  );
}
