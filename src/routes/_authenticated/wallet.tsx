import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, BadgeCheck, Copy, QrCode, X } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useMock } from "@/lib/mock";
import { useLang } from "@/lib/lang";

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

const networks = ["TRC-20", "BEP-20", "Polygon"] as const;
const rates: Record<string, number> = { USD: 1.0002, SAR: 3.7506, AED: 3.6731, EUR: 0.9184 };

function WalletPage() {
  const { tr } = useLang();
  const { transactions } = useMock();
  const [deposit, setDeposit] = useState(false);
  const [network, setNetwork] = useState<(typeof networks)[number]>("TRC-20");
  const [amount, setAmount] = useState("250");
  const balance = 4182.5;

  return (
    <Section
      title={tr("المحفظة الداخلية", "Internal wallet")}
      subtitle={tr("جميع الأرصدة بعملة USDT — تحويلات داخلية بدون رسوم غاز", "All balances in USDT — internal transfers with no gas fees")}
      action={
        <div className="flex gap-2">
          <button onClick={() => setDeposit(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground glow">
            <ArrowDownToLine className="size-4" /> {tr("إيداع", "Deposit")}
          </button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="glow lg:col-span-1">
          <p className="text-sm text-muted-foreground">{tr("الرصيد المتاح", "Available balance")}</p>
          <p className="mt-1 text-4xl font-black text-primary">{balance.toLocaleString()} </p>
          <p className="text-sm text-muted-foreground">USDT</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {Object.entries(rates).map(([c, r]) => (
              <div key={c} className="rounded-lg border border-border px-3 py-2">
                <span className="text-muted-foreground">{c}</span>
                <p className="font-semibold">≈ {(balance * r).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 inline-flex items-center gap-1 text-xs text-primary">
            <BadgeCheck className="size-4" /> {tr("حساب موثق (الطبقة 2) — سحب فوري مفعّل", "Verified account (Tier 2) — instant withdrawal enabled")}
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="flex items-center gap-2 font-bold"><ArrowUpFromLine className="size-4 text-accent" /> {tr("طلب سحب", "Withdrawal request")}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-muted-foreground">{tr("الشبكة", "Network")}</span>
              <select value={network} onChange={(e) => setNetwork(e.target.value as typeof network)} className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary">
                {networks.map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-muted-foreground">{tr("المبلغ (USDT)", "Amount (USDT)")}</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary" />
            </label>
            <label className="grid gap-2 text-sm sm:col-span-2">
              <span className="text-muted-foreground">{tr("عنوان المحفظة", "Wallet address")}</span>
              <input placeholder={tr("T… / 0x…", "T… / 0x…")} className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/60 p-4 text-sm">
            <span className="text-muted-foreground">{tr("رسوم السحب الفوري:", "Instant withdrawal fee:")} <span className="text-foreground">0.8 USDT</span></span>
            <span className="text-muted-foreground">{tr("تصلك خلال:", "Arrives within:")} <span className="text-primary">{tr("دقائق", "minutes")}</span></span>
            <button className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground">{tr("تأكيد السحب", "Confirm withdrawal")}</button>
          </div>
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
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-border/60 last:border-0">
                  <td className="py-3">{t.type}</td>
                  <td className="text-muted-foreground">{t.network}</td>
                  <td className={t.amount >= 0 ? "font-semibold text-primary" : "font-semibold text-destructive"}>
                    {t.amount > 0 ? "+" : ""}{t.amount} USDT
                  </td>
                  <td className="text-muted-foreground">{t.status}</td>
                  <td className="text-muted-foreground">{t.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
                <button key={n} onClick={() => setNetwork(n)} className={`rounded-lg px-3 py-1.5 text-sm ${network === n ? "bg-primary font-bold text-primary-foreground" : "border border-border text-muted-foreground"}`}>
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-5 grid place-items-center rounded-xl border border-border bg-surface-2/60 p-6">
              <QrCode className="size-32 text-primary" />
              <p className="mt-3 text-xs text-muted-foreground">{tr("امسح الرمز أو انسخ العنوان", "Scan the code or copy the address")}</p>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
              <span className="truncate font-mono">TXk9Fq2mUn7ZaMunjazDemoAddr{network}</span>
              <Copy className="ms-auto size-4 shrink-0 text-primary" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{tr(`أرسل عملة USDT فقط على شبكة ${network}. أي شبكة أخرى تؤدي لفقدان الأموال.`, `Send only USDT on the ${network} network. Any other network will result in loss of funds.`)}</p>
          </Card>
        </div>
      )}
    </Section>
  );
}
