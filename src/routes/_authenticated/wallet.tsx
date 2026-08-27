import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, BadgeCheck, Copy, FileText, Lock, ShieldAlert, Timer, X } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { QrCode } from "@/components/site/QrCode";
import { ReceiptModal, type ReceiptData } from "@/components/site/ReceiptModal";
import { FiatOnRamp } from "@/components/site/FiatOnRamp";
import { useLang } from "@/lib/lang";
import { useProfile, useTransactions, useWallet } from "@/lib/queries";
import {
  MIN_WITHDRAWAL,
  WITHDRAWAL_FEE,
  slaHoursForTier,
  useMyWithdrawals,
  useRequestWithdrawal,
  withdrawalErrorMessage,
  type WithdrawalNetwork,
} from "@/lib/withdrawals";
import { formatUsdt, parseUsdt } from "@/lib/security";
import { PayoutSecurityCard } from "@/components/site/PayoutSecurityCard";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "المحفظة الداخلية USDT | الـمُـنْـجِـز" },
      { name: "description", content: "أودع واسحب USDT عبر TRC-20 و BEP-20 و Polygon، وتابع سجل المعاملات والمبالغ المحجوزة في الضمان." },
      { property: "og:title", content: "المحفظة الداخلية USDT | الـمُـنْـجِـز" },
      { property: "og:description", content: "إيداع وسحب USDT بدون رسوم داخلية مع سحب فوري للحسابات الموثقة." },
    ],
  }),
  component: WalletPage,
});

const networks = [
  { value: "trc20", label: "TRC-20" },
  { value: "bep20", label: "BEP-20" },
  { value: "polygon", label: "Polygon" },
] as const;

const rates: Record<string, number> = { USD: 1.0002, SAR: 3.7506, AED: 3.6731, EUR: 0.9184 };

type FiatRow = { id: string; type: string; network: string; amount: number; status: string; created_at: string; txId: string };

function WalletPage() {
  const { tr, lang } = useLang();
  const wallet = useWallet();
  const profile = useProfile();
  const txs = useTransactions();
  const requests = useMyWithdrawals();

  const [deposit, setDeposit] = useState(false);
  const [depositTab, setDepositTab] = useState<"crypto" | "fiat">("crypto");
  const [network, setNetwork] = useState<WithdrawalNetwork>("polygon");
  const gasRows = useMemo(() => gasEstimates(), []);

  const [amount, setAmount] = useState("250");
  const [address, setAddress] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [fiatRows, setFiatRows] = useState<FiatRow[]>([]);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [lockLeft, setLockLeft] = useState(15 * 60);

  useEffect(() => {
    if (!deposit || depositTab !== "crypto") return;
    setLockLeft(15 * 60);
    const t = setInterval(() => setLockLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [deposit, depositTab]);

  const credited = fiatRows.reduce((s, r) => s + r.amount, 0);
  const balance = Number(wallet.data?.available_usdt ?? 0) + credited;
  const locked = Number(wallet.data?.locked_usdt ?? 0);
  const tier = (profile.data as { account_tier?: string } | null)?.account_tier ?? "free";
  const frozen = Boolean((profile.data as { is_frozen?: boolean } | null)?.is_frozen);
  const sla = slaHoursForTier(tier);
  const parsed = parseUsdt(amount) ?? 0;

  const withdraw = useRequestWithdrawal();

  const submit = () => {
    setFeedback(null);
    withdraw.mutate(
      { amount, network, address },
      {
        onSuccess: () =>
          setFeedback(
            tr(
              `تم استلام الطلب — المعالجة خلال ${sla} ساعة.`,
              `Request received — processing within ${sla} hours.`,
            ),
          ),
        onError: (e: Error) => setFeedback(withdrawalErrorMessage(e.message, lang === "ar")),
      },
    );
  };


  return (
    <Section
      title={tr("المحفظة الداخلية", "Internal wallet")}
      subtitle={tr("جميع الأرصدة بعملة USDT — تحويلات داخلية بدون رسوم غاز", "All balances in USDT — internal transfers with no gas fees")}
      action={
        <button onClick={() => setDeposit(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground glow">
          <ArrowDownToLine className="size-4" /> {tr("إيداع", "Deposit")}
        </button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="glow lg:col-span-1">
          <p className="text-sm text-muted-foreground">{tr("الرصيد المتاح", "Available balance")}</p>
          <p className="mt-1 text-4xl font-black text-primary">{balance.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">USDT</p>
          <p className="mt-2 text-xs text-muted-foreground">{tr("محجوز في الضمان", "Held in escrow")}: {locked.toLocaleString()} USDT</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {Object.entries(rates).map(([c, r]) => (
              <div key={c} className="rounded-lg border border-border px-3 py-2">
                <span className="text-muted-foreground">{c}</span>
                <p className="font-semibold">≈ {(balance * r).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 inline-flex items-center gap-1 text-xs text-primary">
            <BadgeCheck className="size-4" />
            {profile.data?.is_verified
              ? tr("حساب موثق — سحب فوري مفعّل", "Verified account — instant withdrawal enabled")
              : tr("حساب غير موثق — السحب مجدول", "Unverified account — scheduled withdrawal")}
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="flex items-center gap-2 font-bold"><ArrowUpFromLine className="size-4 text-accent" /> {tr("طلب سحب", "Withdrawal request")}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 font-bold uppercase text-accent">{tier}</span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Timer className="size-3.5" />
              {tr(`المعالجة الآلية خلال ${sla} ساعة`, `AI processing within ${sla} hours`)}
            </span>
          </div>

          {frozen && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <ShieldAlert className="size-4" />
              {tr("الحساب مجمّد أمنياً — السحب معطّل حتى مراجعة الإدارة.", "Account frozen for security — withdrawals are disabled pending admin review.")}
            </p>
          )}

          <div className="mt-4 grid gap-2">
            <p className="text-xs font-bold text-muted-foreground">
              {tr("مُحسِّن رسوم الشبكة (Gas Optimizer) — اختر الشبكة الأوفر", "Network gas optimizer — pick the cheapest route")}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {gasRows.map((g) => {
                const selected = network === g.value;
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setNetwork(g.value as WithdrawalNetwork)}
                    aria-pressed={selected}
                    className={`grid min-w-0 gap-1 rounded-xl border px-3 py-2.5 text-start transition-colors ${
                      selected ? "border-primary bg-primary/15" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-black">{g.label}</span>
                      {g.tone === "best" && (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-black text-primary-foreground">
                          {tr("موصى بها · رسوم فائقة الانخفاض ⚡", "Recommended · ultra-low ⚡")}
                        </span>
                      )}
                      {g.tone === "high" && (
                        <span className="rounded-full border border-destructive/50 px-1.5 py-0.5 text-[9px] font-black text-destructive">
                          {tr("رسوم أعلى", "Higher fee")}
                        </span>
                      )}
                    </span>
                    <span className={`font-mono text-[11px] font-bold ${g.tone === "best" ? "text-primary" : "text-muted-foreground"}`} dir="ltr">
                      ≈ {g.fee.toFixed(3)} USDT
                    </span>
                    <span className="text-[10px] text-muted-foreground">{tr(g.etaAr, g.etaEn)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-muted-foreground">{tr("الشبكة", "Network")}</span>
              <select value={network} onChange={(e) => setNetwork(e.target.value as WithdrawalNetwork)} className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary">
                {networks.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-muted-foreground">{tr(`المبلغ (USDT) — الحد الأدنى ${MIN_WITHDRAWAL}`, `Amount (USDT) — min ${MIN_WITHDRAWAL}`)}</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" maxLength={16} className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary" />
            </label>
            <label className="grid gap-2 text-sm sm:col-span-2">
              <span className="text-muted-foreground">{tr("عنوان المحفظة", "Wallet address")}</span>
              <input value={address} onChange={(e) => setAddress(e.target.value.replace(/[^A-Za-z0-9]/g, ""))} placeholder="T… / 0x…" maxLength={64} className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary" />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/60 p-4 text-sm">
            <span className="text-muted-foreground">
              {tr("الرسوم:", "Fee:")} <span className="text-foreground">{WITHDRAWAL_FEE} USDT</span>
              {" · "}
              {tr("الصافي:", "Net:")} <span className="text-foreground">{formatUsdt(Math.max(0, parsed - WITHDRAWAL_FEE))} USDT</span>
            </span>
            <button
              onClick={submit}
              disabled={withdraw.isPending || frozen}
              className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-60"
            >
              {tr("تأكيد السحب", "Confirm withdrawal")}
            </button>
          </div>
          {feedback && <p className="mt-3 text-xs text-primary">{feedback}</p>}
          <p className="mt-3 text-xs text-muted-foreground">
            {tr(
              "الطلبات ذات درجة خطورة مرتفعة تُحال تلقائياً لمراجعة بشرية، وتُحجز الأموال حتى إتمام التحويل.",
              "High risk-score requests are routed automatically to human review; funds stay locked until payout completes.",
            )}
          </p>
        </Card>
      </div>

      <PayoutSecurityCard className="mt-6" />

      <Card className="mt-6">
        <h3 className="flex items-center gap-2 font-bold"><Lock className="size-4 text-accent" /> {tr("قائمة طلبات السحب", "Withdrawal queue")}</h3>
        <div className="mt-4 grid gap-3">
          {(requests.data ?? []).length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {tr("لا توجد طلبات سحب.", "No withdrawal requests yet.")}
            </p>
          )}
          {(requests.data ?? []).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4 text-sm">
              <div className="min-w-40">
                <p className="font-semibold">{formatUsdt(r.amount_usdt)} USDT · {r.network}</p>
                <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
              </div>
              <span className="rounded-lg border border-border px-2.5 py-1 text-xs">{r.status}</span>
              <span className="text-xs text-muted-foreground">
                {tr("درجة الخطورة", "Risk score")}: {Number(r.risk_score)}
              </span>
              {r.process_by && (
                <span className="ms-auto text-xs text-muted-foreground">
                  {tr("المعالجة قبل", "Process by")} {new Date(r.process_by).toLocaleString()}
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>


      <Card className="mt-6">
        <h3 className="font-bold">{tr("سجل المعاملات", "Transaction history")}</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-start text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                {[tr("النوع", "Type"), tr("الشبكة", "Network"), tr("المبلغ", "Amount"), tr("الحالة", "Status"), tr("التاريخ", "Date"), tr("الإيصال", "Receipt")].map((h) => (
                  <th key={h} className="py-2 text-start font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fiatRows.map((t) => (
                <tr key={t.id} className="border-b border-border/60">
                  <td className="py-3 font-bold">{t.type}</td>
                  <td className="text-muted-foreground">{t.network}</td>
                  <td className="font-semibold text-primary">+{t.amount} USDT</td>
                  <td className="text-primary">{t.status}</td>
                  <td className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        setReceipt({
                          txId: t.txId,
                          orderId: t.id,
                          type: t.type,
                          network: t.network,
                          gateway: t.network,
                          amount: `${t.amount} USDT`,
                          status: t.status,
                          date: new Date(t.created_at).toLocaleString(),
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold hover:border-primary hover:text-primary"
                    >
                      <FileText className="size-3.5" /> {tr("عرض الإيصال 📄", "View receipt 📄")}

                    </button>
                  </td>
                </tr>
              ))}
              {(txs.data ?? []).map((t) => (
                <tr key={t.id} className="border-b border-border/60 last:border-0">
                  <td className="py-3">{t.type}</td>
                  <td className="text-muted-foreground">{t.network ?? tr("داخلي", "Internal")}</td>
                  <td className={Number(t.amount) >= 0 ? "font-semibold text-primary" : "font-semibold text-destructive"}>
                    {Number(t.amount) > 0 ? "+" : ""}{Number(t.amount)} USDT
                  </td>
                  <td className="text-muted-foreground">{t.status}</td>
                  <td className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        setReceipt({
                          txId: t.id,
                          type: String(t.type),
                          network: t.network ?? tr("داخلي", "Internal"),
                          gateway: t.network ? `USDT · ${t.network}` : "USDT",
                          amount: `${Number(t.amount)} USDT`,
                          status: String(t.status),
                          date: new Date(t.created_at).toLocaleString(),
                        })
                      }

                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold hover:border-primary hover:text-primary"
                    >
                      <FileText className="size-3.5" /> {tr("عرض الإيصال 📄", "View receipt 📄")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!txs.isLoading && (txs.data ?? []).length === 0 && fiatRows.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">{tr("لا توجد معاملات بعد.", "No transactions yet.")}</p>
          )}
        </div>
      </Card>

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}

      {deposit && (
        <div className="fixed inset-0 z-50 grid place-items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur">
          <Card className="my-4 w-full max-w-md px-4 sm:px-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h3 className="min-w-0 truncate font-black">{tr("إيداع الأموال", "Deposit funds")}</h3>
              <button onClick={() => setDeposit(false)} aria-label={tr("إغلاق", "Close")} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border"><X className="size-4" /></button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-border p-1">
              {([
                ["crypto", tr("USDT كريبتو مباشر", "Direct USDT crypto")],
                ["fiat", tr("بطاقة ودفع سريع", "Card & express pay")],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDepositTab(k)}
                  className={`rounded-lg px-2 py-2 text-[11px] font-bold ${depositTab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {depositTab === "crypto" ? (
              <div className="mt-4">
                <div className="flex gap-2">
                  {networks.map((n) => (
                    <button
                      key={n.value}
                      onClick={() => setNetwork(n.value)}
                      className={`flex-1 rounded-lg px-2 py-2 text-[11px] ${network === n.value ? "bg-primary font-bold text-primary-foreground" : "border border-border text-muted-foreground"}`}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid place-items-center rounded-xl border border-border p-5">
                  <QrCode value={network === "trc20" ? "TJ9xMunjazEscrowDeposit7fKq2Zb" : "0x8fMunjazEscrowDeposit19aB4cD7"} size={168} />
                  <p className="mt-3 break-all text-center font-mono text-[11px] text-muted-foreground">
                    {network === "trc20" ? "TJ9xMunjazEscrowDeposit7fKq2Zb" : "0x8fMunjazEscrowDeposit19aB4cD7"}
                  </p>
                  <button
                    onClick={() => navigator.clipboard.writeText(network === "trc20" ? "TJ9xMunjazEscrowDeposit7fKq2Zb" : "0x8fMunjazEscrowDeposit19aB4cD7")}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs"
                  >
                    <Copy className="size-3.5" /> {tr("نسخ العنوان", "Copy address")}
                  </button>
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent">
                    <Timer className="size-3.5" />
                    {tr("صلاحية العنوان", "Address lock")}: {String(Math.floor(lockLeft / 60)).padStart(2, "0")}:{String(lockLeft % 60).padStart(2, "0")}
                  </p>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {tr("يُضاف الرصيد تلقائياً بعد تأكيد الشبكة.", "Balance is credited automatically after network confirmation.")}
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <FiatOnRamp
                  onSuccess={(d) => {
                    const row: FiatRow = {
                      id: `fiat-${Date.now()}`,
                      type: `إيداع ${d.method}`,
                      network: "Fiat On-Ramp",
                      amount: d.usdt,
                      status: "مكتمل ✅",
                      created_at: new Date().toISOString(),
                      txId: `MJF-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
                    };
                    setFiatRows((r) => [row, ...r]);
                    setDeposit(false);
                    setReceipt({
                      txId: row.txId,
                      type: row.type,
                      network: row.network,
                      amount: `${d.usdt} USDT`,
                      fee: `${d.fee} USD`,
                      status: row.status,
                      date: new Date().toLocaleString(),
                    });
                  }}
                />
              </div>
            )}
          </Card>
        </div>
      )}
    </Section>
  );
}
