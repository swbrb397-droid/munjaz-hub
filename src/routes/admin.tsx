import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Gavel, ShieldCheck, TrendingUp } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useMock } from "@/lib/mock";
import { useLang } from "@/lib/lang";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "لوحة الإدارة | مُنجَز" },
      { name: "description", content: "إدارة النزاعات، مركز توثيق الهوية (KYC)، وتحليلات إيرادات المنصة بعملة USDT." },
      { property: "og:title", content: "لوحة الإدارة | مُنجَز" },
      { property: "og:description", content: "قائمة النزاعات، طلبات التوثيق، ومؤشرات الإيرادات في مكان واحد." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { tr } = useLang();
  const { disputes, kycQueue } = useMock();

  const tabs = [
    { key: "disputes", label: tr("النزاعات", "Disputes"), icon: Gavel },
    { key: "kyc", label: tr("التوثيق", "KYC"), icon: ShieldCheck },
    { key: "revenue", label: tr("الإيرادات", "Revenue"), icon: TrendingUp },
  ] as const;

  const revenue = [
    { m: tr("مارس", "Mar"), v: 42 },
    { m: tr("أبريل", "Apr"), v: 58 },
    { m: tr("مايو", "May"), v: 51 },
    { m: tr("يونيو", "Jun"), v: 74 },
    { m: tr("يوليو", "Jul"), v: 88 },
    { m: tr("أغسطس", "Aug"), v: 96 },
  ];

  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("disputes");

  return (
    <Section title={tr("لوحة الإدارة", "Admin Dashboard")} subtitle={tr("تشغيل المنصة والرقابة والتحليلات", "Platform operations, oversight, and analytics")}>
      <Card className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${tab === t.key ? "bg-primary font-bold text-primary-foreground" : "border border-border text-muted-foreground"}`}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </Card>

      {tab === "disputes" && (
        <Card>
          <h3 className="font-bold">{tr("قائمة النزاعات", "Disputes list")}</h3>
          <div className="mt-4 grid gap-3">
            {disputes.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4 text-sm">
                <div className="min-w-40">
                  <p className="font-semibold">{d.id} · {d.order}</p>
                  <p className="text-xs text-muted-foreground">{d.reason}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs ${d.risk === tr("مرتفع", "High") ? "bg-destructive/15 text-destructive" : d.risk === tr("متوسط", "Medium") ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary"}`}>
                  {tr("خطورة", "Risk")} {d.risk}
                </span>
                <span className="text-muted-foreground">{tr("حكم AI", "AI ruling")}: {d.ai}</span>
                <div className="ms-auto flex gap-2">
                  <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">{tr("اعتماد", "Approve")}</button>
                  <button className="rounded-lg border border-border px-3 py-1.5 text-xs">{tr("مراجعة", "Review")}</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "kyc" && (
        <Card>
          <h3 className="font-bold">{tr("مركز توثيق الهوية", "KYC center")}</h3>
          <div className="mt-4 grid gap-3">
            {kycQueue.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4 text-sm">
                <div className="min-w-44">
                  <p className="font-semibold">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.id} · {u.tier}</p>
                </div>
                <span className="text-muted-foreground">{u.docs}</span>
                <span className="text-xs text-muted-foreground">{u.submitted}</span>
                <div className="ms-auto flex gap-2">
                  <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">{tr("قبول", "Accept")}</button>
                  <button className="rounded-lg border border-destructive/50 px-3 py-1.5 text-xs text-destructive">{tr("رفض", "Reject")}</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "revenue" && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <h3 className="font-bold">{tr("إيرادات العمولة (ألف USDT)", "Commission revenue (thousand USDT)")}</h3>
            <div className="mt-6 flex h-56 items-end gap-3">
              {revenue.map((r) => (
                <div key={r.m} className="flex flex-1 flex-col items-center gap-2">
                  <div className="w-full rounded-t-lg bg-gradient-to-t from-primary/30 to-primary" style={{ height: `${r.v * 2}px` }} />
                  <span className="text-xs text-muted-foreground">{r.m}</span>
                </div>
              ))}
            </div>
          </Card>
          <div className="grid gap-4">
            {[
              [tr("إجمالي حجم التداول", "Total trading volume"), "12.4M USDT"],
              [tr("صافي عمولة المنصة", "Net platform commission"), "96K USDT"],
              [tr("مدفوعات الإحالة", "Referral payouts"), "17.2K USDT"],
              [tr("نسبة النزاعات", "Dispute rate"), "0.9%"],
            ].map(([k, v]) => (
              <Card key={k}>
                <p className="text-sm text-muted-foreground">{k}</p>
                <p className="text-2xl font-black text-primary">{v}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}
