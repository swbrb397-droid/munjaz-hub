import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Briefcase, Clock, PlusCircle, ShieldCheck, Users } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { PROJECT_CATEGORIES, categoryLabel, usd, useOpenProjects } from "@/lib/projects";
import { relativeAgo } from "@/lib/presence";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "المشاريع المفتوحة | المنجز" },
      { name: "description", content: "تصفّح المشاريع المفتوحة على المنجز وقدّم عرضك — الميزانية تُحجز في الضمان فور قبول عرضك وتُصرف بـ USDT." },
      { property: "og:title", content: "المشاريع المفتوحة | المنجز" },
      { property: "og:description", content: "مشاريع حقيقية بميزانيات محمية بالضمان ودفع فوري بـ USDT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { tr, lang } = useLang();
  const ar = lang === "ar";
  const { isAuthenticated } = useAuth();
  const [cat, setCat] = useState("all");
  const projects = useOpenProjects(cat);
  const rows = projects.data ?? [];

  return (
    <Section
      title={tr("المشاريع المفتوحة", "Open projects")}
      subtitle={tr("قدّم عرضك — الميزانية تُحجز في الضمان لحظة القبول، فلا عمل بلا ضمان.", "Bid now — the budget is locked in escrow the moment you're hired.")}
      action={
        <Link to={isAuthenticated ? "/create-project" : "/auth"} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
          <PlusCircle className="size-4" /> {tr("انشر مشروعاً", "Post a project")}
        </Link>
      }
    >
      <Card className="mb-4 flex items-start gap-2 border-primary/30 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          {tr(
            "عروض المستقلين سرّية: لا يراها إلا صاحب المشروع. التواصل خارج المنصة ممنوع لحماية الطرفين بالضمان.",
            "Proposals are private: only the project owner sees them. Off-platform contact is blocked to keep both sides protected.",
          )}
        </span>
      </Card>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {[{ key: "all", ar: "الكل", en: "All" }, ...PROJECT_CATEGORIES].map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCat(c.key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${cat === c.key ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
          >
            {ar ? c.ar : c.en}
          </button>
        ))}
      </div>

      {projects.isLoading ? (
        <div className="grid gap-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-secondary/70" />)}</div>
      ) : rows.length === 0 ? (
        <Card className="grid place-items-center gap-3 py-14 text-center">
          <Briefcase className="size-7 text-primary" />
          <p className="text-sm font-bold">{tr("لا توجد مشاريع مفتوحة في هذا التصنيف حالياً", "No open projects in this category yet")}</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((p) => (
            <Link key={p.id} to="/project/$id" params={{ id: p.id }} className="block min-w-0 rounded-xl border border-border bg-card/70 p-4 transition hover:border-primary">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 flex-1 break-words text-sm font-black sm:text-base">{p.title}</h2>
                <span className="shrink-0 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                  <bdi>{usd(p.budget_min)} – {usd(p.budget_max)}</bdi> USDT
                </span>
              </div>
              <p className="mt-2 line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground">{p.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span className="rounded bg-secondary px-2 py-0.5">{categoryLabel(p.category, ar)}</span>
                <span className="inline-flex items-center gap-1"><Clock className="size-3" /> <bdi>{p.delivery_days}</bdi> {tr("يوم", "days")}</span>
                <span className="inline-flex items-center gap-1"><Users className="size-3" /> <bdi>{p.proposals_count}</bdi> {tr("عرض", "proposals")}</span>
                <span>{relativeAgo(p.created_at, ar)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}
