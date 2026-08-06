import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Award, Coins, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { orders } from "@/lib/mock";

export const Route = createFileRoute("/dashboard")({
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
  const [view, setView] = useState<"seller" | "buyer">("seller");

  const stats =
    view === "seller"
      ? [
          { icon: Coins, label: "أرباح الشهر", value: "3,240 USDT", sub: "+18% عن الشهر الماضي" },
          { icon: ShoppingBag, label: "طلبات نشطة", value: "7", sub: "3 بانتظار التسليم" },
          { icon: TrendingUp, label: "معدل الإنجاز", value: "97%", sub: "آخر 30 يوماً" },
          { icon: Users, label: "عملاء متكررون", value: "42", sub: "من 118 عميلاً" },
        ]
      : [
          { icon: Coins, label: "الإنفاق هذا الشهر", value: "1,120 USDT", sub: "5 طلبات" },
          { icon: ShoppingBag, label: "طلبات جارية", value: "3", sub: "1 بانتظار مراجعتك" },
          { icon: TrendingUp, label: "مبالغ في الضمان", value: "850 USDT", sub: "محجوزة بأمان" },
          { icon: Users, label: "بائعون مفضلون", value: "9", sub: "متابَعون" },
        ];

  return (
    <Section
      title="لوحة التحكم"
      subtitle="عرض مزدوج: بائع / مشتري"
      action={
        <div className="flex rounded-xl border border-border p-1">
          {(["seller", "buyer"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-4 py-2 text-sm ${view === v ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground"}`}
            >
              {v === "seller" ? "بائع" : "مشتري"}
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
          <h3 className="font-bold">الطلبات النشطة</h3>
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
              <h3 className="font-bold">المستوى 12 · محترف</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">4,820 / 6,000 XP</p>
            <div className="mt-2 h-3 rounded-full bg-secondary">
              <div className="h-3 rounded-full bg-gradient-to-l from-primary to-violet" style={{ width: "80%" }} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {["تسليم سريع", "تقييم ذهبي", "بائع موثق", "100 طلب"].map((b) => (
                <span key={b} className="rounded-full border border-border px-3 py-1 text-muted-foreground">{b}</span>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="font-bold">مؤشرات المحفظة</h3>
            <dl className="mt-3 grid gap-2 text-sm">
              {[
                ["الرصيد المتاح", "4,182.50 USDT"],
                ["محجوز في الضمان", "850.00 USDT"],
                ["قيد السحب", "450.00 USDT"],
                ["حالة التوثيق", "الطبقة 2 — موثق"],
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
