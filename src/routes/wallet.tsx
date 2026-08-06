import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, BadgeCheck, Copy, QrCode, X } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { transactions } from "@/lib/mock";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "المحفظة الداخلية USDT | مُنجَز" },
      { name: "description", content: "أودع واسحب USDT عبر TRC-20 و BEP-20 و Polygon، وتابع سجل المعاملات والمبالغ المحجوزة في الضمان." },
      { property: "og:title", content: "المحفظة الداخلية USDT | مُنجَز" },
      { property: "og:description", content: "إيداع وسحب USDT بدون رسوم داخلية مع سحب فوري للحسابات الموثقة." },
    ],
  }),
  component: WalletPage;
});

const networks = ["TRC-20", "BEP-20", "Polygon"] as const;
const rates: Record<string, number> = { USD: 1.0002, SAR: 3.7506, AED: 3.6731, EUR: 0.9184 };

function WalletPage() {
  const [deposit, setDeposit] = useState(false);
  const [network, setNetwork] = useState<(typeof networks)[number]>("TRC-20");
  const [amount, setAmount] = useState("250");
  const balance = 4182.5;

  return (
    <Section
      title="المحفظة الداخلية"
      subtitle="جميع الأرصدة بعملة USDT — تحويلات داخلية بدون رسوم غاز"
      action={
        <div className="flex gap-2">
          <button onClick={() => setDeposit(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground glow">
            <ArrowDownToLine className="size-4" /> إيداع
          </button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="glow lg:col-span-1">
          <p className="text-sm text-muted-foreground">الرصيد المتاح</p>
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
            <BadgeCheck className="size-4" /> حساب موثق (الطبقة 2) — سحب فوري مفعّل
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="flex items-center gap-2 font-bold"><ArrowUpFromLine className="size-4 text-accent" /> طلب سحب</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-muted-foreground">الشبكة</span>
              <select value={network} onChange={(e) => setNetwork(e.target.value as typeof network)} className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary">
                {networks.map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-muted-foreground">المبلغ (USDT)</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary" />
            </label>
            <label className="grid gap-2 text-sm sm:col-span-2">
              <span className="text-muted-foreground">عنوان المحفظة</span>
              <input placeholder="T… / 0x…" className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/60 p-4 text-sm">
            <span className="text-muted-foreground">رسوم السحب الفوري: <span className="text-foreground">0.8 USDT</span></span>
            <span className="text-muted-foreground">تصلك خلال: <span className="text-primary">دقائق</span></span>
            <button className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground">تأكيد السحب</button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">الحسابات غير الموثقة تخضع لسحب مجدول بفترة تأمين 72 ساعة.</p>
        </Card>
      </div>

      <Card className="mt-6">
        <h3 className="font-bold">سجل المعاملات</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                {["النوع", "الشبكة", "المبلغ", "الحالة", "التاريخ"].map((h) => (
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
              <h3 className="font-bold">إيداع USDT</h3>
              <button onClick={() => setDeposit(false)} aria-label="إغلاق"><X className="size-4" /></button>
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
              <p className="mt-3 text-xs text-muted-foreground">امسح الرمز أو انسخ العنوان</p>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
              <span className="truncate font-mono">TXk9Fq2mUn7ZaMunjazDemoAddr{network}</span>
              <Copy className="ms-auto size-4 shrink-0 text-primary" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">أرسل عملة USDT فقط على شبكة {network}. أي شبكة أخرى تؤدي لفقدان الأموال.</p>
          </Card>
        </div>
      )}
    </Section>
  );
}
