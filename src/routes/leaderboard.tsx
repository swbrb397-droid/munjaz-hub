import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BadgeCheck, Crown, Medal, Star, TrendingUp, Trophy } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { rankSellers, type LeaderboardMetric } from "@/lib/sellers";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "لوحة المتصدرين | المُنجَز" },
      { name: "description", content: "ترتيب البائعين في المُنجَز وفق التقييم الرقمي ونسبة الإنجاز وعدد المبيعات — بدون أي ترقية مدفوعة." },
      { property: "og:title", content: "لوحة المتصدرين | المُنجَز" },
      { property: "og:description", content: "ترتيب استحقاقي بالكامل يعتمد على الأداء الرقمي فقط." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Leaderboard,
});

const rankStyles = [
  "bg-primary text-primary-foreground",
  "bg-accent text-accent-foreground",
  "bg-violet/80 text-background",
];

function Leaderboard() {
  const { lang, tr } = useLang();
  const [metric, setMetric] = useState<LeaderboardMetric>("total_rating");
  const ranked = useMemo(() => rankSellers(metric), [metric]);

  const metrics: { key: LeaderboardMetric; label: string; icon: typeof Star }[] = [
    { key: "total_rating", label: tr("التقييم", "Rating"), icon: Star },
    { key: "completion_rate", label: tr("نسبة الإنجاز", "Completion rate"), icon: TrendingUp },
    { key: "total_sales", label: tr("عدد المبيعات", "Total sales"), icon: Trophy },
  ];

  return (
    <Section
      title={tr("لوحة المتصدرين", "Leaderboard")}
      subtitle={tr(
        "ترتيب استحقاقي صرف: التقييم، نسبة الإنجاز، وعدد المبيعات — لا ترقية مدفوعة ولا تثبيت.",
        "Purely meritocratic ranking: rating, completion rate, and total sales — no paid boosting or pinning.",
      )}
    >
      <Card className="mb-6 flex flex-wrap items-center gap-2">
        <span className="me-2 text-sm text-muted-foreground">{tr("الفرز حسب", "Sort by")}</span>
        {metrics.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              metric === m.key
                ? "bg-primary font-bold text-primary-foreground"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <m.icon className="size-4" /> {m.label}
          </button>
        ))}
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr className="text-start">
              <th className="p-4 text-start font-medium">#</th>
              <th className="p-4 text-start font-medium">{tr("البائع", "Seller")}</th>
              <th className="p-4 text-start font-medium">{tr("التقييم", "Rating")}</th>
              <th className="p-4 text-start font-medium">{tr("نسبة الإنجاز", "Completion")}</th>
              <th className="p-4 text-start font-medium">{tr("المبيعات", "Sales")}</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((s, i) => (
              <tr key={s.username} className="border-b border-border/60 last:border-0 hover:bg-surface-2/60">
                <td className="p-4">
                  <span
                    className={`grid size-8 place-items-center rounded-lg text-xs font-black ${
                      rankStyles[i] ?? "border border-border text-muted-foreground"
                    }`}
                  >
                    {i === 0 ? <Crown className="size-4" /> : i < 3 ? <Medal className="size-4" /> : i + 1}
                  </span>
                </td>
                <td className="p-4">
                  <Link to="/user/$username" params={{ username: s.username }} className="flex items-center gap-3">
                    <img
                      src={s.avatar_url}
                      alt={lang === "ar" ? s.name_ar : s.name_en}
                      loading="lazy"
                      className="size-10 rounded-full object-cover"
                    />
                    <span>
                      <span className="flex items-center gap-1 font-bold">
                        {lang === "ar" ? s.name_ar : s.name_en}
                        {s.verified && <BadgeCheck className="size-4 text-accent" />}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {lang === "ar" ? s.headline_ar : s.headline_en}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="p-4 font-bold text-primary">{s.total_rating.toFixed(2)}</td>
                <td className="p-4">{s.completion_rate.toFixed(1)}%</td>
                <td className="p-4">{s.total_sales.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Section>
  );
}
