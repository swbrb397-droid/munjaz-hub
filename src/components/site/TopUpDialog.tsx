import { useCallback, useState } from "react";
import { Copy, CreditCard, ExternalLink, Loader2, Lock, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/site/Shell";
import { QrCode } from "@/components/site/QrCode";
import { useLang } from "@/lib/lang";
import { parseUsdt } from "@/lib/security";
import { useConfirmDeposit, useCreateDeposit } from "@/lib/deposits";
import {
  useCreateTopUp,
  useInvoiceRealtime,
  topUpErrorMessage,
  type TopUpInvoice,
  type TopUpMethod,
  type TopUpNetwork,
} from "@/lib/topup";

const nets: ReadonlyArray<{ value: TopUpNetwork; label: string }> = [
  { value: "trc20", label: "TRC-20" },
  { value: "bep20", label: "BEP-20" },
];

const PRESETS = [50, 100, 250, 500];

export function TopUpDialog({ onClose }: { onClose: () => void }) {
  const { tr, lang } = useLang();
  const [method, setMethod] = useState<TopUpMethod>("crypto");
  const [amount, setAmount] = useState("100");
  const [network, setNetwork] = useState<TopUpNetwork>("trc20");
  const [invoice, setInvoice] = useState<TopUpInvoice | null>(null);
  const [paid, setPaid] = useState(false);
  const createInvoice = useCreateTopUp();
  const createDeposit = useCreateDeposit();
  const confirmDeposit = useConfirmDeposit();

  const onPaid = useCallback(() => {
    setPaid(true);
    toast.success(tr("تم تأكيد الإيداع وإضافته لرصيدك ✅", "Deposit confirmed and credited ✅"));
  }, [tr]);

  useInvoiceRealtime(invoice && !invoice.simulated ? invoice.id : null, onPaid);

  const submit = () => {
    const value = parseUsdt(amount) ?? 0;
    createInvoice.mutate(
      { amount: value, network, method },
      {
        onSuccess: (data) => setInvoice(data),
        onError: (e: Error) => toast.error(topUpErrorMessage(e.message, lang === "ar")),
      },
    );
  };

  /** Preview fallback: credits the wallet through the normal deposit ledger. */
  const simulatePayment = () => {
    if (!invoice) return;
    createDeposit.mutate(
      { amount: invoice.amount_usdt, network: invoice.network },
      {
        onSuccess: (row) =>
          confirmDeposit.mutate(
            { id: row.id, txHash: `sim-${Math.random().toString(16).slice(2, 12)}` },
            { onSuccess: onPaid, onError: (e: Error) => toast.error(e.message) },
          ),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  const busy = createDeposit.isPending || confirmDeposit.isPending;

  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur">
      <Card className="my-4 w-full max-w-md px-4 sm:px-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h3 className="min-w-0 truncate font-black">{tr("شحن المحفظة (USDT)", "Top up wallet (USDT)")}</h3>
          <button onClick={onClose} aria-label={tr("إغلاق", "Close")} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border">
            <X className="size-4" />
          </button>
        </div>

        {!invoice ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-border p-1">
              {([
                ["crypto", tr("USDT كريبتو", "USDT crypto")],
                ["card", tr("بطاقة ودفع سريع", "Card & fast pay")],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMethod(k)}
                  aria-pressed={method === k}
                  className={`rounded-lg px-2 py-2 text-[11px] font-bold ${method === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>

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
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(String(p))}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${Number(amount) === p ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
                >
                  ${p}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-1.5">
              <span className="text-xs text-muted-foreground">
                {method === "crypto" ? tr("الشبكة", "Network") : tr("شبكة الاستلام بعد التحويل", "Settlement network")}
              </span>
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

            {method === "card" && (
              <p className="mt-3 flex gap-2 rounded-xl border border-accent/40 bg-accent/10 p-3 text-[11px] leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
                {tr(
                  "الدفع بالبطاقة (Visa / Mastercard / Apple Pay) يتم على صفحة الدفع المستضافة لدى مزوّد الدفع — لا يتم إدخال بيانات البطاقة داخل المنصة إطلاقاً، التزاماً بمعيار PCI-DSS.",
                  "Card payments (Visa / Mastercard / Apple Pay) happen on the provider's hosted checkout — card data never touches this platform, per PCI-DSS.",
                )}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={createInvoice.isPending || !(parseUsdt(amount) ?? 0)}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground disabled:opacity-50"
            >
              {createInvoice.isPending ? <Loader2 className="size-4 animate-spin" /> : method === "card" ? <CreditCard className="size-4" /> : <Sparkles className="size-4" />}
              {method === "card" ? tr("متابعة إلى الدفع الآمن", "Continue to secure checkout") : tr("إنشاء فاتورة الدفع", "Generate payment invoice")}
            </button>
            <p className="mt-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <Lock className="size-3.5 text-primary" />
              {tr("يُضاف الرصيد تلقائياً فور تأكيد الدفع.", "Your balance is credited automatically once payment is confirmed.")}
            </p>
          </>
        ) : (
          <div className="mt-4 grid gap-3">
            {invoice.pay_address && (
              <div className="grid place-items-center rounded-xl border border-border p-5">
                <QrCode value={invoice.pay_address} size={168} />
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
            )}

            <p className="text-center text-sm">
              <span className="font-black text-primary">{invoice.amount_usdt}</span> USDT · {invoice.network.toUpperCase()}
            </p>

            {invoice.pay_url && (
              <a
                href={invoice.pay_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
              >
                <ExternalLink className="size-4" /> {tr("فتح صفحة الدفع الآمنة", "Open secure checkout")}
              </a>
            )}

            {invoice.simulated && !paid && (
              <div className="grid gap-2 rounded-xl border border-accent/40 bg-accent/10 p-3 text-[11px]">
                <p className="flex gap-2 font-bold text-accent">
                  <Zap className="mt-0.5 size-3.5 shrink-0" />
                  {tr("وضع المعاينة — بوابة الدفع غير مربوطة بعد.", "Preview mode — the payment gateway isn't connected yet.")}
                </p>
                <button
                  type="button"
                  onClick={simulatePayment}
                  disabled={busy}
                  className="rounded-lg border border-border px-3 py-2 font-bold disabled:opacity-60"
                >
                  {busy ? tr("جارٍ المحاكاة…", "Simulating…") : tr("محاكاة إتمام الدفع وشحن الرصيد", "Simulate a completed payment")}
                </button>
              </div>
            )}

            <p
              className={`rounded-xl border px-3 py-2 text-center text-xs font-bold ${
                paid ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {paid
                ? tr("تم استلام الدفعة وتحديث رصيدك ✅", "Payment received — balance updated ✅")
                : tr("بانتظار تأكيد الدفع… سيتم تحديث الرصيد تلقائياً ⏳", "Waiting for payment confirmation… balance updates automatically ⏳")}
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
