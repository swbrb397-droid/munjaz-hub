import { useEffect, useState } from "react";
import { FileCheck2, Loader2, PackageCheck, Timer, X } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/lang";
import { moderateFields } from "@/lib/chat-moderation";
import { useLinkDeliverable, useSendMessage, useUploadDeliverable } from "@/lib/workspace-data";
import { useOrderTransition } from "@/lib/orders";

/**
 * Official delivery: final file and/or link + a delivery note, then the order
 * flips to `delivered` (which starts the escrow inspection window server-side).
 */
export function DeliveryDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { tr, lang } = useLang();
  const upload = useUploadDeliverable(orderId);
  const link = useLinkDeliverable(orderId);
  const send = useSendMessage(orderId);
  const transition = useOrderTransition();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const valid = (!!file || /^https?:\/\/\S+/i.test(url.trim())) && note.trim().length >= 10;

  const submit = async () => {
    if (!valid || busy) return;
    const bad = moderateFields(note);
    if (bad) { toast.error(bad); return; }
    if (url.trim() && /(wa\.me|t\.me|telegram|whatsapp)/i.test(url)) { toast.error(tr("روابط تطبيقات المراسلة غير مسموحة", "Messaging-app links are not allowed")); return; }
    setBusy(true);
    try {
      if (file) await upload.mutateAsync({ file, isFinal: true });
      if (url.trim()) await link.mutateAsync({ link: url.trim(), isFinal: true });
      await send.mutateAsync({ body: `📦 ${tr("تسليم رسمي", "Official delivery")}:\n${note.trim()}`, lang });
      await transition.mutateAsync({ id: orderId, status: "delivered" });
      toast.success(tr("تم التسليم الرسمي — بدأت مهلة الفحص للمشتري", "Delivered — the buyer's inspection window has started"));
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("تعذّر إتمام التسليم", "Delivery failed"));
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-2 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-black"><PackageCheck className="size-5 text-primary" />{tr("التسليم الرسمي للعمل", "Official delivery")}</h2>
          <button type="button" aria-label={tr("إغلاق", "Close")} onClick={onClose} className="grid size-9 place-items-center rounded-lg border border-border"><X className="size-4" /></button>
        </div>
        <div className="grid gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 px-3 py-3 text-xs font-bold text-primary">
            <FileCheck2 className="size-4 shrink-0" />
            <span className="truncate">{file ? file.name : tr("اختر ملف التسليم النهائي", "Choose the final file")}</span>
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground">{tr("أو رابط العمل (Drive / Figma / GitHub)", "Or a work link (Drive / Figma / GitHub)")}</span>
            <input dir="ltr" className={field} value={url} maxLength={500} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground">{tr("رسالة التسليم وملاحظات الاستخدام", "Delivery note & usage instructions")}</span>
            <textarea className={`${field} min-h-28 resize-y`} maxLength={1500} value={note} onChange={(e) => setNote(e.target.value)} />
            <span className="text-[11px] text-muted-foreground"><bdi>{note.trim().length}</bdi> / 1500 · {tr("10 أحرف على الأقل", "10 characters min")}</span>
          </label>
          <p className="flex items-start gap-2 rounded-lg border border-border bg-surface/60 p-2 text-xs text-muted-foreground">
            <Timer className="mt-0.5 size-4 shrink-0 text-primary" />
            {tr("بعد التسليم تبدأ مهلة الفحص للمشتري؛ إن لم يعترض أو يطلب تعديلاً يُحرَّر المبلغ لك تلقائياً.", "After delivery the buyer's inspection window starts; without an objection or revision the funds are released to you automatically.")}
          </p>
          <button type="button" disabled={!valid || busy} onClick={() => void submit()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50">
            {busy && <Loader2 className="size-4 animate-spin" />}{tr("تأكيد التسليم الرسمي", "Confirm delivery")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Live countdown to the scheduled automatic escrow release. */
export function ReleaseCountdown({ at, hours, isBuyer }: { at: string; hours: number; isBuyer: boolean }) {
  const { tr } = useLang();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const end = new Date(at).getTime();
  const total = Math.max(1, hours) * 3_600_000;
  const left = Math.max(0, end - now);
  const pct = Math.min(100, Math.max(0, ((total - left) / total) * 100));
  const h = Math.floor(left / 3_600_000), m = Math.floor((left % 3_600_000) / 60_000);
  return (
    <div className="mt-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-bold"><Timer className="size-4 text-primary" />{tr("مهلة الفحص المتبقية", "Inspection time left")}</span>
        <bdi className="font-mono font-black text-primary">{left > 0 ? `${h}h ${m}m` : tr("جارٍ التحرير", "Releasing")}</bdi>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {isBuyer
          ? tr("راجع الملفات ثم اضغط «اعتماد واستلام» أو اطلب تعديلاً من بطاقة الملفات قبل انتهاء المهلة، وإلا يُحرَّر المبلغ للبائع تلقائياً.", "Review the files, then approve or request a revision before time runs out — otherwise funds auto-release to the seller.")
          : tr("سيُحرَّر المبلغ لك تلقائياً عند انتهاء المهلة ما لم يطلب المشتري تعديلاً أو يفتح نزاعاً.", "Funds release to you automatically when the window ends unless the buyer requests a revision or opens a dispute.")}
      </p>
    </div>
  );
}
