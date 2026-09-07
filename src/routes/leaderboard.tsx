import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, Crown, Medal, Sparkles, Star, Trophy, Zap } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useLeaderboard, type LeaderboardMetric } from "@/lib/platform";
import { ghostTag, useGhostMode } from "@/lib/ghost";
import { useAuth } from "@/hooks/use-auth";

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
  const { user } = useAuth();
  const ghost = useGhostMode();
  const tag = ghostTag(user?.id);
  const [metric, setMetric] = useState<LeaderboardMetric>("rating");
  const board = useLeaderboard(metric);
  const rows = board.data ?? [];

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
      {ghost.enabled && (
        <Card className="mb-4 border-violet/40 bg-violet/10 text-xs leading-relaxed text-violet">
          وضع التخفي مُفعّل — يتم إخفاء هويتك في لوحة المتصدرين وسجلات الصفقات العامة واستبدالها بالمعرف المشفر{" "}
          <span className="font-mono font-bold">{tag}</span>
        </Card>
      )}

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
      ) : rows.length === 0 ? (
        <Card className="grid place-items-center gap-2 border-primary/25 py-14 text-center">
          <Sparkles className="size-7 text-primary" />
          <p className="text-lg font-black">{tr("كن أول المتصدرين هذا الأسبوع", "Be the first on the board this week")}</p>
          <p className="max-w-md text-xs text-muted-foreground">
            {tr(
              "الترتيب يُبنى تلقائياً من التقييمات والطلبات المكتملة الحقيقية فور بدء النشاط.",
              "Rankings build automatically from real ratings and completed orders once activity starts.",
            )}
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
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
              {rows.map((s, i) => {
                const masked = ghost.enabled && user?.id === s.id;
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
                            {masked ? <span className="font-mono text-violet">{tag}</span> : s.display_name}
                            {!masked && s.is_verified && <BadgeCheck className="size-4 text-accent" />}
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
      )}
    </Section>
  );
}
