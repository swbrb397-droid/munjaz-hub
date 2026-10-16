import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Paperclip, X, Clapperboard, Code2, Loader2, Megaphone, Palette, PenLine, Shapes, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { PROJECT_CATEGORIES, PROJECT_FILES_BUCKET, PROJECT_FILE_MAX_MB, type ProjectAttachment, categoryLabel, projectError, useCreateProject, useMyProjects, usd } from "@/lib/projects";
import { useAuth } from "@/hooks/use-auth";
import { sanitizeText } from "@/lib/security";
import { moderateFields } from "@/lib/chat-moderation";
import { isDangerousFile } from "@/lib/file-guard";
import { supabase } from "@/lib/cloud-client";
import { PRESTIGE_TIERS } from "@/lib/prestige";
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

const DAYS = [
  { v: 1, ar: "يوم", en: "1 day" },
  { v: 2, ar: "يومان", en: "2 days" },
  { v: 3, ar: "3 أيام", en: "3 days" },
  { v: 7, ar: "أسبوع", en: "1 week" },
  { v: 14, ar: "أسبوعان", en: "2 weeks" },
  { v: 30, ar: "شهر", en: "1 month" },
];

const CAT_ICONS: Record<string, LucideIcon> = {
  development: Code2,
  design: Palette,
  writing: PenLine,
  marketing: Megaphone,
  video: Clapperboard,
  ai: Sparkles,
  other: Shapes,
};

function CreateProject() {
  const { tr, lang } = useLang();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const { user } = useAuth();
  const create = useCreateProject();
  const mine = useMyProjects(user?.id);
  const [f, setF] = useState({ title: "", description: "", category: "development", min: "", max: "", days: 7 });
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState("");
  const [screening, setScreening] = useState("");
  const [minLevel, setMinLevel] = useState(1);
  const [files, setFiles] = useState<ProjectAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const addSkill = () => {
    const v = skillDraft.trim().slice(0, 40);
    if (!v) return;
    if (skills.length >= 5) { toast.error(tr("الحد الأقصى 5 مهارات", "Maximum 5 skills")); return; }
    const bad = moderateFields(v);
    if (bad) { toast.error(bad); return; }
    if (!skills.includes(v)) setSkills([...skills, v]);
    setSkillDraft("");
  };

  const uploadFile = async (file: File) => {
    if (!user) return;
    if (files.length >= 3) { toast.error(tr("الحد الأقصى 3 مرفقات", "Maximum 3 attachments")); return; }
    if (isDangerousFile(file.name)) { toast.error(tr("نوع الملف غير مسموح", "File type not allowed")); return; }
    if (file.size > PROJECT_FILE_MAX_MB * 1024 * 1024) { toast.error(tr(`الحجم الأقصى ${PROJECT_FILE_MAX_MB}MB`, `Max size ${PROJECT_FILE_MAX_MB}MB`)); return; }
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const path = `${user.id}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from(PROJECT_FILES_BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (error) throw error;
      setFiles((x) => [...x, { path, name: file.name.slice(0, 160), size: file.size, mime: file.type || "application/octet-stream" }]);
    } catch {
      toast.error(tr("تعذّر رفع الملف", "Upload failed"));
    } finally {
      setUploading(false);
    }
  };
  const removeFile = (path: string) => {
    setFiles((x) => x.filter((a) => a.path !== path));
    void supabase.storage.from(PROJECT_FILES_BUCKET).remove([path]);
  };

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
    if (!valid || create.isPending || uploading) return;
    const bad = moderateFields(f.title, f.description, screening, ...skills);
    if (bad) { toast.error(bad); return; }
    create.mutate(
      {
        title: sanitizeText(f.title, 120), description: sanitizeText(f.description, 4000), category: f.category, min, max, days: f.days,
        skills, screening: sanitizeText(screening, 300), minLevel, attachments: files,
      },
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
          <div className="grid gap-2 text-sm sm:col-span-2" role="radiogroup" aria-label={tr("التصنيف", "Category")}>
            <span className="text-muted-foreground">{tr("التصنيف", "Category")}</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROJECT_CATEGORIES.map((c) => {
                const Icon = CAT_ICONS[c.key] ?? Shapes;
                const on = f.category === c.key;
                return (
                  <button key={c.key} type="button" role="radio" aria-checked={on} onClick={() => setF({ ...f, category: c.key })}
                    className={`relative flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center text-xs font-bold transition ${on ? "border-primary bg-primary/10 text-foreground shadow-[0_0_18px_-4px_var(--primary)]" : "border-border bg-surface text-muted-foreground hover:border-primary/50"}`}>
                    {on && <Check className="absolute end-1.5 top-1.5 size-3.5 text-primary" />}
                    <Icon className={`size-6 ${on ? "text-primary" : ""}`} />
                    {ar ? c.ar : c.en}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2 text-sm sm:col-span-2" role="radiogroup" aria-label={tr("مدة التسليم المتوقعة", "Expected delivery")}>
            <span className="text-muted-foreground">{tr("مدة التسليم المتوقعة", "Expected delivery")}</span>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const on = f.days === d.v;
                return (
                  <button key={d.v} type="button" role="radio" aria-checked={on} onClick={() => setF({ ...f, days: d.v })}
                    className={`h-9 rounded-full border px-4 text-xs font-bold transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground hover:border-primary/50"}`}>
                    {ar ? d.ar : d.en}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2 text-sm sm:col-span-2">
            <span className="text-muted-foreground">{tr("المهارات المطلوبة (حتى 5)", "Required skills (up to 5)")}</span>
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {s}
                  <button type="button" aria-label={tr("حذف", "Remove")} onClick={() => setSkills(skills.filter((x) => x !== s))}><X className="size-3" /></button>
                </span>
              ))}
            </div>
            {skills.length < 5 && (
              <input className={field} value={skillDraft} maxLength={40} placeholder={tr("اكتب مهارة ثم Enter", "Type a skill then Enter")}
                onChange={(e) => setSkillDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(); } }}
                onBlur={addSkill} />
            )}
          </div>
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="text-muted-foreground">{tr("سؤال للمتقدمين (اختياري)", "Screening question (optional)")}</span>
            <input className={field} maxLength={300} value={screening} onChange={(e) => setScreening(e.target.value)} placeholder={tr("مثال: أرسل وصفاً لمشروع مشابه نفذته", "e.g. Describe a similar project you delivered")} />
          </label>
          <div className="grid gap-2 text-sm sm:col-span-2" role="radiogroup" aria-label={tr("الرتبة الدنيا للمستقل", "Minimum freelancer rank")}>
            <span className="text-muted-foreground">{tr("الرتبة الدنيا للمتقدمين", "Minimum freelancer rank")}</span>
            <div className="flex flex-wrap gap-2">
              {PRESTIGE_TIERS.slice(0, 6).map((t) => {
                const on = minLevel === t.level;
                return (
                  <button key={t.level} type="button" role="radio" aria-checked={on} onClick={() => setMinLevel(t.level)}
                    className={`h-9 rounded-full border px-3 text-xs font-bold transition ${on ? `${t.badge} ring-2 ring-primary` : "border-border bg-surface text-muted-foreground"}`}>
                    {t.level === 1 ? tr("الجميع", "Everyone") : ar ? t.ar : t.en}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2 text-sm sm:col-span-2">
            <span className="text-muted-foreground">{tr(`مرفقات توضيحية (حتى 3 ملفات، ${PROJECT_FILE_MAX_MB}MB لكل ملف)`, `Attachments (up to 3, ${PROJECT_FILE_MAX_MB}MB each)`)}</span>
            {files.map((a) => (
              <span key={a.path} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
                <span className="truncate">{a.name}</span>
                <button type="button" aria-label={tr("حذف", "Remove")} onClick={() => removeFile(a.path)}><X className="size-4 text-muted-foreground" /></button>
              </span>
            ))}
            {files.length < 3 && (
              <label className="inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-primary/50 px-4 text-xs font-bold text-primary">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
                {tr("إرفاق ملف", "Attach a file")}
                <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt,.zip" disabled={uploading}
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadFile(file); e.target.value = ""; }} />
              </label>
            )}
          </div>
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
            <button type="submit" disabled={!valid || create.isPending || uploading} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50">
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
