import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Award, Coins, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useMock } from "@/lib/mock";
import { useLang } from "@/lib/lang";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم | مُنجَز" },
      { name: "description", content: "لوحة تحكم تفاعلية بعرض مزدوج للمشتري والبائع: الدخل المباشر، الطلبات النشطة، تقدم XP، ومؤشرات محفظة USDT." },
      { property: "og:title", content: "لوحة التحكم | مُنجَز" },
      { property: "og:description", content: "تابع دخلك وطلباتك ومستواك في مُنجَز لحظياً." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { tr } = useLang();
  const { orders } = useMock();
  const [view, setView] = useState<"seller" | "buyer">("seller");

  const stats =
    view === "seller"
      ? [
          { icon: Coins, label: tr("أرباح الشهر", "Monthly earnings"), value: "3,240 USDT", sub: tr("+18% عن الشهر الماضي", "+18% vs last month") },
          { icon: ShoppingBag, label: tr("طلبات نشطة", "Active orders"), value: "7", sub: tr("3 بانتظار التسليم", "3 awaiting delivery") },
          { icon: TrendingUp, label: tr("معدل الإنجاز", "Completion rate"), value: "97%", sub: tr("آخر 30 يوماً", "Last 30 days") },
          { icon: Users, label: tr("عملاء متكررون", "Repeat clients"), value: "42", sub: tr("من 118 عميلاً", "out of 118 clients") },
        ]
      : [
          { icon: Coins, label: tr("الإنفاق هذا الشهر", "Spending this month"), value: "1,120 USDT", sub: tr("5 طلبات", "5 orders") },
          { icon: ShoppingBag, label: tr("طلبات جارية", "Ongoing orders"), value: "3", sub: tr("1 بانتظار مراجعتك", "1 awaiting your review") },
          { icon: TrendingUp, label: tr("مبالغ في الضمان", "Amounts in escrow"), value: "850 USDT", sub: tr("محجوزة بأمان", "Safely held") },
          { icon: Users, label: tr("بائعون مفضلون", "Favorite sellers"), value: "9", sub: tr("متابَعون", "Followed") },
        ];

  return (
    <Section
      title={tr("لوحة التحكم", "Dashboard")}
      subtitle={tr("عرض مزدوج: بائع / مشتري", "Dual view: seller / buyer")}
      action={
        <div className="flex rounded-xl border border-border p-1">
          {(["seller", "buyer"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-4 py-2 text-sm ${view === v ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground"}`}
            >
              {v === "seller" ? tr("بائع", "Seller") : tr("مشتري", "Buyer")}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <s.icon className="size-5 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h3 className="font-bold">{tr("الطلبات النشطة", "Active orders")}</h3>
          <div className="mt-4 grid gap-3">
            {orders.map((o) => (
              <div key={o.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{o.title}</p>
                    <p className="text-xs text-muted-foreground">{o.id} · {o.client}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-bold text-primary">{o.value} USDT</p>
                    <p className="text-xs text-muted-foreground">{o.state}</p>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-secondary">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${o.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-4">
          <Card>
            <div className="flex items-center gap-2">
              <Award className="size-5 text-violet" />
              <h3 className="font-bold">{tr("المستوى 12 · محترف", "Level 12 · Professional")}</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">4,820 / 6,000 XP</p>
            <div className="mt-2 h-3 rounded-full bg-secondary">
              <div className="h-3 rounded-full bg-gradient-to-l from-primary to-violet" style={{ width: "80%" }} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {[tr("تسليم سريع", "Fast delivery"), tr("تقييم ذهبي", "Gold rating"), tr("بائع موثق", "Verified seller"), tr("100 طلب", "100 orders")].map((b) => (
                <span key={b} className="rounded-full border border-border px-3 py-1 text-muted-foreground">{b}</span>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="font-bold">{tr("مؤشرات المحفظة", "Wallet indicators")}</h3>
            <dl className="mt-3 grid gap-2 text-sm">
              {[
                [tr("الرصيد المتاح", "Available balance"), "4,182.50 USDT"],
                [tr("محجوز في الضمان", "Held in escrow"), "850.00 USDT"],
                [tr("قيد السحب", "Pending withdrawal"), "450.00 USDT"],
                [tr("حالة التوثيق", "Verification status"), tr("الطبقة 2 — موثق", "Tier 2 — Verified")],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border pb-2 last:border-0">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </Section>
  );
}
