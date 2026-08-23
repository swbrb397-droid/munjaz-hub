import { Printer, ShieldCheck, X } from "lucide-react";
import { QrCode } from "@/components/site/QrCode";

export type ReceiptData = {
  txId: string;
  orderId?: string;
  type: string;
  network: string;
  amount: string;
  status: string;
  date: string;
  fee?: string;
  gateway?: string;
};

/** Printable, high-contrast transaction receipt preview. */
export function ReceiptModal({ receipt, onClose }: { receipt: ReceiptData; onClose: () => void }) {
  const rows: [string, string][] = [
    ["رقم العملية (TxID)", receipt.txId],
    ...((receipt.orderId ? [["رقم الطلب (Order ID)", receipt.orderId]] : []) as [string, string][]),
    ["نوع المعاملة", receipt.type],
    ["الشبكة", receipt.network],
    ["وسيلة الدفع", receipt.gateway ?? "USDT"],
    ["المبلغ الإجمالي", receipt.amount],
    ["عمولة المنصة", receipt.fee ?? "0.00 USDT"],
    ["الحالة", receipt.status],
    ["التاريخ والوقت", receipt.date],
  ];


  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-background/85 p-4 backdrop-blur" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="min-w-0 truncate text-lg font-black">إيصال المعاملة 📄</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid size-8 shrink-0 place-items-center rounded-lg border border-border">
            <X className="size-4" />
          </button>
        </div>

        <div id="munjaz-receipt" className="mt-4 rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-3 border-b border-dashed border-border pb-3">
            <p className="text-sm font-black">الـمُـنْـجِـز</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-black text-primary-foreground">
              <ShieldCheck className="size-3" /> ضمان منصة مُنجز - معتمد ✅
            </span>

          </div>
          <dl className="mt-3 grid gap-2 text-xs">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3">
                <dt className="shrink-0 text-muted-foreground">{k}</dt>
                <dd className="min-w-0 break-all text-end font-mono font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-center gap-3 border-t border-dashed border-border pt-3">
            <QrCode value={`munjaz:receipt:${receipt.txId}`} size={84} />
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              امسح الرمز للتحقق من صحة الإيصال. هذا المستند صادر آلياً من نظام الضمان ولا يحتاج توقيعاً.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
        >
          <Printer className="size-4" /> طباعة / حفظ PDF
        </button>
      </div>
    </div>
  );
}
