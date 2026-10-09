import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Calculator, Crown, Sparkles } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { PRESTIGE_TIERS } from "@/lib/prestige";

export const Route = createFileRoute("/levels")({
  head: () => ({
    meta: [
      { title: "سلّم المستويات | المنجز" },
      { name: "description", content: "المستويات الثمانية في المنجز: شروط واضحة ومعلنة من الانطلاقة إلى الهيمنة — تُكتسب بالأداء فقط ولا تُشترى." },
      { property: "og:title", content: "سلّم المستويات الثمانية | المنجز" },
      { property: "og:description", content: "شروط شفافة لكل مستوى: الطلبات، حجم التداول، التقييم، والالتزام بالمواعيد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Levels,
});

const PLANS = [
  { ar: "المجانية", en: "Free", pct: 10 },
  { ar: "Pro", en: "Pro", pct: 5 },
  { ar: "الشركات", en: "Corporate", pct: 2.5 },
];

function Levels() {
  const { tr, lang } = useLang();
  const ar = lang === "ar";
  const [monthly, setMonthly] = useState("500");
  const gross = Math.max(0, Number(monthly) || 0);

  return (
    <Section title={tr("سلّم المستويات", "Prestige levels")} subtitle={tr("ثمانية مستويات بشروط معلنة — تُكتسب بالأداء الحقيقي فقط، ولا تقيّد حقك في النشر.", "Eight levels with public criteria — earned by real performance only, never restricting publishing.")}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PRESTIGE_TIERS.map((t) => (
          <Card key={t.level} className="grid gap-2">
            <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${t.badge}`}>
              {t.aura ? <Crown className="size-3.5" /> : <Sparkles className="size-3.5" />}
              {tr(`المستوى ${t.level} — ${t.ar}`, `Level ${t.level} — ${t.en}`)}
            </span>
            {t.level === 1 ? (
              <p className="text-xs text-muted-foreground">{tr("نقطة البداية لكل حساب جديد.", "Starting point for every new account.")}</p>
            ) : (
              <ul className="grid gap-1 text-xs text-muted-foreground">
                <li>{tr("طلبات مكتملة:", "Completed orders:")} <bdi className="font-bold text-foreground">{t.orders}+</bdi></li>
                <li>{tr("حجم التداول:", "Volume:")} <bdi className="font-bold text-foreground">{t.volume.toFixed(2)}</bdi> USDT</li>
                <li>{tr("التقييم:", "Rating:")} <bdi className="font-bold text-foreground">{t.rating.toFixed(2)}+</bdi></li>
                <li>{tr("الالتزام بالمواعيد:", "On-time:")} <bdi className="font-bold text-foreground">{t.onTime}%+</bdi></li>
              </ul>
            )}
          </Card>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {tr("يُمنح المستوى عند تحقيق الشروط الأربعة معاً. تابع تقدّمك من ", "A level is earned when all four criteria are met together. Track your progress from ")}
        <Link to="/dashboard" className="font-bold text-primary">{tr("لوحة التحكم", "your dashboard")}</Link>.
      </p>

      <Card className="mt-8">
        <h2 className="flex items-center gap-2 text-base font-black"><Calculator className="size-5 text-primary" /> {tr("حاسبة صافي الأرباح", "Net earnings calculator")}</h2>
        <label className="mt-3 grid max-w-xs gap-1.5 text-sm">
          <span className="text-muted-foreground">{tr("مبيعاتك الشهرية (USDT)", "Your monthly sales (USDT)")}</span>
          <input type="number" min={0} step="0.01" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} className="rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
        </label>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {PLANS.map((p) => {
            const net = gross * (1 - p.pct / 100);
            return (
              <div key={p.en} className="rounded-xl border border-border bg-surface-2/40 p-3">
                <p className="text-xs text-muted-foreground">{ar ? `باقة ${p.ar}` : `${p.en} plan`} · <bdi>{p.pct}%</bdi></p>
                <p className="mt-1 text-lg font-black text-primary"><bdi>{net.toFixed(2)}</bdi> USDT</p>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {tr("الصافي بعد عمولة المنصة فقط. رسوم الشبكة عند السحب تُحسب منفصلة حسب الشبكة المختارة.", "Net after platform commission only. Withdrawal network fees apply separately per chosen network.")}
        </p>
      </Card>
    </Section>
  );
}
