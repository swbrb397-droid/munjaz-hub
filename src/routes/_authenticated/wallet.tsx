import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, BadgeCheck, Copy, QrCode, X } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useTransactions, useWallet } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "المحفظة الداخلية USDT | مُنجَز" },
      { name: "description", content: "أودع واسحب USDT عبر TRC-20 و BEP-20 و Polygon، وتابع سجل المعاملات والمبالغ المحجوزة في الضمان." },
      { property: "og:title", content: "المحفظة الداخلية USDT | مُنجَز" },
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

function WalletPage() {
  const { tr } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();
  const wallet = useWallet();
  const profile = useProfile();
  const txs = useTransactions();

  const [deposit, setDeposit] = useState(false);
  const [network, setNetwork] = useState<(typeof networks)[number]["value"]>("trc20");
  const [amount, setAmount] = useState("250");
  const [address, setAddress] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const balance = Number(wallet.data?.available_usdt ?? 0);
  const locked = Number(wallet.data?.locked_usdt ?? 0);

  const withdraw = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      if (!value || value <= 0) throw new Error(tr("أدخل مبلغاً صحيحاً", "Enter a valid amount"));
      if (value > balance) throw new Error(tr("الرصيد غير كافٍ", "Insufficient balance"));
      if (!address.trim()) throw new Error(tr("أدخل عنوان المحفظة", "Enter a wallet address"));
      const { error } = await supabase.from("wallet_transactions").insert({
        user_id: user!.id,
        type: "withdrawal",
        status: "pending",
        amount: -value,
        network,
        address: address.trim(),
        note: "Withdrawal request",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setFeedback(tr("تم إرسال طلب السحب للمراجعة.", "Withdrawal request submitted for review."));
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: Error) => setFeedback(e.message),
  });

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
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-muted-foreground">{tr("الشبكة", "Network")}</span>
              <select value={network} onChange={(e) => setNetwork(e.target.value as typeof network)} className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary">
                {networks.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-muted-foreground">{tr("المبلغ (USDT)", "Amount (USDT)")}</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary" />
            </label>
            <label className="grid gap-2 text-sm sm:col-span-2">
              <span className="text-muted-foreground">{tr("عنوان المحفظة", "Wallet address")}</span>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="T… / 0x…" className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/60 p-4 text-sm">
            <span className="text-muted-foreground">{tr("رسوم السحب الفوري:", "Instant withdrawal fee:")} <span className="text-foreground">0.8 USDT</span></span>
            <button
              onClick={() => withdraw.mutate()}
              disabled={withdraw.isPending}
              className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-60"
            >
              {tr("تأكيد السحب", "Confirm withdrawal")}
            </button>
          </div>
          {feedback && <p className="mt-3 text-xs text-primary">{feedback}</p>}
          <p className="mt-3 text-xs text-muted-foreground">{tr("الحسابات غير الموثقة تخضع لسحب مجدول بفترة تأمين 72 ساعة.", "Unverified accounts are subject to scheduled withdrawal with a 72-hour lock period.")}</p>
        </Card>
      </div>

      <Card className="mt-6">
        <h3 className="font-bold">{tr("سجل المعاملات", "Transaction history")}</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                {[tr("النوع", "Type"), tr("الشبكة", "Network"), tr("المبلغ", "Amount"), tr("الحالة", "Status"), tr("التاريخ", "Date")].map((h) => (
                  <th key={h} className="py-2 text-start font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(txs.data ?? []).map((t) => (
                <tr key={t.id} className="border-b border-border/60 last:border-0">
                  <td className="py-3">{t.type}</td>
                  <td className="text-muted-foreground">{t.network ?? tr("داخلي", "Internal")}</td>
                  <td className={Number(t.amount) >= 0 ? "font-semibold text-primary" : "font-semibold text-destructive"}>
                    {Number(t.amount) > 0 ? "+" : ""}{Number(t.amount)} USDT
                  </td>
                  <td className="text-muted-foreground">{t.status}</td>
                  <td className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!txs.isLoading && (txs.data ?? []).length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">{tr("لا توجد معاملات بعد.", "No transactions yet.")}</p>
          )}
        </div>
      </Card>

      {deposit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur">
          <Card className="w-full max-w-md">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{tr("إيداع USDT", "Deposit USDT")}</h3>
              <button onClick={() => setDeposit(false)} aria-label={tr("إغلاق", "Close")}><X className="size-4" /></button>
            </div>
            <div className="mt-4 flex gap-2">
              {networks.map((n) => (
                <button
                  key={n.value}
                  onClick={() => setNetwork(n.value)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs ${network === n.value ? "bg-primary font-bold text-primary-foreground" : "border border-border text-muted-foreground"}`}
                >
                  {n.label}
                </button>
              ))}
            </div>
            <div className="mt-4 grid place-items-center rounded-xl border border-border p-6">
              <QrCode className="size-24 text-primary" />
              <p className="mt-3 break-all text-center text-xs text-muted-foreground">
                {network === "trc20" ? "TJ9xMunjazEscrowDeposit7fKq2Zb" : "0x8fMunjazEscrowDeposit19aB4cD7"}
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(network === "trc20" ? "TJ9xMunjazEscrowDeposit7fKq2Zb" : "0x8fMunjazEscrowDeposit19aB4cD7")}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs"
              >
                <Copy className="size-3.5" /> {tr("نسخ العنوان", "Copy address")}
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {tr("يُضاف الرصيد تلقائياً بعد تأكيد الشبكة.", "Balance is credited automatically after network confirmation.")}
            </p>
          </Card>
        </div>
      )}
    </Section>
  );
}
