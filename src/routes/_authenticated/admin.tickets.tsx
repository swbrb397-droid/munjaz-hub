import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, LifeBuoy, Loader2, Send } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import {
  adminListTickets,
  adminReplyTicket,
  adminUpdateTicket,
  classifyTicket,
  getTicket,
  type TicketRow,
} from "@/lib/tickets.functions";

export const Route = createFileRoute("/_authenticated/admin/tickets")({
  head: () => ({
    meta: [
      { title: "تذاكر الدعم | لوحة الإدارة" },
      { name: "description", content: "مراجعة تذاكر الدعم المصنّفة بالذكاء الاصطناعي والرد عليها." },
      { property: "og:title", content: "تذاكر الدعم | لوحة الإدارة" },
      { property: "og:description", content: "أداة داخلية للمشرفين." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminTickets,
});

const STATUS_LABELS: Record<TicketRow["status"], [string, string]> = {
  open: ["مفتوحة", "Open"],
  in_review: ["قيد المراجعة", "In review"],
  answered: ["تم الرد", "Answered"],
  closed: ["مغلقة", "Closed"],
};

const PRIORITY_STYLES: Record<TicketRow["priority"], string> = {
  urgent: "bg-destructive/15 text-destructive",
  high: "bg-accent/15 text-accent",
  normal: "bg-secondary text-muted-foreground",
  low: "bg-secondary text-muted-foreground",
};

const PRIORITY_LABELS: Record<TicketRow["priority"], [string, string]> = {
  urgent: ["عاجلة", "Urgent"],
  high: ["عالية", "High"],
  normal: ["عادية", "Normal"],
  low: ["منخفضة", "Low"],
};

const errMsg = (e: unknown, ar: boolean) => {
  const m = (e as Error)?.message ?? "";
  if (m.includes("AI_UNAVAILABLE")) return ar ? "خدمة الذكاء الاصطناعي غير متاحة حالياً" : "AI service unavailable right now";
  if (m.includes("FORBIDDEN")) return ar ? "غير مصرّح" : "Forbidden";
  return ar ? "حدث خطأ، حاول مجدداً" : "Something went wrong";
};

function AdminTickets() {
  const { tr, lang } = useLang();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const list = useServerFn(adminListTickets);
  const update = useServerFn(adminUpdateTicket);

  const [filter, setFilter] = useState<"open" | "in_review" | "answered" | "closed" | undefined>("open");
  const [openId, setOpenId] = useState<string | null>(null);

  const tickets = useQuery({ queryKey: ["admin-tickets", filter ?? "all"], queryFn: () => list({ data: { status: filter } }) });

  const setStatus = async (id: string, status: TicketRow["status"]) => {
    try {
      await update({ data: { id, status } });
      void qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      void qc.invalidateQueries({ queryKey: ["admin-ticket", id] });
    } catch (e) {
      toast.error(errMsg(e, ar));
    }
  };

  const chip = (v: typeof filter, arL: string, enL: string) => (
    <button key={v ?? "all"} type="button" onClick={() => setFilter(v)}
      className={`inline-flex min-h-[36px] items-center rounded-lg px-3 text-xs font-bold ${filter === v ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-secondary"}`}>
      {ar ? arL : enL}
    </button>
  );

  return (
    <Section title={tr("تذاكر الدعم الفني", "Support tickets")} subtitle={tr("الذكاء الاصطناعي يصنّف ويجهّز رداً مقترحاً — القرار والإرسال لك.", "AI classifies and drafts a reply — you decide and send.")}>
      <div className="mb-4 flex flex-wrap gap-2">
        {chip("open", "مفتوحة", "Open")}
        {chip("in_review", "قيد المراجعة", "In review")}
        {chip("answered", "تم الرد", "Answered")}
        {chip("closed", "مغلقة", "Closed")}
        {chip(undefined, "الكل", "All")}
      </div>

      <div className="grid gap-2">
        {tickets.isLoading && <Card><p className="text-sm text-muted-foreground">{tr("جارٍ التحميل…", "Loading…")}</p></Card>}
        {tickets.data?.tickets.length === 0 && <Card><p className="text-sm text-muted-foreground">{tr("لا توجد تذاكر في هذا القسم.", "No tickets in this section.")}</p></Card>}
        {(tickets.data?.tickets ?? []).map((t) => (
          <Card key={t.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => setOpenId(t.id)} className="min-w-0 flex-1 text-start">
                <p className="truncate text-sm font-bold hover:text-primary">{t.subject}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{t.body}</p>
              </button>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PRIORITY_STYLES[t.priority]}`}>{tr(...PRIORITY_LABELS[t.priority])}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{tr(...STATUS_LABELS[t.status])}</span>
              </div>
            </div>
            {t.ai_summary && <p className="mt-2 rounded-lg border border-border bg-surface/60 p-2 text-xs text-muted-foreground"><Bot className="me-1 inline size-3.5 text-primary" />{t.ai_summary}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setOpenId(t.id)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground">
                <LifeBuoy className="size-3.5" />{tr("فتح المحادثة", "Open thread")}
              </button>
              {t.status !== "closed" && (
                <button type="button" onClick={() => void setStatus(t.id, "closed")} className="min-h-[36px] rounded-lg border border-border px-3 text-xs font-bold text-muted-foreground hover:bg-secondary">
                  {tr("إغلاق التذكرة", "Close ticket")}
                </button>
              )}
              <span className="ms-auto text-[10px] text-muted-foreground" dir="ltr">{new Date(t.created_at).toLocaleString(ar ? "ar" : "en")}</span>
            </div>
          </Card>
        ))}
      </div>

      {openId && <AdminThread id={openId} onClose={() => setOpenId(null)} />}
    </Section>
  );
}

function AdminThread({ id, onClose }: { id: string; onClose: () => void }) {
  const { tr, lang } = useLang();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const get = useServerFn(getTicket);
  const reply = useServerFn(adminReplyTicket);
  const classify = useServerFn(classifyTicket);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"reply" | "ai" | null>(null);

  const thread = useQuery({ queryKey: ["admin-ticket", id], queryFn: () => get({ data: { id } }) });
  const ticket = thread.data?.ticket;

  const runClassify = async () => {
    setBusy("ai");
    try {
      const r = await classify({ data: { id } });
      if (r.draft) setText(r.draft);
      toast.success(tr("صنّف الذكاء الاصطناعي التذكرة وجهّز رداً مقترحاً", "AI classified the ticket and drafted a reply"));
      void qc.invalidateQueries({ queryKey: ["admin-ticket", id] });
      void qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    } catch (e) {
      toast.error(errMsg(e, ar));
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    setBusy("reply");
    try {
      await reply({ data: { id, body: text } });
      setText("");
      toast.success(tr("أُرسل الرد وأُشعر المستخدم", "Reply sent and the user was notified"));
      void qc.invalidateQueries({ queryKey: ["admin-ticket", id] });
      void qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    } catch (e) {
      toast.error(errMsg(e, ar));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex max-h-[88dvh] w-full max-w-xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-border p-4">
          <div className="min-w-0">
            <p className="truncate font-bold">{ticket?.subject ?? "…"}</p>
            {ticket && <p className="text-[10px] text-muted-foreground" dir="ltr">{ticket.user_id.slice(0, 8)} · {new Date(ticket.created_at).toLocaleString(ar ? "ar" : "en")}</p>}
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg border border-border px-3 py-1 text-xs font-bold text-muted-foreground hover:text-foreground">
            {tr("إغلاق", "Close")}
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {ticket && (
            <div className="max-w-[90%] rounded-2xl border border-border bg-secondary/60 px-3 py-2 text-sm">{ticket.body}</div>
          )}
          {(thread.data?.messages ?? []).map((m) => (
            <div key={m.id} className={m.is_admin
              ? "ms-auto max-w-[90%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground"
              : "max-w-[90%] rounded-2xl border border-border bg-secondary/60 px-3 py-2 text-sm"}>
              {m.body}
            </div>
          ))}
          {ticket?.ai_summary && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
              <p className="mb-1 flex items-center gap-1 font-bold text-primary"><Bot className="size-3.5" />{tr("ملخص الذكاء الاصطناعي", "AI summary")}</p>
              <p className="text-muted-foreground">{ticket.ai_summary}</p>
            </div>
          )}
        </div>

        <div className="grid gap-2 border-t border-border p-3">
          <button type="button" disabled={busy !== null} onClick={() => void runClassify()}
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-primary/40 px-3 text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-50">
            {busy === "ai" ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
            {tr("تصنيف ذكي + تجهيز رد مقترح", "AI classify + draft reply")}
          </button>
          <div className="flex items-end gap-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={2}
              placeholder={tr("اكتب الرد للمستخدم…", "Write the reply…")}
              className="min-h-11 flex-1 resize-none rounded-xl border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
            <button type="button" disabled={busy !== null || !text.trim()} onClick={() => void send()} aria-label={tr("إرسال", "Send")}
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50">
              {busy === "reply" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 rtl:-scale-x-100" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
