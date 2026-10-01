import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Crown, Medal, Sparkles } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useLeaderboard } from "@/lib/platform";


export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "لوحة المتصدرين | المنجز" },
      { name: "description", content: "ترتيب البائعين في المنجز وفق التقييم الحقيقي وعدد الطلبات المكتملة ونقاط الخبرة — بدون أي ترقية مدفوعة." },
      { property: "og:title", content: "لوحة المتصدرين | المنجز" },
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
  const board = useLeaderboard();
  const rankedRows = board.data ?? [];

  return (
    <Section
      title={tr("لوحة المتصدرين", "Leaderboard")}
      subtitle={tr(
        "ترتيب استحقاقي صرف من بيانات المنصة الحقيقية — لا ترقية مدفوعة ولا تثبيت.",
        "Purely meritocratic ranking from real platform data — no paid boosting or pinning.",
      )}
    >

      <Card className="mb-6 grid gap-1 text-xs leading-relaxed text-muted-foreground">
        <span className="font-bold text-foreground">{tr("معادلة الكفاءة الاستحقاقية", "Meritocratic efficiency score")}</span>
        <span dir="ltr" className="font-mono text-primary">
          Score = Completed×10 + Rating×20 − DisputeRate×50 + SpeedBonus(0–15)
        </span>
        <span>{tr("تُستبعد الحسابات المجمدة ومن ليس لديهم طلبات مكتملة. تتحدث كل دقيقة.", "Frozen accounts and sellers with no completed orders are excluded. Refreshes every minute.")}</span>
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
              const masked = seller.display_name?.trim() || seller.id.slice(0, 8);
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
                          <span className="truncate">{masked}</span>
                          {seller.is_verified && <BadgeCheck className="size-4 shrink-0 text-accent" />}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {tr("المستوى", "Level")} {seller.level}
                        </span>
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-primary" dir="ltr">
                      {seller.merit_score.toFixed(2)}
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
                      <dt className="truncate text-[10px] text-muted-foreground">{tr("النزاعات", "Disputes")}</dt>
                      <dd className="mt-1 font-bold text-muted-foreground" dir="ltr">{(seller.dispute_rate * 100).toFixed(2)}%</dd>
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
                <th className="p-4 text-start font-medium">{tr("نسبة النزاعات", "Dispute rate")}</th>
                <th className="p-4 text-start font-medium">{tr("نقاط الكفاءة", "Merit score")}</th>
              </tr>
            </thead>
            <tbody>
              {rankedRows.map((s, i) => {
                const masked = s.display_name?.trim() || s.id.slice(0, 8);
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
                            <span className="truncate">{masked}</span>
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
                    <td className="p-4 text-muted-foreground" dir="ltr">{(s.dispute_rate * 100).toFixed(2)}%</td>
                    <td className="p-4 font-black text-primary" dir="ltr">{s.merit_score.toFixed(2)}</td>
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
