import { useMemo, useState } from "react";
import { ChevronDown, CreditCard, Lock, ShieldCheck, Zap } from "lucide-react";

const FIAT: Record<string, { label: string; perUsd: number }> = {
  USD: { label: "دولار أمريكي USD", perUsd: 1 },
  SAR: { label: "ريال سعودي SAR", perUsd: 3.7506 },
  AED: { label: "درهم إماراتي AED", perUsd: 3.6731 },
  EUR: { label: "يورو EUR", perUsd: 0.9184 },
};

const GATEWAY_FEE = 0.03; // 3% متوسط رسوم البوابة (2.5% - 3.5%)
const PRESETS = [50, 100, 250, 500, 1000];

function detectBrand(num: string): "visa" | "mastercard" | null {
  const d = num.replace(/\D/g, "");
  if (/^4/.test(d)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "mastercard";
  return null;
}

export type FiatDeposit = { method: string; usd: number; usdt: number; fee: number };

/** Fiat → USDT on-ramp: express wallets, calculator, and card checkout. */
export function FiatOnRamp({ onSuccess }: { onSuccess: (d: FiatDeposit) => void }) {
  const [currency, setCurrency] = useState<keyof typeof FIAT>("USD");
  const [amount, setAmount] = useState("100");
  const [feesOpen, setFeesOpen] = useState(false);
  const [card, setCard] = useState({ number: "", exp: "", cvv: "", name: "" });
  const [busy, setBusy] = useState<string | null>(null);

  const usd = useMemo(() => {
    const raw = Number(amount.replace(/[^\d.]/g, "")) || 0;
    return raw / FIAT[currency]!.perUsd;
  }, [amount, currency]);

  const feeUsd = usd * GATEWAY_FEE;
  const netUsdt = Math.max(0, (usd - feeUsd) * 0.985 + feeUsd * 0); // 1 USD ≈ 0.985 USDT بعد المعالجة
  const brand = detectBrand(card.number);
  const cardValid = card.number.replace(/\D/g, "").length >= 15 && /^\d{2}\/\d{2}$/.test(card.exp) && card.cvv.length >= 3 && card.name.trim().length > 2;

  function pay(method: string) {
    if (usd <= 0) return;
    setBusy(method);
    setTimeout(() => {
      setBusy(null);
      onSuccess({ method, usd, usdt: Number(netUsdt.toFixed(2)), fee: Number(feeUsd.toFixed(2)) });
    }, 1400);
  }

  return (
    <div className="grid gap-4">
      {/* Express checkout */}
      <div className="rounded-2xl border border-border bg-surface-2/60 p-4">
        <p className="text-xs font-black">الدفع السريع بنقرة واحدة</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => pay("Apple Pay")}
            disabled={!!busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-black py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            <span className="text-lg leading-none"></span> {busy === "Apple Pay" ? "جارٍ التحقق البيومتري..." : "ادفع بـ Apple Pay"}
          </button>
          <button
            type="button"
            onClick={() => pay("Google Pay")}
            disabled={!!busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-[#131417] py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            <span className="grid size-5 place-items-center rounded-full bg-white text-[11px] font-black text-[#4285F4]">G</span>
            {busy === "Google Pay" ? "جارٍ التحقق البيومتري..." : "ادفع بـ Google Pay"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setCurrency("USD");
                setAmount(String(p));
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${Number(amount) === p && currency === "USD" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
            >
              ${p}
            </button>
          ))}
        </div>
      </div>

      {/* Calculator */}
      <div className="grid gap-3 rounded-2xl border border-border p-4">
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">المبلغ بالعملة المحلية</span>
          <div className="flex gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              maxLength={10}
              className="min-w-0 flex-1 rounded-xl border border-input bg-surface px-3 py-2.5 text-sm font-bold outline-none focus:border-primary"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as keyof typeof FIAT)}
              className="shrink-0 rounded-xl border border-input bg-surface px-2 py-2.5 text-xs font-bold outline-none focus:border-primary"
            >
              {Object.keys(FIAT).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </label>

        <p className="text-[11px] text-muted-foreground">
          سعر السوق اللحظي: <span className="font-bold text-foreground">1 USD ≈ 0.985 USDT</span> بعد المعالجة · عمولة المنصة 0%
        </p>

        <div className="rounded-xl border border-primary/40 bg-primary/10 p-3">
          <p className="text-[11px] text-muted-foreground">المبلغ المستلم في محفظتك</p>
          <p className="mt-1 text-3xl font-black text-primary">{netUsdt.toFixed(2)} <span className="text-base">USDT</span></p>
        </div>

        <button type="button" onClick={() => setFeesOpen(!feesOpen)} className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-xs font-bold">
          تفاصيل الرسوم بشفافية
          <ChevronDown className={`size-4 transition-transform ${feesOpen ? "rotate-180" : ""}`} />
        </button>
        {feesOpen && (
          <dl className="grid gap-1.5 rounded-xl border border-border bg-surface-2/60 p-3 text-[11px]">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">رسوم البطاقة وبوابة التحويل (~2.5%–3.5%)</dt><dd className="font-bold">{feeUsd.toFixed(2)} USD</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">عمولة منصة الـمُـنْـجِـز</dt><dd className="font-bold text-primary">0% مجاناً</dd></div>
            <div className="flex justify-between gap-3 border-t border-border pt-1.5"><dt className="text-muted-foreground">الصافي المودع في المحفظة</dt><dd className="font-black text-primary">{netUsdt.toFixed(2)} USDT</dd></div>
          </dl>
        )}
      </div>

      {/* Card form */}
      <div className="grid gap-3 rounded-2xl border border-border p-4">
        <p className="flex items-center justify-between gap-2 text-xs font-black">
          الدفع بالبطاقة
          <span className="text-[10px] font-bold text-muted-foreground">{brand === "visa" ? "VISA 💳" : brand === "mastercard" ? "Mastercard 💳" : "Visa / Mastercard"}</span>
        </p>
        <input
          value={card.number}
          onChange={(e) => setCard({ ...card, number: e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim() })}
          inputMode="numeric"
          placeholder="0000 0000 0000 0000"
          className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 font-mono text-sm outline-none focus:border-primary"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={card.exp}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 4);
              setCard({ ...card, exp: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d });
            }}
            placeholder="MM/YY"
            className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 font-mono text-sm outline-none focus:border-primary"
          />
          <input
            value={card.cvv}
            onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            placeholder="CVV"
            className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 font-mono text-sm outline-none focus:border-primary"
          />
        </div>
        <input
          value={card.name}
          onChange={(e) => setCard({ ...card, name: e.target.value.replace(/[^A-Za-z\u0600-\u06FF ]/g, "").slice(0, 40) })}
          placeholder="اسم حامل البطاقة"
          className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          disabled={!cardValid || !!busy || usd <= 0}
          onClick={() => pay(brand === "visa" ? "Visa" : brand === "mastercard" ? "Mastercard" : "بطاقة بنكية")}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
        >
          <CreditCard className="size-4" /> {busy ? "جارٍ تنفيذ الدفع الآمن..." : "إتمام الدفع الآمن وشحن المحفظة 💳"}
        </button>
        <p className="inline-flex items-center justify-center gap-2 text-[10px] font-bold text-muted-foreground">
          <Lock className="size-3" /> تشفير SSL 256-bit · مصادقة 3D-Secure
        </p>
      </div>

      <div className="grid gap-2 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-[11px] leading-relaxed">
        <p className="flex gap-2 font-bold text-accent"><Zap className="mt-0.5 size-3.5 shrink-0" /> شحن فوري: يتم شراء الـ USDT وتحويله إلى رصيدك المتاح فور إتمام عملية الدفع.</p>
        <p className="flex gap-2 text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" /> سياسة الأمان والسحب: جميع عمليات سحب الأرباح تتم حصراً عبر شبكات USDT (TRC-20 / BEP-20) لحماية أموال البائعين والمشترين.</p>
      </div>
    </div>
  );
}
