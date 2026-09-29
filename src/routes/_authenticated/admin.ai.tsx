import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, Gavel, ImageOff, Loader2, Radar } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { supabase } from "@/lib/cloud-client";
import { aiCoverAuditor, aiDisputeCopilot, aiFraudInspector } from "@/lib/admin-ai.functions";

export const Route = createFileRoute("/_authenticated/admin/ai")({
  head: () => ({
    meta: [
      { title: "مساعد الذكاء الاصطناعي للإدارة | المنجز" },
      { name: "description", content: "أدوات ذكاء اصطناعي للمشرفين: تحكيم النزاعات، رصد الاحتيال، وتدقيق أغلفة العروض." },
      { property: "og:title", content: "مساعد الذكاء الاصطناعي للإدارة | المنجز" },
      { property: "og:description", content: "أدوات استشارية للمشرفين فقط." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminAi,
});

const errMsg = (e: unknown) => {
  const m = (e as Error)?.message ?? "";
  if (m.includes("FORBIDDEN")) return "صلاحيات غير كافية";
  if (m.includes("AI_UNAVAILABLE")) return "خدمة الذكاء الاصطناعي غير متاحة حالياً، حاول لاحقاً";
  return m || "حدث خطأ";
};

function AdminAi() {
  const dispute = useServerFn(aiDisputeCopilot);
  const fraud = useServerFn(aiFraudInspector);
  const covers = useServerFn(aiCoverAuditor);

  const cases = useQuery({
    queryKey: ["ai-open-cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispute_cases")
        .select("id,reason,status,created_at")
        .in("status", ["open", "ai_reviewed"])
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [caseId, setCaseId] = useState("");
  const [report, setReport] = useState<string | null>(null);
  const [fraudOut, setFraudOut] = useState<Awaited<ReturnType<typeof aiFraudInspector>> | null>(null);
  const [coverOut, setCoverOut] = useState<Awaited<ReturnType<typeof aiCoverAuditor>>["results"] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-60";

  return (
    <Section title="مساعد الذكاء الاصطناعي للإدارة" subtitle="كل النتائج استشارية فقط — القرار النهائي للمشرف.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 font-black"><Gavel className="size-5 text-primary" />مساعد تحكيم النزاعات</h2>
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="mt-3 min-h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm">
            <option value="">اختر نزاعاً مفتوحاً…</option>
            {(cases.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.reason.slice(0, 60)}</option>
            ))}
          </select>
          <button className={`${btn} mt-3 w-full`} disabled={!caseId || busy !== null}
            onClick={() => run("d", async () => setReport((await dispute({ data: { caseId } })).report))}>
            {busy === "d" ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}إنشاء تقرير استشاري
          </button>
          {report && <div className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-surface/60 p-3 text-sm leading-relaxed">{report}</div>}
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 font-black"><Radar className="size-5 text-primary" />مفتش الاحتيال</h2>
          <p className="mt-1 text-xs text-muted-foreground">آخر 30 يوماً: إيداع ثم سحب سريع دون شراء، وحلقات الإحالة.</p>
          <button className={`${btn} mt-3 w-full`} disabled={busy !== null} onClick={() => run("f", async () => setFraudOut(await fraud()))}>
            {busy === "f" && <Loader2 className="size-4 animate-spin" />}تشغيل الفحص
          </button>
          {fraudOut && (
            <div className="mt-3 grid gap-2 text-xs">
              <p>أنماط خلط أموال: <bdi>{fraudOut.mixing.length}</bdi> · إحالات مكثفة: <bdi>{fraudOut.collusion.length}</bdi> · إحالات متبادلة: <bdi>{fraudOut.rings.length}</bdi></p>
              {fraudOut.mixing.map((m) => (
                <p key={m.userId} className="rounded-lg border border-border p-2" dir="ltr">
                  {m.userId.slice(0, 8)} · dep {m.deposited.toFixed(2)} · wd {m.withdrawn.toFixed(2)} · spent {m.spent.toFixed(2)} · {m.hours}h
                </p>
              ))}
              {fraudOut.summary && <div className="whitespace-pre-wrap rounded-xl border border-border bg-surface/60 p-3 text-sm">{fraudOut.summary}</div>}
              {!fraudOut.mixing.length && !fraudOut.collusion.length && !fraudOut.rings.length && <p className="text-muted-foreground">لا توجد مؤشرات مريبة.</p>}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="flex items-center gap-2 font-black"><ImageOff className="size-5 text-primary" />مدقق أغلفة العروض</h2>
          <p className="mt-1 text-xs text-muted-foreground">يفحص أحدث 12 غلافاً منشوراً ويضع علامة فقط دون حذف.</p>
          <button className={`${btn} mt-3`} disabled={busy !== null} onClick={() => run("c", async () => setCoverOut((await covers()).results))}>
            {busy === "c" && <Loader2 className="size-4 animate-spin" />}تدقيق الأغلفة
          </button>
          {coverOut && (
            <div className="mt-3 grid gap-2 text-sm">
              {coverOut.length === 0 && <p className="text-muted-foreground">لم يتم فحص أي غلاف.</p>}
              {coverOut.map((r) => (
                <p key={r.id} className={`rounded-lg border p-2 ${r.flagged ? "border-destructive text-destructive" : "border-border"}`}>
                  {r.flagged ? "⚠ " : "✓ "}{r.title}{r.reason ? ` — ${r.reason}` : ""}
                </p>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Section>
  );
}
