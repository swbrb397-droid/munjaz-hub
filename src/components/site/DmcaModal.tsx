import { useState } from "react";
import { toast } from "sonner";
import { Scale, X } from "lucide-react";
import { supabase } from "@/lib/cloud-client";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/lang";
import { sanitizeText } from "@/lib/security";

/**
 * DMCA / intellectual-property takedown report.
 * Files a real `dispute_cases` row so the compliance queue picks it up.
 */
export function DmcaModal({ listingRef, onClose }: { listingRef?: string; onClose: () => void }) {
  const { tr } = useLang();
  const { user } = useAuth();
  const [work, setWork] = useState("");
  const [proof, setProof] = useState("");
  const [detail, setDetail] = useState("");
  const [sworn, setSworn] = useState(false);
  const [sending, setSending] = useState(false);

  const valid = work.trim().length >= 3 && detail.trim().length >= 20 && sworn;

  const submit = async () => {
    if (!user) {
      toast.error(tr("سجّل الدخول لتقديم بلاغ رسمي.", "Please sign in to file an official report."));
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.from("dispute_cases").insert({
        kind: "dispute",
        raised_by: user.id,
        reason: sanitizeText(
          `DMCA — ${work} | ${listingRef ? `عرض: ${listingRef} | ` : ""}${detail}`,
          2000,
        ),
        evidence: [{ type: "dmca", work: sanitizeText(work, 200), proof: sanitizeText(proof, 500) }],
      });
      if (error) throw error;
      toast.success(
        tr(
          "تم تسجيل بلاغ انتهاك الملكية الفكرية وإحالته لفريق الامتثال.",
          "Your IP infringement report was filed and routed to the compliance team.",
        ),
      );
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const field =
    "w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary";

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-background/85 p-4 backdrop-blur"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="flex min-w-0 items-center gap-2 truncate text-base font-black">
            <Scale className="size-4 shrink-0 text-accent" />
            {tr("الإبلاغ عن انتهاك ملكية فكرية ⚖️", "Report IP infringement ⚖️")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr("إغلاق", "Close")}
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-border"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1.5 text-xs font-bold">
            {tr("العمل المحمي محل الانتهاك", "Protected work being infringed")}
            <input value={work} onChange={(e) => setWork(e.target.value)} className={field} />
          </label>
          <label className="grid gap-1.5 text-xs font-bold">
            {tr("رابط إثبات الملكية (اختياري)", "Proof-of-ownership link (optional)")}
            <input
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              dir="ltr"
              className={field}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-bold">
            {tr("تفاصيل البلاغ", "Report details")}
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={4}
              className={field}
            />
          </label>
          <label className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <input
              type="checkbox"
              checked={sworn}
              onChange={(e) => setSworn(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            {tr(
              "أقر تحت طائلة المسؤولية القانونية بأنني المالك الشرعي للحقوق أو مفوّض بالتصرف نيابة عنه، وأن المعلومات الواردة صحيحة.",
              "I declare under penalty of law that I am the rights owner or authorised to act on their behalf, and that this information is accurate.",
            )}
          </label>
          <button
            type="button"
            disabled={!valid || sending}
            onClick={() => void submit()}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            {sending ? tr("جارٍ الإرسال…", "Submitting…") : tr("إرسال البلاغ الرسمي", "File report")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Inline trigger used in the footer and on listing cards. */
export function DmcaTrigger({
  listingRef,
  className = "",
}: {
  listingRef?: string;
  className?: string;
}) {
  const { tr } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-[44px] items-center gap-1.5 text-xs transition-colors hover:text-foreground ${className}`}
      >
        <Scale className="size-3.5" />
        {tr("الإبلاغ عن انتهاك ملكية فكرية ⚖️", "Report IP infringement ⚖️")}
      </button>
      {open && <DmcaModal {...(listingRef ? { listingRef } : {})} onClose={() => setOpen(false)} />}
    </>
  );
}
