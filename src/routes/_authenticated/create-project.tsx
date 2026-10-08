import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { PROJECT_CATEGORIES, categoryLabel, projectError, useCreateProject, useMyProjects, usd } from "@/lib/projects";
import { useAuth } from "@/hooks/use-auth";
import { sanitizeText } from "@/lib/security";
import { ProjectStatusChip as StatusChip } from "@/components/site/ProjectStatusChip";

export const Route = createFileRoute("/_authenticated/create-project")({
  head: () => ({
    meta: [
      { title: "انشر مشروعاً | المنجز" },
      { name: "description", content: "انشر مشروعك واستقبل عروض المستقلين، وادفع فقط عند قبول العرض عبر الضمان." },
      { property: "og:title", content: "انشر مشروعاً | المنجز" },
      { property: "og:description", content: "استقبل عروضاً سرّية من مستقلين موثوقين بميزانية محمية بالضمان." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateProject,
});

const DAYS = [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90];

function CreateProject() {
  const { tr, lang } = useLang();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const { user } = useAuth();
  const create = useCreateProject();
  const mine = useMyProjects(user?.id);
  const [f, setF] = useState({ title: "", description: "", category: "development", min: "", max: "", days: 7 });

  const min = Number(f.min), max = Number(f.max);
  const errors = {
    title: f.title.trim().length < 10 ? tr("10 أحرف على الأقل", "At least 10 characters") : null,
    description: f.description.trim().length < 50 ? tr(`50 حرفاً على الأقل (${f.description.trim().length})`, `At least 50 characters (${f.description.trim().length})`) : null,
    budget: !(min >= 3) || !(max >= min) ? tr("الحد الأدنى 3 USDT والحد الأعلى لا يقل عن الأدنى", "Min 3 USDT and max must be ≥ min") : null,
  };
  const valid = !errors.title && !errors.description && !errors.budget;
  const field = "w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || create.isPending) return;
    create.mutate(
      { title: sanitizeText(f.title, 120), description: sanitizeText(f.description, 4000), category: f.category, min, max, days: f.days },
      {
        onSuccess: (id) => {
          toast.success(tr("تم نشر مشروعك", "Project published"));
          navigate({ to: "/project/$id", params: { id } });
        },
        onError: (err) => toast.error(projectError(err, ar)),
      },
    );
  };

  return (
    <Section title={tr("انشر مشروعاً جديداً", "Post a new project")} subtitle={tr("لن يُخصم أي مبلغ الآن — تُحجز قيمة العرض في الضمان فقط عند قبولك له.", "Nothing is charged now — the amount is locked in escrow only when you accept a proposal.")}>
      <Card>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="text-muted-foreground">{tr("عنوان المشروع", "Project title")}</span>
            <input className={field} maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            {f.title && errors.title && <span className="text-xs font-bold text-destructive">{errors.title}</span>}
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="text-muted-foreground">{tr("وصف المشروع والمخرجات المطلوبة", "Description & expected deliverables")}</span>
            <textarea className={`${field} min-h-36 resize-y`} maxLength={4000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            <span className={`text-xs ${f.description && errors.description ? "font-bold text-destructive" : "text-muted-foreground"}`}>
              {errors.description ?? <bdi>{f.description.trim().length} / 4000</bdi>}
            </span>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">{tr("التصنيف", "Category")}</span>
            <select className={field} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {PROJECT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{ar ? c.ar : c.en}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">{tr("مدة التسليم المتوقعة", "Expected delivery")}</span>
            <select className={field} value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })}>
              {DAYS.map((d) => <option key={d} value={d}>{d} {d === 1 ? tr("يوم", "day") : tr("أيام", "days")}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">{tr("الميزانية من (USDT)", "Budget from (USDT)")}</span>
            <input className={field} type="number" min={3} step="0.01" inputMode="decimal" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} placeholder="3" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">{tr("إلى (USDT)", "To (USDT)")}</span>
            <input className={field} type="number" min={3} step="0.01" inputMode="decimal" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} />
          </label>
          {(f.min || f.max) && errors.budget && <p className="text-xs font-bold text-destructive sm:col-span-2">{errors.budget}</p>}
          <p className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground sm:col-span-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            {tr("يُمنع وضع أرقام هواتف أو بريد أو روابط تواصل خارجية. التسليم يتبع مهلة الفحص المعتادة للضمان قبل تحرير المبلغ.", "No phone numbers, emails or external contact links. Delivery follows the usual escrow inspection window before release.")}
          </p>
          <div className="sm:col-span-2">
            <button type="submit" disabled={!valid || create.isPending} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50">
              {create.isPending && <Loader2 className="size-4 animate-spin" />} {tr("نشر المشروع", "Publish project")}
            </button>
          </div>
        </form>
      </Card>

      {(mine.data?.length ?? 0) > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-base font-black">{tr("مشاريعي", "My projects")}</h2>
          <div className="grid gap-2">
            {mine.data!.map((p) => (
              <Link key={p.id} to="/project/$id" params={{ id: p.id }} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 hover:border-primary">
                <span className="min-w-0 flex-1 break-words text-sm font-bold">{p.title}</span>
                <span className="text-[11px] text-muted-foreground">{categoryLabel(p.category, ar)} · <bdi>{usd(p.budget_max)}</bdi> USDT · <bdi>{p.proposals_count}</bdi> {tr("عرض", "bids")}</span>
                <StatusChip status={p.status} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}
