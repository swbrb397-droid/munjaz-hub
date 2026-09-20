import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { useLang } from "@/lib/lang";

/** Subtle in-chat banner warning against off-platform communication. */
export function ChatSecurityNotice() {
  const { tr } = useLang();
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed)
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-bold text-primary"
      >
        <ShieldCheck className="size-3.5" /> {tr("حماية المنجز", "Al-Munjaz protection")}
      </button>
    );

  return (
    <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1">
        <span className="font-bold text-foreground">{tr("حماية المنجز:", "Al-Munjaz protection:")}</span>{" "}
        {tr(
          "أبقِ التواصل والدفع داخل المنصة. مشاركة أرقام الهاتف أو البريد أو حسابات التواصل تُلغي ضمان الوساطة وقد تؤدي لتعليق الحساب.",
          "Keep all communication and payments on-platform. Sharing phone numbers, emails, or social accounts voids escrow protection and may suspend your account.",
        )}
      </p>
      <button
        type="button"
        onClick={() => setCollapsed(true)}
        aria-label={tr("طيّ التنبيه", "Collapse notice")}
        className="grid size-6 shrink-0 place-items-center rounded-md border border-border/60 text-muted-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
