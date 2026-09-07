import { Crown, Sparkles } from "lucide-react";
import { Card } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { metricBreakdown, nextTier, progressToNext, tierFor, type PrestigeMetrics } from "@/lib/prestige";

/** Interactive prestige tracker: current rank, aura badge and progress to the next tier. */
export function PrestigeTracker({ metrics }: { metrics: PrestigeMetrics }) {
  const { tr } = useLang();
  const tier = tierFor(metrics);
  const next = nextTier(tier);
  const pct = progressToNext(metrics, next);
  const rows = metricBreakdown(metrics, next);

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${tier.badge}`}>
          {tier.aura ? <Crown className="size-4 animate-pulse" /> : <Sparkles className="size-3.5" />}
          {tr(`المستوى ${tier.level} — ${tier.ar}`, `Level ${tier.level} — ${tier.en}`)}
        </span>
        <span className="text-xs text-muted-foreground">
          {tr("سلم الرتب تجميلي بالكامل — النشر متاح للجميع بلا قيود.", "Ranks are purely cosmetic — everyone can publish freely.")}
        </span>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {next
          ? tr(`التقدّم نحو المستوى ${next.level} — ${next.ar}`, `Progress toward level ${next.level} — ${next.en}`)
          : tr("بلغتَ قمة الهيمنة.", "You have reached the apex.")}
      </p>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-secondary">
        <div className="h-3 rounded-full bg-gradient-to-l from-primary to-accent transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs font-bold text-primary">{pct}%</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.key} className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{tr(r.ar, r.en)}</span>
              <span className="font-bold">
                {r.key === "rating" ? r.value.toFixed(2) : Math.round(r.value).toLocaleString()}
                {next ? ` / ${r.key === "rating" ? r.target.toFixed(2) : Math.round(r.target).toLocaleString()}` : ""}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-1.5 rounded-full bg-primary/80 transition-[width] duration-700" style={{ width: `${r.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
