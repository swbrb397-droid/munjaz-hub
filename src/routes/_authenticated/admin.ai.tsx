import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, Gavel, ImageOff, Loader2, Lock, Radar, Send, ShieldCheck } from "lucide-react";
import { MfaChallengeDialog } from "@/components/site/MfaChallengeDialog";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { translateAuthError } from "@/lib/auth-errors";
import { supabase } from "@/lib/cloud-client";
import { aiCoverAuditor, aiDisputeCopilot, aiExecutiveChat, aiFraudInspector } from "@/lib/admin-ai.functions";

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

const errMsg = (e: unknown, ar: boolean) => {
  const m = (e as Error)?.message ?? "";
  if (m.includes("MFA_REQUIRED")) return ar ? "انتهت الجلسة الأمنية — أدخل رمز المصادقة الثنائية مجدداً" : "Secure session expired — enter your 2FA code again";
  if (m.includes("AI_UNAVAILABLE")) return ar ? "خدمة الذكاء الاصطناعي غير متاحة حالياً، حاول لاحقاً" : "The AI service is unavailable right now, try again later";
  return translateAuthError(e, ar);
};

function AdminAi() {
  const { tr, lang } = useLang();
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
      toast.error(errMsg(e, lang === "ar"));
    } finally {
      setBusy(null);
    }
  };

  const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-60";

  return (
    <Section title={tr("مساعد الذكاء الاصطناعي للإدارة", "Admin AI assistant")} subtitle={tr("كل النتائج استشارية فقط — القرار النهائي للمشرف.", "All results are advisory only — the admin makes the final decision.")}>
      <div className="grid gap-4 lg:grid-cols-2">
        <ExecutiveCopilot />
        <Card>
          <h2 className="flex items-center gap-2 font-black"><Gavel className="size-5 text-primary" />{tr("مساعد تحكيم النزاعات", "Dispute arbitration co-pilot")}</h2>
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="mt-3 min-h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm">
            <option value="">{tr("اختر نزاعاً مفتوحاً…", "Pick an open dispute…")}</option>
            {(cases.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.reason.slice(0, 60)}</option>
            ))}
          </select>
          <button className={`${btn} mt-3 w-full`} disabled={!caseId || busy !== null}
            onClick={() => run("d", async () => setReport((await dispute({ data: { caseId } })).report))}>
            {busy === "d" ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}{tr("إنشاء تقرير استشاري", "Generate advisory report")}
          </button>
          {report && <div className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-surface/60 p-3 text-sm leading-relaxed">{report}</div>}
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 font-black"><Radar className="size-5 text-primary" />{tr("مفتش الاحتيال", "Fraud inspector")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{tr("آخر 30 يوماً: إيداع ثم سحب سريع دون شراء، وحلقات الإحالة.", "Last 30 days: rapid deposit-then-withdraw without purchases, and referral loops.")}</p>
          <button className={`${btn} mt-3 w-full`} disabled={busy !== null} onClick={() => run("f", async () => setFraudOut(await fraud()))}>
            {busy === "f" && <Loader2 className="size-4 animate-spin" />}{tr("تشغيل الفحص الآن", "Run scan now")}
          </button>
          {fraudOut && (
            <div className="mt-3 grid gap-2 text-xs">
              <p>{tr("أنماط خلط أموال:", "Mixing patterns:")} <bdi>{fraudOut.mixing.length}</bdi> · {tr("إحالات مكثفة:", "Heavy referrers:")} <bdi>{fraudOut.collusion.length}</bdi> · {tr("إحالات متبادلة:", "Mutual referrals:")} <bdi>{fraudOut.rings.length}</bdi></p>
              {fraudOut.mixing.map((m) => (
                <p key={m.userId} className="rounded-lg border border-border p-2" dir="ltr">
                  {m.userId.slice(0, 8)} · dep {m.deposited.toFixed(2)} · wd {m.withdrawn.toFixed(2)} · spent {m.spent.toFixed(2)} · {m.hours}h
                </p>
              ))}
              {fraudOut.summary && <div className="whitespace-pre-wrap rounded-xl border border-border bg-surface/60 p-3 text-sm">{fraudOut.summary}</div>}
              {!fraudOut.mixing.length && !fraudOut.collusion.length && !fraudOut.rings.length && <p className="text-muted-foreground">{tr("لا توجد مؤشرات مريبة.", "No suspicious signals.")}</p>}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="flex items-center gap-2 font-black"><ImageOff className="size-5 text-primary" />{tr("مدقق أغلفة العروض", "Listing cover auditor")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{tr("يفحص أحدث 12 غلافاً منشوراً ويضع علامة فقط دون حذف.", "Checks the 12 latest published covers and only flags them — nothing is deleted.")}</p>
          <button className={`${btn} mt-3`} disabled={busy !== null} onClick={() => run("c", async () => setCoverOut((await covers()).results))}>
            {busy === "c" && <Loader2 className="size-4 animate-spin" />}{tr("تدقيق الأغلفة", "Audit covers")}
          </button>
          {coverOut && (
            <div className="mt-3 grid gap-2 text-sm">
              {coverOut.length === 0 && <p className="text-muted-foreground">{tr("لم يتم فحص أي غلاف.", "No covers were checked.")}</p>}
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

const IDLE_MS = 30 * 60 * 1000;
type ChatMsg = { role: "user" | "assistant"; content: string };

/** Private admin chat. Locked behind a fresh 2FA code each time the page opens; relocks after 30 min idle. */
function ExecutiveCopilot() {
  const { tr, lang } = useLang();
  const chat = useServerFn(aiExecutiveChat);
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined);
  const [challenge, setChallenge] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const lastActive = useRef(Date.now());
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void supabase.auth.mfa.listFactors().then(({ data }) => {
      const f = data?.totp?.find((x) => x.status === "verified");
      setFactorId(f?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    const id = window.setInterval(() => {
      if (Date.now() - lastActive.current > IDLE_MS) {
        setUnlocked(false);
        setMsgs([]);
        toast.info(tr("أُغلقت الجلسة الأمنية بعد 30 دقيقة من عدم النشاط", "Secure session locked after 30 minutes idle"));
      }
    }, 30_000);
    return () => window.clearInterval(id);
  }, [unlocked, tr]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = async () => {
    const q = text.trim();
    if (!q || busy) return;
    lastActive.current = Date.now();
    const next = [...msgs, { role: "user" as const, content: q.slice(0, 4000) }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const { reply } = await chat({ data: { messages: next.slice(-20) } });
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      const m = (e as Error)?.message ?? "";
      if (m.includes("MFA_REQUIRED")) setUnlocked(false);
      toast.error(errMsg(e, lang === "ar"));
    } finally {
      setBusy(false);
      lastActive.current = Date.now();
    }
  };

  return (
    <Card className="lg:col-span-2">
      <h2 className="flex items-center gap-2 font-black"><ShieldCheck className="size-5 text-primary" />{tr("المستشار التنفيذي الخاص", "Private executive copilot")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{tr("محادثة خاصة بالمدير يطّلع فيها المساعد على مؤشرات المنصة الحية — استشارية فقط ولا تنفذ أي إجراء.", "Admin-only chat grounded on live platform metrics — advisory only, it never performs actions.")}</p>
      {!unlocked ? (
        <div className="mt-4 grid place-items-center gap-3 rounded-xl border border-dashed border-border p-6 text-center">
          <Lock className="size-8 text-primary" />
          {factorId === null ? (
            <p className="text-sm text-muted-foreground">{tr("فعّل المصادقة الثنائية من صفحة الملف الشخصي أولاً لفتح المستشار.", "Enable two-factor authentication in your profile first to open the copilot.")}</p>
          ) : (
            <button type="button" disabled={!factorId} onClick={() => setChallenge(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60">
              {factorId === undefined && <Loader2 className="size-4 animate-spin" />}{tr("فتح الجلسة برمز المصادقة", "Unlock with 2FA code")}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <div className="grid max-h-[28rem] min-h-48 content-start gap-3 overflow-y-auto rounded-xl border border-border bg-surface/40 p-3">
            {msgs.length === 0 && <p className="text-xs text-muted-foreground">{tr("اسألني عن أداء المنصة، النزاعات، السحوبات، السياسات أو أي قرار تفكر فيه.", "Ask about performance, disputes, withdrawals, policies or any decision.")}</p>}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ms-auto max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground" : "max-w-full whitespace-pre-wrap break-words text-sm leading-relaxed"}>
                {m.content}
              </div>
            ))}
            {busy && <Loader2 className="size-4 animate-spin text-primary" />}
            <div ref={endRef} />
          </div>
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <textarea value={text} maxLength={4000} onChange={(e) => { setText(e.target.value); lastActive.current = Date.now(); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              className="min-h-11 flex-1 resize-none rounded-xl border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary" rows={2}
              placeholder={tr("اكتب سؤالك…", "Type your question…")} />
            <button type="submit" aria-label={tr("إرسال", "Send")} disabled={busy || !text.trim()} className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50">
              <Send className="size-4" />
            </button>
          </form>
          <button type="button" onClick={() => { setUnlocked(false); setMsgs([]); }} className="justify-self-start text-xs font-bold text-muted-foreground hover:text-destructive">{tr("قفل الجلسة الآن", "Lock now")}</button>
        </div>
      )}
      {challenge && factorId && (
        <MfaChallengeDialog
          factorId={factorId}
          title={tr("تأكيد هويتك لفتح المستشار", "Verify to open the copilot")}
          onVerified={() => { setUnlocked(true); setChallenge(false); lastActive.current = Date.now(); }}
          onClose={() => setChallenge(false)}
        />
      )}
    </Card>
  );
}
