import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, Circle, FileCheck2, FileUp, History, Languages, Lock, Paperclip, Send, ShieldAlert, ShieldCheck, Sparkles, Star, Unlock, Video, X } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { ChatSecurityNotice } from "@/components/site/ChatSecurityNotice";


import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { useOrders } from "@/lib/queries";
import { nextActions, useDeliverables, useOrderTransition, type OrderStatus } from "@/lib/orders";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeText } from "@/lib/security";

type Tr = (ar: string, en: string) => string;

function statusLabel(s: OrderStatus, tr: Tr) {
  const map: Record<OrderStatus, [string, string]> = {
    pending: ["بانتظار التمويل", "Awaiting funding"],
    in_progress: ["قيد التنفيذ", "In progress"],
    delivered: ["تم التسليم", "Delivered"],
    completed: ["مكتمل", "Completed"],
    disputed: ["نزاع", "Disputed"],
    cancelled: ["ملغي", "Cancelled"],
    refunded: ["مسترجع", "Refunded"],
  };
  const [ar, en] = map[s];
  return tr(ar, en);
}

function actionLabel(s: OrderStatus, tr: Tr) {
  switch (s) {
    case "in_progress":
      return tr("تمويل الضمان وبدء التنفيذ", "Fund escrow & start work");
    case "delivered":
      return tr("تسليم العمل للمشتري", "Deliver work to buyer");
    case "completed":
      return tr("اعتماد التسليم وتحرير المبلغ", "Approve delivery & release funds");
    case "cancelled":
      return tr("إلغاء الطلب", "Cancel order");
    default:
      return statusLabel(s, tr);
  }
}

export const Route = createFileRoute("/_authenticated/workspace")({
  head: () => ({
    meta: [
      { title: "مساحة عمل الطلب | الـمُـنْـجِـز" },
      { name: "description", content: "محادثة لحظية مع ترجمة فورية بالذكاء الاصطناعي، مكالمات فيديو، تسليم الملفات، وفتح نزاع محمي بضمان المنصة." },
      { property: "og:title", content: "مساحة عمل الطلب | الـمُـنْـجِـز" },
      { property: "og:description", content: "تواصل، سلّم، وأدر نزاعاتك داخل مساحة عمل واحدة آمنة." },
    ],
  }),
  component: Workspace,
});

type Msg = {
  id: number;
  from: "me" | "them";
  name: string;
  text: string;
  time: string;
  /** Language the message was written in. */
  srcLang?: "ar" | "en";
  /** Machine translation of `text` into the other language. */
  translation?: string;
};

/** Seeded counterpart messages written in the other party's language. */
function seedMessages(lang: "ar" | "en"): Msg[] {
  if (lang === "ar") {
    return [
      {
        id: 1,
        from: "them",
        name: "Alex M.",
        text: "Hi! I've uploaded the first draft, please review the typography and let me know.",
        time: "10:24",
        srcLang: "en",
        translation: "مرحباً! رفعت المسودة الأولى، رجاءً راجع الخطوط وأخبرني برأيك.",
      },
      {
        id: 2,
        from: "them",
        name: "Alex M.",
        text: "Final assets will be delivered before the escrow deadline.",
        time: "10:31",
        srcLang: "en",
        translation: "سيتم تسليم الملفات النهائية قبل انتهاء مهلة الضمان.",
      },
    ];
  }
  return [
    {
      id: 1,
      from: "them",
      name: "سعود ع.",
      text: "أهلاً! رفعت المسودة الأولى، رجاءً راجع الخطوط وأخبرني برأيك.",
      time: "10:24",
      srcLang: "ar",
      translation: "Hi! I've uploaded the first draft, please review the typography and let me know.",
    },
    {
      id: 2,
      from: "them",
      name: "سعود ع.",
      text: "سيتم تسليم الملفات النهائية قبل انتهاء مهلة الضمان.",
      time: "10:31",
      srcLang: "ar",
      translation: "Final assets will be delivered before the escrow deadline.",
    },
  ];
}

const TRANSLATE_PREF_KEY = "munjaz-auto-translate";

function Workspace() {
  const { tr, lang } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orders = useOrders();
  const rows = orders.data ?? [];

  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!selected && rows.length) setSelected(rows[0]!.id);
  }, [rows, selected]);
  const order = rows.find((o) => o.id === selected) ?? null;

  const tabs = [
    { key: "chat", label: tr("المحادثة", "Chat") },
    { key: "files", label: tr("التسليمات", "Deliverables") },
    { key: "timeline", label: tr("السجل الزمني", "Timeline") },
    { key: "dispute", label: tr("النزاع", "Dispute") },
  ] as const;

  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("chat");
  /** null = not answered yet (consent prompt visible). */
  const [translate, setTranslate] = useState<boolean | null>(null);
  useEffect(() => {
    const stored = window.localStorage.getItem(TRANSLATE_PREF_KEY);
    if (stored === "on") setTranslate(true);
    else if (stored === "off") setTranslate(false);
  }, []);
  function setTranslatePref(v: boolean) {
    setTranslate(v);
    window.localStorage.setItem(TRANSLATE_PREF_KEY, v ? "on" : "off");
  }
  const [showOriginal, setShowOriginal] = useState<number[]>([]);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Msg[]>(() => seedMessages(lang));
  const [warning, setWarning] = useState(false);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [disputeMsg, setDisputeMsg] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [deliverable, setDeliverable] = useState("");
  const [draftState, setDraftState] = useState<Record<number, "pending" | "revision" | "approved">>({});

  const addDeliverable = useDeliverables();
  const transition = useOrderTransition();

  // Deadline extension request
  const [extOpen, setExtOpen] = useState(false);
  const [extHours, setExtHours] = useState<24 | 48>(24);
  const [extReason, setExtReason] = useState("");
  const [extDone, setExtDone] = useState<string | null>(null);
  const [extStatus, setExtStatus] = useState<"none" | "pending" | "approved">("none");

  // Post-completion 2-way review
  const [reviewOpen, setReviewOpen] = useState(false);
  const [stars, setStars] = useState({ quality: 5, communication: 5, speed: 5 });
  const [reviewText, setReviewText] = useState("");
  const [reviewDone, setReviewDone] = useState<string | null>(null);

  // Optional milestones tracker
  const [milestonesOn, setMilestonesOn] = useState(false);
  const [released, setReleased] = useState<number[]>([]);
  const milestones = [
    {
      pct: 30,
      label: tr("المرحلة 1: تسليم المسودة الأولى والتصميم الأولي", "Stage 1: first draft & initial design"),
      cta: tr("تحرير جزئي للضمان 30%", "Release 30% of escrow"),
    },
    {
      pct: 70,
      label: tr("المرحلة 2: المراجعة النهائية والتسليم الكامل", "Stage 2: final review & full delivery"),
      cta: tr("تحرير الرصيد المتبقي 70%", "Release remaining 70%"),
    },
  ];
  const autoUpTo = order?.status === "completed" ? 100 : order?.status === "delivered" ? 70 : order?.status === "in_progress" ? 30 : 0;
  const releasedPct = Math.max(autoUpTo, ...released, 0);


  function send() {
    const text = draft.trim();
    if (!text) return;
    if (/@|\+\d{6,}|whatsapp|telegram|واتس|تلجرام/i.test(text)) {
      setWarning(true);
      return;
    }
    setWarning(false);
    setMessages([...messages, { id: Date.now(), from: "me", name: tr("أنا", "Me"), text, time: tr("الآن", "Now") }]);
    setDraft("");
  }

  const openDispute = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error(tr("اختر طلباً أولاً", "Select an order first"));
      if (!reason.trim()) throw new Error(tr("اكتب سبب النزاع", "Describe the dispute reason"));
      const against = order.buyer_id === user!.id ? order.seller_id : order.buyer_id;
      const { error } = await supabase.from("dispute_cases").insert({
        order_id: order.id,
        kind: "dispute",
        raised_by: user!.id,
        against_user: against,
        reason: sanitizeText(reason, 2000),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReason("");
      setDisputeMsg(tr("تم فتح النزاع وسيراجعه وكيل الذكاء الاصطناعي.", "Dispute opened; the AI agent will review it."));
      qc.invalidateQueries({ queryKey: ["disputes"] });
    },
    onError: (e: Error) => setDisputeMsg(e.message),
  });

  return (
    <Section
      title={order ? tr(`مساحة عمل الطلب #MJ-${order.order_number}`, `Order workspace #MJ-${order.order_number}`) : tr("مساحة عمل الطلب", "Order workspace")}
      subtitle={order ? `${order.title} · ${Number(order.amount_usdt)} USDT · ${statusLabel(order.status, tr)}` : tr("لا توجد طلبات بعد", "No orders yet")}
      action={
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent">
            <Video className="size-4" /> {tr("بدء مكالمة فيديو", "Start video call")}
          </button>
          <button
            type="button"
            onClick={() => setExtOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold"
          >
            <CalendarClock className="size-4" /> {tr("طلب تمديد مهلة التسليم", "Request deadline extension")}
            {extStatus !== "none" && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${extStatus === "approved" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
                {extStatus === "approved" ? tr("تمت الموافقة", "Approved") : tr("قيد الانتظار", "Pending")}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold"
          >
            <Star className="size-4 text-accent" /> {tr("تقييم الطرف الآخر", "Review the other party")}
          </button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="flex min-h-[560px] flex-col">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-3 py-1.5 text-sm ${tab === t.key ? "bg-secondary font-bold text-primary" : "text-muted-foreground"}`}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={() => setTranslate(!translate)}
              className={`ms-auto inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${translate ? "bg-primary font-bold text-primary-foreground" : "border border-border text-muted-foreground"}`}
            >
              <Languages className="size-4" /> {tr("ترجمة AI", "AI Translate")}
            </button>
          </div>

          {tab === "chat" && (
            <>
              <div className="pt-3"><ChatSecurityNotice /></div>
              <div className="flex-1 space-y-3 overflow-y-auto py-4">
                {messages.length === 0 && (

                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {tr("ابدأ المحادثة مع الطرف الآخر.", "Start the conversation with the other party.")}
                  </p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.from === "them" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${m.from === "them" ? "bg-secondary" : "bg-primary text-primary-foreground"}`}>
                      <p className="mb-1 text-xs opacity-70">{m.name} · {m.time}</p>
                      <p>{m.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {warning && (
                <p className="mb-2 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <ShieldAlert className="size-4" /> {tr("تم حظر الرسالة: محاولة تبادل وسائل تواصل خارجية.", "Message blocked: attempt to exchange external contact info.")}
                </p>
              )}

              <div className="flex items-center gap-2 border-t border-border pt-3">
                <button className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground" aria-label={tr("إرفاق ملف", "Attach file")}>
                  <Paperclip className="size-4" />
                </button>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder={tr(
                    "🛡️ حماية الضمان: يمنع مشاركة وسائل التواصل الخارجية لضمان حقوقك المالية وسريان نظام الـ Escrow.",
                    "🛡️ Escrow protection: sharing external contact details is prohibited to protect your funds and keep escrow valid.",
                  )}

                  className="flex-1 rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button onClick={send} className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground" aria-label={tr("إرسال", "Send")}>
                  <Send className="size-4" />
                </button>
              </div>
            </>
          )}

          {tab === "files" && (
            <div className="flex-1 py-4">
              <div className="grid place-items-center rounded-xl border border-dashed border-border p-10 text-center">
                <FileUp className="size-8 text-primary" />
                <p className="mt-3 font-semibold">{tr("اسحب ملفات التسليم هنا", "Drag deliverable files here")}</p>
                <p className="text-xs text-muted-foreground">{tr("حتى 2GB لكل ملف · تُفتح للمشتري بعد اعتماد المرحلة", "Up to 2GB per file · unlocked for the buyer after milestone approval")}</p>
              </div>
              {order && order.seller_id === user?.id && (
                <div className="mt-4 flex items-center gap-2">
                  <input
                    value={deliverable}
                    onChange={(e) => setDeliverable(e.target.value)}
                    placeholder={tr("رابط أو وصف التسليم (Drive, Figma, ...)", "Deliverable link or description (Drive, Figma, ...)")}
                    className="flex-1 rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => {
                      const v = deliverable.trim();
                      if (!v) return;
                      const current = Array.isArray(order.deliverables) ? (order.deliverables as unknown[]).map(String) : [];
                      addDeliverable.mutate({ id: order.id, deliverables: [...current, v] }, { onSuccess: () => setDeliverable("") });
                    }}
                    disabled={addDeliverable.isPending}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {tr("إضافة", "Add")}
                  </button>
                </div>
              )}
              <div className="mt-4 grid gap-2">
                {(Array.isArray(order?.deliverables) ? (order!.deliverables as unknown[]) : []).map((d, i) => (
                  <div key={i} className="rounded-lg border border-border px-4 py-3 text-sm break-all">{String(d)}</div>
                ))}
              </div>
            </div>
          )}

          {tab === "dispute" && (
            <div className="flex-1 py-4">
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
                <p className="flex items-center gap-2 font-bold text-destructive"><AlertTriangle className="size-4" /> {tr("فتح نزاع", "Open a dispute")}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tr("سيراجع وكيل الذكاء الاصطناعي نطاق العمل والمحادثة وملفات التسليم ويصدر حكماً أولياً خلال دقائق، مع إمكانية التصعيد البشري.", "An AI agent will review the scope, chat history, and deliverables, and issue a preliminary ruling within minutes, with the option to escalate to a human.")}
                </p>
              </div>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={5} placeholder={tr("اشرح سبب النزاع بالتفصيل...", "Explain the reason for the dispute in detail...")} className="mt-4 w-full rounded-xl border border-input bg-surface p-3 text-sm outline-none focus:border-primary" />
              <button onClick={() => openDispute.mutate()} disabled={openDispute.isPending} className="mt-3 rounded-xl bg-destructive px-4 py-2 font-bold text-destructive-foreground disabled:opacity-60">
                {tr("إرسال طلب النزاع", "Submit dispute request")}
              </button>
              {disputeMsg && <p className="mt-3 text-xs text-primary">{disputeMsg}</p>}
            </div>
          )}
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <h3 className="font-bold">{tr("طلباتي", "My orders")}</h3>
            <div className="mt-3 grid gap-2 text-sm">
              {rows.length === 0 && <p className="text-xs text-muted-foreground">{tr("لا توجد طلبات بعد.", "No orders yet.")}</p>}
              {rows.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSelected(o.id)}
                  className={`rounded-lg border p-3 text-start ${selected === o.id ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <p className="font-medium">{o.title}</p>
                  <p className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>#MJ-{o.order_number}</span>
                    <span className="text-primary">{Number(o.amount_usdt)} USDT</span>
                  </p>
                </button>
              ))}
            </div>
          </Card>
          {order && (
            <Card>
              <h3 className="font-bold">{tr("سير الطلب", "Order lifecycle")}</h3>
              <ol className="mt-3 grid gap-2 text-xs">
                {(["pending", "in_progress", "delivered", "completed"] as const).map((s) => {
                  const idx = ["pending", "in_progress", "delivered", "completed"].indexOf(order.status);
                  const here = ["pending", "in_progress", "delivered", "completed"].indexOf(s);
                  const done = idx >= here && idx >= 0;
                  return (
                    <li key={s} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${done ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                      {done ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />} {statusLabel(s, tr)}
                    </li>
                  );
                })}
              </ol>

              <div className="mt-4 grid gap-2">
                {nextActions(order, user?.id).map((a) => (
                  <button
                    key={a.key}
                    onClick={() => {
                      setActionMsg(null);
                      transition.mutate(
                        { id: order.id, status: a.key },
                        {
                          onError: (e: Error) => setActionMsg(e.message),
                          onSuccess: () => {
                            if (a.key === "completed") setReviewOpen(true);
                          },
                        },
                      );
                    }}

                    disabled={transition.isPending}
                    className={`w-full rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50 ${
                      a.tone === "danger"
                        ? "border border-destructive/50 bg-destructive/10 text-destructive"
                        : a.tone === "accent"
                          ? "border border-accent/50 bg-accent/10 text-accent"
                          : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {actionLabel(a.key, tr)}
                  </button>
                ))}
                {nextActions(order, user?.id).length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {tr("لا يوجد إجراء مطلوب منك حالياً على هذا الطلب.", "No action is required from you on this order right now.")}
                  </p>
                )}
                {actionMsg && <p className="text-xs text-destructive">{actionMsg}</p>}
              </div>
            </Card>
          )}
          <Card>
            <h3 className="font-bold">{tr("حالة الضمان", "Escrow status")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {order?.escrow_locked
                ? tr("المبلغ محجوز في الضمان حتى اعتماد التسليم.", "Funds are held in escrow until delivery is approved.")
                : tr("لا توجد مبالغ محجوزة على هذا الطلب.", "No funds are currently held for this order.")}
            </p>
            {order?.due_at && (
              <p className="mt-2 text-xs text-muted-foreground">
                {tr("موعد التسليم", "Delivery due")}: {new Date(order.due_at).toLocaleString()}
              </p>
            )}
            {order?.auto_release_at && (
              <p className="mt-2 text-xs text-primary">
                {tr("إطلاق تلقائي في", "Auto-release at")}: {new Date(order.auto_release_at).toLocaleString()}
              </p>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <h3 className="min-w-0 text-sm font-bold">{tr("المعالم المرحلية للطلب", "Order milestones")}</h3>
              <label className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                {tr("تفعيل", "Enable")}
                <input type="checkbox" checked={milestonesOn} onChange={(e) => setMilestonesOn(e.target.checked)} className="size-4 accent-primary" />
              </label>
            </div>
            {!milestonesOn ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {tr("اختياري — قسّم الطلب إلى مراحل مع تحرير جزئي للضمان.", "Optional — split the order into milestones with partial escrow release.")}
              </p>
            ) : (
              <div className="mt-3 grid gap-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${releasedPct}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground">{tr("نسبة الضمان المُحرَّرة", "Escrow released")}: {releasedPct}%</p>
                {milestones.map((m) => {
                  const isReleased = releasedPct >= m.pct;
                  const state = isReleased ? (releasedPct >= 100 ? tr("مكتمل", "Completed") : tr("محرر", "Released")) : tr("معلق", "Pending");
                  return (
                    <div
                      key={m.pct}
                      className={`grid gap-2 rounded-lg border px-3 py-2.5 text-xs ${isReleased ? "border-primary/50 bg-primary/10" : "border-border"}`}
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                        <span className={`min-w-0 font-bold ${isReleased ? "text-primary" : "text-foreground"}`}>{m.label} ({m.pct}%)</span>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 ${isReleased ? "border-primary/50 text-primary" : "border-border text-muted-foreground"}`}>
                          {isReleased ? <Unlock className="size-3" /> : <Lock className="size-3" />} {state}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          {order ? `${((Number(order.amount_usdt) * m.pct) / 100).toFixed(2)} USDT` : "—"}
                        </span>
                        <button
                          type="button"
                          disabled={isReleased}
                          onClick={() => setReleased((r) => [...r, m.pct])}
                          className="shrink-0 rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary disabled:opacity-40"
                        >
                          {isReleased ? tr("تم التحرير", "Released") : m.cta}
                        </button>
                      </div>
                    </div>
                  );
                })}
                <p className="text-[11px] text-muted-foreground">
                  {tr("يُحرَّر جزء الضمان تلقائياً عند اعتماد كل مرحلة.", "Each milestone releases its escrow share on approval.")}
                </p>
              </div>
            )}

          </Card>
        </div>
      </div>

      {extOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-background/85 p-4 backdrop-blur" role="dialog" aria-modal="true">
          <Card className="w-full max-w-md">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="min-w-0 truncate text-lg font-black">{tr("طلب تمديد مهلة التسليم", "Request deadline extension")}</h2>
              <button type="button" aria-label={tr("إغلاق", "Close")} onClick={() => setExtOpen(false)} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 flex gap-2">
              {([24, 48] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setExtHours(h)}
                  className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-bold ${extHours === h ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
                >
                  +{h} {tr("ساعة", "hours")}
                </button>
              ))}
            </div>
            <textarea
              value={extReason}
              onChange={(e) => setExtReason(e.target.value)}
              rows={4}
              placeholder={tr("سبب طلب التمديد...", "Reason for the extension request...")}
              className="mt-3 w-full rounded-xl border border-input bg-surface p-3 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={extReason.trim().length < 10}
              onClick={() => {
                setExtStatus("pending");
                setExtDone(tr(`تم إرسال طلب تمديد ${extHours} ساعة للمشتري — بانتظار الموافقة.`, `Extension request of ${extHours}h sent to the buyer — awaiting approval.`));
                setExtOpen(false);
                setExtReason("");
              }}
              className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              {tr("إرسال طلب التمديد للمشتري", "Send extension request to buyer")}
            </button>

            <p className="mt-2 text-[11px] text-muted-foreground">
              {tr("يبقى المبلغ محجوزاً في الضمان ويُؤجَّل الإطلاق التلقائي بعد الموافقة.", "Funds stay in escrow and auto-release is postponed once approved.")}
            </p>
          </Card>
        </div>
      )}

      {reviewOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-background/85 p-4 backdrop-blur" role="dialog" aria-modal="true">
          <Card className="w-full max-w-md">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="min-w-0 truncate text-lg font-black">{tr("تقييم متبادل بعد الإنجاز", "Two-way review after completion")}</h2>
              <button type="button" aria-label={tr("إغلاق", "Close")} onClick={() => setReviewOpen(false)} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {([
                ["quality", tr("جودة العمل والاحترافية", "Work quality & professionalism")],
                ["communication", tr("سرعة وجودة التواصل", "Communication speed & quality")],
                ["speed", tr("الالتزام بموعد التسليم", "On-time delivery")],
              ] as const).map(([k, label]) => (
                <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                  <span className="min-w-0 text-sm font-bold">{label}</span>

                  <div className="flex shrink-0 gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" aria-label={`${label} ${n}`} onClick={() => setStars({ ...stars, [k]: n })}>
                        <Star className={`size-4 ${n <= stars[k] ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={4}
                placeholder={tr("اكتب تقييمك وتجربتك بالتفصيل...", "Write your review and experience in detail...")}
                className="w-full rounded-xl border border-input bg-surface p-3 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => {
                  const avg = ((stars.quality + stars.communication + stars.speed) / 3).toFixed(1);
                  setReviewDone(tr(`تم نشر تقييمك (${avg}/5) واعتماد الطلب.`, `Review published (${avg}/5) and order approved.`));
                  setReviewOpen(false);
                  setReviewText("");
                }}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
              >
                {tr("نشر التقييم واعتماد الطلب", "Publish review & approve order")}
              </button>

            </div>
          </Card>
        </div>
      )}

      {(extDone || reviewDone) && (
        <p className="mt-4 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-xs font-bold text-primary">
          {extDone ?? reviewDone}
        </p>
      )}
    </Section>
  );
}
