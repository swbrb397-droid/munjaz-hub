import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, Settings2, Ticket } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useCreatePass, useGovernance, usePasses, useUpdateGovernance, type AccountTier } from "@/lib/governance";

export const Route = createFileRoute("/_authenticated/admin/governance")({
  head: () => ({
    meta: [
      { title: "مولد الاشتراكات وحوكمة الرسوم | الـمُـنْـجِـز" },
      { name: "description", content: "توليد بطاقات اشتراك أحادية الاستخدام وضبط إعدادات الحوكمة: الذكاء المستقل، مدة SLA، وحدود التعبئة." },
      { property: "og:title", content: "مولد الاشتراكات وحوكمة الرسوم | الـمُـنْـجِـز" },
      { property: "og:description", content: "التحكم الكامل بسياسات المنصة وبطاقات الاشتراك." },
    ],
  }),
  component: AdminGovernance,
});

function AdminGovernance() {
  const { tr } = useLang();
  const { isAdmin } = useUserProfile();
  const gov = useGovernance(isAdmin);
  const updateGov = useUpdateGovernance();
  const passes = usePasses(isAdmin);
  const createPass = useCreatePass();

  const [tier, setTier] = useState<AccountTier>("pro");
  const [durationDays, setDurationDays] = useState(30);
  const [validDays, setValidDays] = useState(14);
  const [note, setNote] = useState("");

  const g = gov.data;

  const patch = (p: Record<string, number | boolean>) =>
    updateGov.mutate(p, {
      onSuccess: () => toast.success(tr("تم حفظ الإعدادات ✅", "Settings saved ✅")),
      onError: (e: Error) => toast.error(e.message),
    });

  return (
    <Section
      title={tr("مولد الاشتراكات وحوكمة الرسوم", "Subscription generator & fee governance")}
      subtitle={tr("سياسات المنصة وبطاقات الاشتراك أحادية الاستخدام", "Platform policies and single-use subscription passes")}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="flex items-center gap-2 font-bold"><Settings2 className="size-4 text-primary" /> {tr("إعدادات الحوكمة", "Governance settings")}</h3>
          {gov.isLoading || !g ? (
            <div className="grid place-items-center py-8"><Loader2 className="size-5 animate-spin text-primary" /></div>
          ) : (
            <div className="mt-4 grid gap-3 text-sm">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <span>{tr("الذكاء الاصطناعي المستقل", "Autonomous AI")}</span>
                <input
                  type="checkbox"
                  checked={g.autonomous_ai}
                  onChange={(e) => patch({ autonomous_ai: e.target.checked })}
                  className="size-5 accent-[hsl(var(--primary))]"
                />
              </label>
              {([
                ["ai_confidence_threshold", tr("حد ثقة الذكاء الاصطناعي (%)", "AI confidence threshold (%)"), Number(g.ai_confidence_threshold)],
                ["sla_hours_free", tr("SLA للحساب المجاني (ساعة)", "Free tier SLA (hours)"), g.sla_hours_free],
                ["sla_hours_pro", tr("SLA لحساب Pro (ساعة)", "Pro tier SLA (hours)"), g.sla_hours_pro],
                ["refill_daily_limit", tr("حد التعبئة اليومي (USDT)", "Daily refill limit (USDT)"), Number(g.refill_daily_limit)],
                ["warranty_escrow_pct", tr("نسبة ضمان الاستقرار (%)", "Warranty escrow (%)"), g.warranty_escrow_pct],
                ["auto_release_hours", tr("التحرير التلقائي (ساعة)", "Auto-release (hours)"), g.auto_release_hours],
              ] as const).map(([key, label, value]) => (
                <label key={key} className="grid gap-1.5">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <input
                    type="number"
                    defaultValue={value}
                    dir="ltr"
                    onBlur={(e) => {
                      const next = Number(e.target.value);
                      if (Number.isFinite(next) && next !== value) patch({ [key]: next });
                    }}
                    className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary"
                  />
                </label>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="flex items-center gap-2 font-bold"><Ticket className="size-4 text-accent" /> {tr("مولد بطاقات الاشتراك", "Subscription pass generator")}</h3>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">{tr("الباقة", "Tier")}</span>
              <select value={tier} onChange={(e) => setTier(e.target.value as AccountTier)} className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary">
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="corporate">Corporate</option>
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">{tr("مدة الاشتراك (يوم)", "Duration (days)")}</span>
              <input type="number" dir="ltr" value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">{tr("صلاحية البطاقة (يوم)", "Pass validity (days)")}</span>
              <input type="number" dir="ltr" value={validDays} onChange={(e) => setValidDays(Number(e.target.value))} className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">{tr("ملاحظة", "Note")}</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary" />
            </label>
          </div>
          <button
            type="button"
            disabled={createPass.isPending}
            onClick={() =>
              createPass.mutate(
                { tier, durationDays, validDays, ...(note.trim() ? { note: note.trim() } : {}) },
                {
                  onSuccess: (code) => toast.success(`${tr("تم إنشاء البطاقة", "Pass created")}: ${code}`),
                  onError: (e: Error) => toast.error(e.message),
                },
              )
            }
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {tr("توليد بطاقة", "Generate pass")}
          </button>

          <div className="mt-5 grid gap-2">
            {(passes.data ?? []).slice(0, 10).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                <span className="font-mono font-bold" dir="ltr">{p.code}</span>
                <span className="uppercase text-accent">{p.tier}</span>
                <span className="text-muted-foreground">{p.used_by ? tr("مستخدمة", "Used") : tr("متاحة", "Available")}</span>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(p.code)}
                  className="ms-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1"
                >
                  <Copy className="size-3.5" /> {tr("نسخ", "Copy")}
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Section>
  );
}
