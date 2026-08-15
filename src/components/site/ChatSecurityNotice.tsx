import { ShieldCheck } from "lucide-react";
import { useLang } from "@/lib/lang";

/** Subtle in-chat banner warning against off-platform communication. */
export function ChatSecurityNotice() {
  const { tr } = useLang();
  return (
    <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
      <p>
        <span className="font-bold text-foreground">{tr("حماية المُنجَز:", "Al-Munjaz protection:")}</span>{" "}
        {tr(
          "أبقِ التواصل والدفع داخل المنصة. مشاركة أرقام الهاتف أو البريد أو حسابات التواصل تُلغي ضمان الوساطة وقد تؤدي لتعليق الحساب.",
          "Keep all communication and payments on-platform. Sharing phone numbers, emails, or social accounts voids escrow protection and may suspend your account.",
        )}
      </p>
    </div>
  );
}
