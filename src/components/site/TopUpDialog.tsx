import { useCallback, useState } from "react";
import { Copy, ExternalLink, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/site/Shell";
import { QrCode } from "@/components/site/QrCode";
import { useLang } from "@/lib/lang";
import { parseUsdt } from "@/lib/security";
import { useCreateTopUp, useInvoiceRealtime, topUpErrorMessage, type TopUpInvoice, type TopUpNetwork } from "@/lib/topup";

const nets: ReadonlyArray<{ value: TopUpNetwork; label: string }> = [
  { value: "trc20", label: "TRC-20" },
  { value: "bep20", label: "BEP-20" },
];

export function TopUpDialog({ onClose }: { onClose: () => void }) {
  const { tr, lang } = useLang();
  const [amount, setAmount] = useState("100");
  const [network, setNetwork] = useState<TopUpNetwork>("trc20");
  const [invoice, setInvoice] = useState<TopUpInvoice | null>(null);
  const [paid, setPaid] = useState(false);
  const createInvoice = useCreateTopUp();

  const onPaid = useCallback(() => {
    setPaid(true);
    toast.success(tr("تم تأكيد الإيداع وإضافته لرصيدك ✅", "Deposit confirmed and credited ✅"));
  }, [tr]);

  useInvoiceRealtime(invoice?.id ?? null, onPaid);

  const submit = () => {
    const value = parseUsdt(amount) ?? 0;
    createInvoice.mutate(
      { amount: value, network },
      {
        onSuccess: (data) => setInvoice(data),
        onError: (e: Error) => toast.error(topUpErrorMessage(e.message, lang === "ar")),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur">
      <Card className="my-4 w-full max-w-md px-4 sm:px-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h3 className="min-w-0 truncate font-black">{tr("شحن الرصيد (USDT)", "Top up balance (USDT)")}</h3>
          <button onClick={onClose} aria-label={tr("إغلاق", "Close")} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border">
            <X className="size-4" />
          </button>
        </div>

        {!invoice ? (
          <>
            <label className="mt-4 grid gap-1.5 text-sm">
              <span className="text-xs text-muted-foreground">{tr("المبلغ المطلوب (USDT)", "Amount (USDT)")}</span>
              <input
                value={amount}
                dir="ltr"
                inputMode="decimal"
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary"
              />
            </label>

            <div className="mt-4 grid gap-1.5">
              <span className="text-xs text-muted-foreground">{tr("الشبكة", "Network")}</span>
              <div className="flex gap-2">
                {nets.map((n) => (
                  <button
                    key={n.value}
                    type="button"
                    onClick={() => setNetwork(n.value)}
                    aria-pressed={network === n.value}
                    className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold ${
                      network === n.value ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
                    }`}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={createInvoice.isPending || !(parseUsdt(amount) ?? 0)}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground disabled:opacity-50"
            >
              {createInvoice.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {tr("إنشاء فاتورة الدفع", "Generate payment invoice")}
            </button>
            <p className="mt-3 text-[11px] text-muted-foreground">
              {tr(
                "يُضاف الرصيد تلقائياً فور تأكيد التحويل على الشبكة — دون أي خطوة يدوية.",
                "Your balance is credited automatically once the transfer is confirmed on-chain — no manual step.",
              )}
            </p>
          </>
        ) : (
          <div className="mt-4 grid gap-3">
            <div className="grid place-items-center rounded-xl border border-border p-5">
              {invoice.pay_address && <QrCode value={invoice.pay_address} size={168} />}
              <p className="mt-3 break-all text-center font-mono text-[11px] text-muted-foreground">{invoice.pay_address}</p>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(invoice.pay_address ?? "");
                  toast.success(tr("تم نسخ العنوان", "Address copied"));
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs"
              >
                <Copy className="size-3.5" /> {tr("نسخ العنوان", "Copy address")}
              </button>
            </div>

            <p className="text-center text-sm">
              <span className="font-black text-primary">{invoice.amount_usdt}</span> USDT · {invoice.network.toUpperCase()}
            </p>

            {invoice.pay_url && (
              <a
                href={invoice.pay_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-bold text-primary"
              >
                <ExternalLink className="size-4" /> {tr("فتح صفحة الدفع", "Open payment page")}
              </a>
            )}

            <p
              className={`rounded-xl border px-3 py-2 text-center text-xs font-bold ${
                paid ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {paid
                ? tr("تم استلام الدفعة وتحديث رصيدك ✅", "Payment received — balance updated ✅")
                : tr("بانتظار تأكيد الشبكة… سيتم تحديث الرصيد تلقائياً ⏳", "Waiting for network confirmation… balance updates automatically ⏳")}
            </p>

            <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-bold">
              {tr("إغلاق", "Close")}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
