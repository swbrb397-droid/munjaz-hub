import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, Crown, Medal, Sparkles, Star, Trophy, Zap } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useLeaderboard, type LeaderboardMetric } from "@/lib/platform";
import { maskUser } from "@/lib/mask";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "لوحة المتصدرين | المُنجِز" },
      { name: "description", content: "ترتيب البائعين في المُنجِز وفق التقييم الحقيقي وعدد الطلبات المكتملة ونقاط الخبرة — بدون أي ترقية مدفوعة." },
      { property: "og:title", content: "لوحة المتصدرين | المُنجِز" },
      { property: "og:description", content: "ترتيب استحقاقي بالكامل يعتمد على الأداء الحقيقي فقط." },
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
  const { tr } = useLang();
  const [metric, setMetric] = useState<LeaderboardMetric>("rating");
  const board = useLeaderboard(metric);
  const rows = board.data ?? [];
  const rankedRows = rows.filter(
    (seller) => seller.completed_orders > 0 || seller.rating > 0 || seller.xp_points > 0,
  );

  const metrics: { key: LeaderboardMetric; label: string; icon: typeof Star }[] = [
    { key: "rating", label: tr("التقييم", "Rating"), icon: Star },
    { key: "completed_orders", label: tr("الطلبات المكتملة", "Completed orders"), icon: Trophy },
    { key: "xp_points", label: tr("نقاط الخبرة", "XP points"), icon: Zap },
  ];

  return (
    <Section
      title={tr("لوحة المتصدرين", "Leaderboard")}
      subtitle={tr(
        "ترتيب استحقاقي صرف من بيانات المنصة الحقيقية — لا ترقية مدفوعة ولا تثبيت.",
        "Purely meritocratic ranking from real platform data — no paid boosting or pinning.",
      )}
    >

      <Card className="mb-6 flex flex-wrap items-center gap-2">
        <span className="me-2 text-sm text-muted-foreground">{tr("الفرز حسب", "Sort by")}</span>
        {metrics.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetric(m.key)}
            aria-pressed={metric === m.key}
            className={`chip ${metric === m.key ? "chip-active" : "chip-hover"}`}
          >
            <m.icon className="size-4" /> {m.label}
          </button>
        ))}
      </Card>

      {board.isLoading ? (
        <div className="grid gap-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-secondary/70" />)}
        </div>
      ) : rankedRows.length === 0 ? (
        <Card className="grid place-items-center gap-3 border-primary/25 px-5 py-14 text-center">
          <Sparkles className="size-7 text-primary" />
          <p className="max-w-lg text-base font-black leading-relaxed sm:text-lg">
            {tr(
              "لا توجد تقييمات أو طلبات مكتملة بعد — الترتيب يبدأ فور تسليم أول طلب",
              "No ratings or completed orders yet — rankings begin after the first delivery.",
            )}
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:hidden">
            {rankedRows.map((seller, index) => {
              const masked = maskUser(seller.display_name || seller.id);
              return (
                <Card key={seller.id} className="p-4">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-lg text-xs font-black ${
                        rankStyles[index] ?? "border border-border text-muted-foreground"
                      }`}
                    >
                      {index === 0 ? <Crown className="size-5" /> : index < 3 ? <Medal className="size-5" /> : index + 1}
                    </span>
                    <div className="flex min-w-0 items-center gap-2.5">
                      {seller.avatar_url ? (
                        <img src={seller.avatar_url} alt={seller.display_name} loading="lazy" className="size-10 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-secondary text-xs font-black">
                          {seller.display_name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-1 font-bold">
                          <span className="truncate font-mono" dir="ltr">{masked}</span>
                          {seller.is_verified && <BadgeCheck className="size-4 shrink-0 text-accent" />}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {tr("المستوى", "Level")} {seller.level}
                        </span>
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-primary" dir="ltr">
                      {metric === "rating"
                        ? seller.rating.toFixed(2)
                        : seller[metric].toLocaleString("en-US")}
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 divide-x divide-x-reverse divide-border border-t border-border pt-3 text-center">
                    <div className="min-w-0 px-1">
                      <dt className="truncate text-[10px] text-muted-foreground">{tr("التقييم", "Rating")}</dt>
                      <dd className="mt-1 font-bold text-primary" dir="ltr">{seller.rating.toFixed(2)}</dd>
                    </div>
                    <div className="min-w-0 px-1">
                      <dt className="truncate text-[10px] text-muted-foreground">{tr("المكتملة", "Completed")}</dt>
                      <dd className="mt-1 font-bold" dir="ltr">{seller.completed_orders.toLocaleString("en-US")}</dd>
                    </div>
                    <div className="min-w-0 px-1">
                      <dt className="truncate text-[10px] text-muted-foreground">XP</dt>
                      <dd className="mt-1 font-bold text-muted-foreground" dir="ltr">{seller.xp_points.toLocaleString("en-US")}</dd>
                    </div>
                  </dl>
                </Card>
              );
            })}
          </div>

        <Card className="hidden overflow-x-auto p-0 sm:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr className="text-start">
                <th className="p-4 text-start font-medium">#</th>
                <th className="p-4 text-start font-medium">{tr("البائع", "Seller")}</th>
                <th className="p-4 text-start font-medium">{tr("التقييم", "Rating")}</th>
                <th className="p-4 text-start font-medium">{tr("الطلبات المكتملة", "Completed")}</th>
                <th className="p-4 text-start font-medium">{tr("نقاط الخبرة", "XP")}</th>
              </tr>
            </thead>
            <tbody>
              {rankedRows.map((s, i) => {
                const masked = maskUser(s.display_name || s.id);
                return (
                  <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/60">
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
                      <span className="flex items-center gap-3">
                        {s.avatar_url ? (
                          <img src={s.avatar_url} alt={s.display_name} loading="lazy" className="size-10 rounded-full object-cover" />
                        ) : (
                          <span className="grid size-10 place-items-center rounded-full border border-border bg-secondary text-xs font-black">
                            {s.display_name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span>
                          <span className="flex items-center gap-1 font-bold">
                            <span className="font-mono" dir="ltr">{masked}</span>
                            {s.is_verified && <BadgeCheck className="size-4 text-accent" />}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {tr("المستوى", "Level")} {s.level}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="p-4 font-bold text-primary">{s.rating.toFixed(2)}</td>
                    <td className="p-4">{s.completed_orders.toLocaleString("en-US")}</td>
                    <td className="p-4 text-muted-foreground">{s.xp_points.toLocaleString("en-US")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        </>
      )}
    </Section>
  );
}
