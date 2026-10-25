import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LifeBuoy, Loader2, MessageSquarePlus, Send } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { moderateFields } from "@/lib/chat-moderation";
import { createTicket, getTicket, listMyTickets, replyTicket, type TicketRow } from "@/lib/tickets.functions";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "الدعم الفني | المُنجِز" },
      { name: "description", content: "افتح تذكرة دعم فني أو اقتراحاً وتابع ردود الإدارة عليها." },
      { property: "og:title", content: "الدعم الفني | المُنجِز" },
      { property: "og:description", content: "تواصل مع إدارة المنصة وتابع تذاكرك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});

const CATEGORIES = [
  ["payment", "مدفوعات ومحفظة", "Payments & wallet"],
  ["order", "طلب أو مشروع", "Order or project"],
  ["account", "الحساب والتوثيق", "Account & verification"],
  ["suggestion", "اقتراح تطوير", "Feature suggestion"],
  ["general", "استفسار عام", "General question"],
] as const;

const STATUS_LABELS: Record<TicketRow["status"], [string, string]> = {
  open: ["مفتوحة", "Open"],
  in_review: ["قيد المراجعة", "In review"],
  answered: ["تم الرد", "Answered"],
  closed: ["مغلقة", "Closed"],
};

const ERR: Record<string, [string, string]> = {
  RATE_LIMITED: ["وصلت للحد اليومي (10 تذاكر)", "Daily limit reached (10 tickets)"],
  TOO_MANY_OPEN: ["لديك 5 تذاكر مفتوحة — انتظر الرد عليها أولاً", "You have 5 open tickets — wait for answers first"],
  TICKET_CLOSED: ["هذه التذكرة مغلقة", "This ticket is closed"],
  CONTACT_INFO_BLOCKED: ["لا يُسمح بوضع أرقام أو وسائل تواصل", "Contact details are not allowed"],
  PROFANITY_BLOCKED: ["النص يحتوي ألفاظاً غير لائقة", "Text contains inappropriate words"],
};

const errMsg = (e: unknown, ar: boolean) => {
  const m = (e as Error)?.message ?? "";
  const hit = Object.keys(ERR).find((k) => m.includes(k));
  return hit ? ERR[hit]![ar ? 0 : 1] : ar ? "حدث خطأ، حاول مجدداً" : "Something went wrong, try again";
};

function SupportPage() {
  const { tr, lang } = useLang();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const list = useServerFn(listMyTickets);
  const create = useServerFn(createTicket);

  const tickets = useQuery({ queryKey: ["my-tickets"], queryFn: () => list() });

  const [category, setCategory] = useState<(typeof CATEGORIES)[number][0]>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const submit = async () => {
    const blocked = moderateFields(subject, body);
    if (blocked) {
      toast.error(blocked);
      return;
    }
    setBusy(true);
    try {
      await create({ data: { category, subject, body } });
      toast.success(tr("أُرسلت تذكرتك — ستصلك إشعارات بالرد", "Ticket sent — you'll be notified of replies"));
      setSubject("");
      setBody("");
      void qc.invalidateQueries({ queryKey: ["my-tickets"] });
    } catch (e) {
      toast.error(errMsg(e, ar));
    } finally {
      setBusy(false);
    }
  };

  const input = "min-h-11 w-full rounded-xl border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <Section title={tr("الدعم الفني", "Support")} subtitle={tr("افتح تذكرة وتابع ردود الإدارة — كل المحادثة محفوظة هنا.", "Open a ticket and follow admin replies — the whole conversation stays here.")}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 font-black"><MessageSquarePlus className="size-5 text-primary" />{tr("تذكرة جديدة", "New ticket")}</h2>
          <div className="mt-3 grid gap-3">
            <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={input}>
              {CATEGORIES.map(([v, arL, enL]) => (
                <option key={v} value={v}>{ar ? arL : enL}</option>
              ))}
            </select>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} placeholder={tr("عنوان مختصر (5 أحرف على الأقل)", "Short subject (5+ chars)")} className={input} />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={5} placeholder={tr("اشرح المشكلة أو الاقتراح بالتفصيل…", "Describe the issue or suggestion in detail…")} className={`${input} resize-none`} />
            <button type="button" disabled={busy || subject.trim().length < 5 || body.trim().length < 10} onClick={() => void submit()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 rtl:-scale-x-100" />}
              {tr("إرسال التذكرة", "Send ticket")}
            </button>
          </div>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 font-black"><LifeBuoy className="size-5 text-primary" />{tr("تذاكري", "My tickets")}</h2>
          <div className="mt-3 grid gap-2">
            {tickets.isLoading && <p className="text-sm text-muted-foreground">{tr("جارٍ التحميل…", "Loading…")}</p>}
            {tickets.data?.tickets.length === 0 && <p className="text-sm text-muted-foreground">{tr("لا توجد تذاكر بعد.", "No tickets yet.")}</p>}
            {(tickets.data?.tickets ?? []).map((t) => (
              <button key={t.id} type="button" onClick={() => setOpenId(t.id)}
                className="rounded-xl border border-border p-3 text-start transition-colors hover:border-primary/50">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold">{t.subject}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${t.status === "answered" ? "bg-primary/15 text-primary" : t.status === "closed" ? "bg-secondary text-muted-foreground" : "bg-accent/15 text-accent"}`}>
                    {tr(...STATUS_LABELS[t.status])}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{t.body}</p>
                <p className="mt-1 text-[10px] text-muted-foreground" dir="ltr">{new Date(t.created_at).toLocaleDateString(ar ? "ar" : "en")}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {openId && <TicketThread id={openId} onClose={() => setOpenId(null)} />}
    </Section>
  );
}

function TicketThread({ id, onClose }: { id: string; onClose: () => void }) {
  const { tr, lang } = useLang();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const get = useServerFn(getTicket);
  const reply = useServerFn(replyTicket);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const thread = useQuery({ queryKey: ["ticket", id], queryFn: () => get({ data: { id } }) });
  const ticket = thread.data?.ticket;

  const send = async () => {
    const blocked = moderateFields(text);
    if (blocked) {
      toast.error(blocked);
      return;
    }
    setBusy(true);
    try {
      await reply({ data: { id, body: text } });
      setText("");
      void qc.invalidateQueries({ queryKey: ["ticket", id] });
      void qc.invalidateQueries({ queryKey: ["my-tickets"] });
    } catch (e) {
      toast.error(errMsg(e, ar));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-border p-4">
          <p className="truncate font-bold">{ticket?.subject ?? "…"}</p>
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1 text-xs font-bold text-muted-foreground hover:text-foreground">
            {tr("إغلاق", "Close")}
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {ticket && (
            <div className="max-w-[90%] rounded-2xl rounded-ts-sm bg-primary px-3 py-2 text-sm text-primary-foreground ms-auto">
              {ticket.body}
            </div>
          )}
          {(thread.data?.messages ?? []).map((m) => (
            <div key={m.id} className={m.is_admin
              ? "me-auto max-w-[90%] rounded-2xl rounded-ss-sm border border-border bg-secondary/60 px-3 py-2 text-sm"
              : "ms-auto max-w-[90%] rounded-2xl rounded-ts-sm bg-primary px-3 py-2 text-sm text-primary-foreground"}>
              {m.is_admin && <p className="mb-1 text-[10px] font-bold text-primary">{tr("إدارة المنصة", "Platform team")}</p>}
              {m.body}
            </div>
          ))}
        </div>
        {ticket && ticket.status !== "closed" ? (
          <div className="flex items-end gap-2 border-t border-border p-3">
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={2}
              placeholder={tr("اكتب ردك…", "Write your reply…")}
              className="min-h-11 flex-1 resize-none rounded-xl border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
            <button type="button" disabled={busy || !text.trim()} onClick={() => void send()} aria-label={tr("إرسال", "Send")}
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 rtl:-scale-x-100" />}
            </button>
          </div>
        ) : (
          <p className="border-t border-border p-3 text-center text-xs text-muted-foreground">{tr("هذه التذكرة مغلقة — افتح تذكرة جديدة إن احتجت.", "This ticket is closed — open a new one if needed.")}</p>
        )}
      </div>
    </div>
  );
}
