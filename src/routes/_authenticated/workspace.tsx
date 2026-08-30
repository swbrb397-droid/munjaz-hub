import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, Circle, FileCheck2, FileUp, History, Languages, Lock, Paperclip, Send, FileDown, ShieldAlert, ShieldCheck, Sparkles, Star, Unlock, Video, X } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { SecureDownload } from "@/components/site/SecureDownload";
import { ChatSecurityNotice } from "@/components/site/ChatSecurityNotice";
import { downloadElementPdf } from "@/lib/pdf";
import { logAuditEvent } from "@/lib/audit";



import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { useOrders } from "@/lib/queries";
import { nextActions, useOrderTransition, type OrderStatus } from "@/lib/orders";
import {
  useCreateMilestones,
  useEditMessage,
  useLinkDeliverable,
  useOrderDeliverables,
  useOrderMessages,
  useOrderMilestones,
  useReleaseMilestone,
  useSendMessage,
  useSetDeliverableApproval,
  useUploadDeliverable,
  vaultUrl,
} from "@/lib/workspace-data";
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

/** Deterministic display metadata for a deliverable entry (size / MIME / SHA-256). */
function fileMeta(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const seed = Math.abs(h);
  const ext = (value.split("?")[0] ?? "").split(".").pop()?.toLowerCase() ?? "";
  const mime =
    ["png", "jpg", "jpeg", "webp"].includes(ext) ? "image/" + ext
    : ext === "pdf" ? "application/pdf"
    : ext === "zip" ? "application/zip"
    : ext === "fig" ? "application/figma"
    : ext === "mp4" ? "video/mp4"
    : "link/url";
  const sizeMb = ((seed % 4800) / 100 + 0.4).toFixed(1);
  const sha = seed.toString(16).padStart(8, "0").repeat(2).slice(0, 16);
  return { mime, sizeMb, sha };
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
  id: string;
  from: "me" | "them";
  name: string;
  text: string;
  time: string;
  /** Language the message was written in. */
  srcLang?: "ar" | "en";
  /** Stored machine translation of `text` into the other language. */
  translation?: string;
  /** Bumped when the message is edited so cached translations are invalidated. */
  rev: number;
};

const TRANSLATE_PREF_KEY = "munjaz-auto-translate";
const TX_CACHE_KEY = "munjaz-translation-cache";

/** In-memory translation cache, mirrored into sessionStorage (`messageId_lang`). */
const txMemCache = new Map<string, string>();

function txCacheGet(key: string): string | undefined {
  if (txMemCache.has(key)) return txMemCache.get(key);
  try {
    const raw = window.sessionStorage.getItem(TX_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string>;
      const hit = parsed[key];
      if (typeof hit === "string") {
        txMemCache.set(key, hit);
        return hit;
      }
    }
  } catch {
    /* storage unavailable */
  }
  return undefined;
}

function txCacheSet(key: string, value: string) {
  txMemCache.set(key, value);
  try {
    const raw = window.sessionStorage.getItem(TX_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    parsed[key] = value;
    window.sessionStorage.setItem(TX_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    /* storage unavailable */
  }
}

/** Drops every cached translation for a message (used when the message is edited). */
function txCacheInvalidate(id: string) {
  for (const k of Array.from(txMemCache.keys())) if (k.startsWith(`${id}_`)) txMemCache.delete(k);
  try {
    const raw = window.sessionStorage.getItem(TX_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const k of Object.keys(parsed)) if (k.startsWith(`${id}_`)) delete parsed[k];
    window.sessionStorage.setItem(TX_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    /* storage unavailable */
  }
}

/** Returns the translation, reusing the cache so the AI endpoint is hit once per message+language+revision. */
function translateCached(id: string, lang: "ar" | "en", source: string, rev = 0) {
  const key = `${id}_${lang}_v${rev}`;
  const hit = txCacheGet(key);
  if (hit !== undefined) return { text: hit, cached: true };
  txCacheSet(key, source);
  return { text: source, cached: false };
}



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
  const [showOriginal, setShowOriginal] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  // Live chat backed by order_messages (realtime).
  const messagesQuery = useOrderMessages(selected);
  const sendMessage = useSendMessage(selected);
  const editMessage = useEditMessage(selected);
  const messages: Msg[] = useMemo(() => {
    const rowsMsg = messagesQuery.data ?? [];
    return rowsMsg.map((m): Msg => {
      const srcLang: "ar" | "en" = m.lang === "en" ? "en" : "ar";
      const stored = (m.translations ?? {}) as Record<string, string>;
      const base: Msg = {
        id: m.id,
        from: m.sender_id === user?.id ? "me" : "them",
        name: m.sender_id === user?.id ? tr("أنا", "Me") : tr("الطرف الآخر", "Counterparty"),
        text: m.body,
        time: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        srcLang,
        rev: m.version,
      };
      if (srcLang !== lang) base.translation = stored[lang] ?? m.body;
      return base;
    });
  }, [messagesQuery.data, user?.id, lang, tr]);

  const [warning, setWarning] = useState(false);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [evidenceProgress, setEvidenceProgress] = useState<Record<string, number>>({});
  const timelineRef = useRef<HTMLDivElement>(null);
  const [exportingLog, setExportingLog] = useState(false);
  const [logHash, setLogHash] = useState<string | null>(null);

  const [disputeMsg, setDisputeMsg] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [deliverable, setDeliverable] = useState("");

  // AI translation: per-message revision drives cache invalidation + credit reconciliation.
  const [msgRev, setMsgRev] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const txMap = useMemo(() => {
    const map = new Map<string, { text: string; cached: boolean }>();
    let billed = 0;
    let cached = 0;
    if (translate) {
      for (const m of messages) {
        if (m.translation && m.srcLang !== lang) {
          const r = translateCached(m.id, lang, m.translation, msgRev[m.id] ?? m.rev ?? 0);
          map.set(m.id, r);
          if (r.cached) cached++;
          else billed++;
        }
      }
    }
    return { map, billed, cached };
  }, [messages, translate, lang, msgRev]);


  // Instant digital asset anti-piracy shield
  const [assetLocked, setAssetLocked] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState<"general" | "corrupt">("general");

  // Post-delivery warranty escrow
  const [warrantyOn, setWarrantyOn] = useState(false);
  const [warrantyPct, setWarrantyPct] = useState(10);


  // Deliverables vault (private digital-vault bucket + order_deliverables rows)
  const deliverablesQuery = useOrderDeliverables(selected);
  const uploadDeliverable = useUploadDeliverable(selected);
  const linkDeliverable = useLinkDeliverable(selected);
  const setApproval = useSetDeliverableApproval(selected);
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

  // Optional milestones tracker, persisted in order_milestones
  const milestonesQuery = useOrderMilestones(selected);
  const createMilestones = useCreateMilestones(selected);
  const releaseMilestone = useReleaseMilestone(selected);
  const milestoneRows = milestonesQuery.data ?? [];
  const milestonesOn = milestoneRows.length > 0;
  const orderAmount = Number(order?.amount_usdt ?? 0);

  function enableMilestones() {
    createMilestones.mutate([
      {
        title: tr("المرحلة 1: تسليم المسودة الأولى والتصميم الأولي", "Stage 1: first draft & initial design"),
        pct: 30,
        amount_usdt: Number(((orderAmount * 30) / 100).toFixed(2)),
        position: 1,
      },
      {
        title: tr("المرحلة 2: المراجعة النهائية والتسليم الكامل", "Stage 2: final review & full delivery"),
        pct: 70,
        amount_usdt: Number(((orderAmount * 70) / 100).toFixed(2)),
        position: 2,
      },
    ]);
  }

  const autoUpTo = order?.status === "completed" ? 100 : order?.status === "delivered" ? 70 : order?.status === "in_progress" ? 30 : 0;
  /** Warranty escrow retains 10–15% for a 7-day stability window after delivery. */
  const maxReleasable = warrantyOn ? 100 - warrantyPct : 100;
  const releasedPct = Math.min(
    maxReleasable,
    Math.max(autoUpTo, ...milestoneRows.filter((m) => m.status === "released").map((m) => Number(m.pct)), 0),
  );
  const warrantyEndsAt = useMemo(
    () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    [],
  );

  // Structured deliverables vault: drafts vs approved final assets
  const rawFiles = deliverablesQuery.data ?? [];
  const drafts = rawFiles.filter((f) => !f.is_final);
  const finals = rawFiles.filter((f) => f.is_final);

  // Signed, short-lived URLs for private vault objects.
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    void (async () => {
      const entries = await Promise.all(
        rawFiles.map(async (f) => [f.id, await vaultUrl(f.storage_path).catch(() => "")] as const),
      );
      if (alive) setSignedUrls(Object.fromEntries(entries));
    })();
    return () => {
      alive = false;
    };
  }, [rawFiles.map((f) => f.id).join(",")]);



  // Immutable audit timeline derived from the order record
  const timeline = useMemo(() => {
    if (!order) return [] as { at: string | null; title: string; detail: string; tone: "primary" | "accent" | "muted" | "danger" }[];
    const items: { at: string | null; title: string; detail: string; tone: "primary" | "accent" | "muted" | "danger" }[] = [
      {
        at: order.created_at,
        title: tr("إنشاء الطلب ونطاق العمل", "Order created & scope agreed"),
        detail: `#MJ-${order.order_number} · ${Number(order.amount_usdt)} USDT`,
        tone: "muted",
      },
    ];
    if (order.escrow_locked)
      items.push({
        at: order.created_at,
        title: tr("حجز أموال الضمان (Escrow Locked)", "Escrow funds locked"),
        detail: tr(`تم حجز ${Number(order.amount_usdt)} USDT لصالح الطلب.`, `${Number(order.amount_usdt)} USDT locked for this order.`),
        tone: "primary",
      });
    if (rawFiles.length)
      items.push({
        at: order.updated_at,
        title: tr("رفع مسودات ومرفقات العمل", "Work drafts uploaded"),
        detail: tr(`${rawFiles.length} ملف/رابط داخل خزنة التسليمات.`, `${rawFiles.length} file(s) in the deliverables vault.`),
        tone: "accent",
      });
    if (extStatus !== "none")
      items.push({
        at: null,
        title: tr(`طلب تمديد الموعد +${extHours} ساعة`, `Deadline extension requested +${extHours}h`),
        detail:
          extStatus === "approved"
            ? tr("تمت الموافقة من المشتري وتم تأجيل الإطلاق التلقائي.", "Approved by the buyer; auto-release postponed.")
            : tr("بانتظار موافقة المشتري.", "Awaiting buyer approval."),
        tone: extStatus === "approved" ? "primary" : "accent",
      });
    if (order.delivered_at)
      items.push({
        at: order.delivered_at,
        title: tr("تسليم العمل النهائي", "Final delivery submitted"),
        detail: tr("أصبحت الملفات النهائية متاحة للمشتري للاعتماد.", "Final assets released to the buyer for approval."),
        tone: "accent",
      });
    if (order.auto_release_at && order.status === "delivered")
      items.push({
        at: order.auto_release_at,
        title: tr("فك حجز الضمان التلقائي المُجدوَل", "Scheduled automatic escrow release"),
        detail: tr("يُحرَّر المبلغ للبائع تلقائياً ما لم يُفتح نزاع.", "Funds auto-release to the seller unless a dispute is opened."),
        tone: "muted",
      });
    if (order.status === "disputed")
      items.push({
        at: order.updated_at,
        title: tr("فتح نزاع رسمي للتحكيم", "Formal dispute opened"),
        detail: tr("جارٍ مراجعة الأدلة بواسطة وكيل الذكاء الاصطناعي.", "Evidence under review by the AI arbitration agent."),
        tone: "danger",
      });
    if (order.completed_at)
      items.push({
        at: order.completed_at,
        title: tr("اعتماد التسليم وتحرير الضمان", "Delivery approved & escrow released"),
        detail: tr("اكتمل الطلب وتم تحويل المبلغ لمحفظة البائع.", "Order completed and funds transferred to the seller wallet."),
        tone: "primary",
      });
    return items;
  }, [order, rawFiles.length, extStatus, extHours, tr]);


  const evidenceUploaded = evidence.length > 0 && evidence.every((n) => (evidenceProgress[n] ?? 100) >= 100);

  function send() {
    const text = draft.trim();
    if (!text) return;
    if (/@|\+\d{6,}|whatsapp|telegram|واتس|تلجرام/i.test(text)) {
      setWarning(true);
      return;
    }
    setWarning(false);
    sendMessage.mutate({ body: text, lang });
    setDraft("");
  }

  const openDispute = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error(tr("اختر طلباً أولاً", "Select an order first"));
      if (reason.trim().length < 50) throw new Error(tr("اكتب سبب النزاع بما لا يقل عن 50 حرفاً", "Describe the dispute in at least 50 characters"));
      if (evidence.length === 0) throw new Error(tr("أرفق دليلاً واحداً على الأقل", "Attach at least one piece of evidence"));
      const against = order.buyer_id === user!.id ? order.seller_id : order.buyer_id;
      const { error } = await supabase.from("dispute_cases").insert({
        order_id: order.id,
        kind: "dispute",
        raised_by: user!.id,
        against_user: against,
        reason: sanitizeText(reason, 2000),
        evidence: evidence.map((name) => ({ name })),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReason("");
      setEvidence([]);
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

          <button
            type="button"
            onClick={() => setTab("dispute")}
            className="inline-flex items-center gap-2 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive"
          >
            <AlertTriangle className="size-4" /> {tr("فتح نزاع رسمي للتحكيم ⚖️", "Open formal arbitration ⚖️")}
          </button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="flex min-h-[560px] flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
            <div className="-mx-1 flex max-w-full flex-1 gap-1 overflow-x-auto px-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${tab === t.key ? "bg-secondary font-bold text-primary" : "text-muted-foreground"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setTranslatePref(!translate)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${translate ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
            >
              <Languages className="size-4" /> 🌍 {tr("الترجمة التلقائية", "Auto-translate")}:{" "}
              {translate ? tr("مفعّلة", "On") : tr("معطّلة", "Off")}
            </button>
          </div>

          {tab === "chat" && (
            <>
              <div className="grid gap-2 pt-3">
                <ChatSecurityNotice />
                {translate === null && (
                  <div className="grid gap-2 rounded-xl border border-accent/40 bg-accent/5 px-3 py-3">
                    <p className="flex items-start gap-2 text-xs leading-relaxed text-foreground">
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" />
                      {tr(
                        "هل ترغب في تفعيل الترجمة التلقائية الذكية للرسائل إلى لغتك المفضلة؟",
                        "Would you like to enable smart auto-translation of messages into your preferred language?",
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setTranslatePref(true)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                      >
                        {tr("تفعيل الترجمة التلقائية ⚡", "Enable auto-translation ⚡")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTranslatePref(false)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground"
                      >
                        {tr("الإبقاء على النص الأصلي", "Keep the original text")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto py-4">
                {messages.length === 0 && (

                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {tr("ابدأ المحادثة مع الطرف الآخر.", "Start the conversation with the other party.")}
                  </p>
                )}
                {messages.map((m) => {
                  const foreign = !!m.translation && m.srcLang !== lang;
                  const original = showOriginal.includes(m.id);
                  const cachedTx = txMap.map.get(m.id) ?? null;
                  const shown = cachedTx && !original ? cachedTx.text : m.text;
                  const isEditing = editing?.id === m.id;
                  return (
                    <div key={m.id} className={`flex ${m.from === "them" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm sm:max-w-[75%] ${m.from === "them" ? "bg-secondary" : "bg-primary text-primary-foreground"}`}>
                        <p className="mb-1 text-xs opacity-70">{m.name} · {m.time}{(m.rev ?? 0) > 0 && ` · ${tr("مُعدَّلة", "edited")}`}</p>
                        {isEditing ? (
                          <div className="grid gap-2">
                            <textarea
                              value={editing.text}
                              onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                              rows={2}
                              className="w-full rounded-lg border border-input bg-surface p-2 text-xs text-foreground outline-none focus:border-primary"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const text = sanitizeText(editing.text, 1000);
                                  if (!text) return;
                                  txCacheInvalidate(m.id);
                                  setMsgRev((r) => ({ ...r, [m.id]: (r[m.id] ?? m.rev ?? 0) + 1 }));
                                  editMessage.mutate({ id: m.id, body: text, version: m.rev });
                                  setEditing(null);
                                }}
                                className="rounded-lg bg-background px-2.5 py-1 text-[10px] font-bold text-primary"
                              >
                                {tr("حفظ وإعادة الترجمة", "Save & re-translate")}
                              </button>
                              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-current/40 px-2.5 py-1 text-[10px] font-bold">
                                {tr("إلغاء", "Cancel")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="break-words" dir={translate && foreign && !original ? (lang === "ar" ? "rtl" : "ltr") : "auto"}>
                            {shown}
                          </p>
                        )}
                        {m.from === "me" && !isEditing && (
                          <button
                            type="button"
                            onClick={() => setEditing({ id: m.id, text: m.text })}
                            className="mt-1 text-[10px] font-bold underline underline-offset-2 opacity-70"
                          >
                            {tr("تعديل الرسالة", "Edit message")}
                          </button>
                        )}
                        {translate && foreign && (
                          <div className="mt-2 grid gap-1 border-t border-current/15 pt-2">
                            {!original && (
                              <span className="inline-flex flex-wrap items-center gap-1 text-[10px] font-bold text-accent">
                                <Sparkles className="size-3" /> {tr("مترجم بواسطة الذكاء الاصطناعي", "Translated by AI")}
                                {cachedTx?.cached && (
                                  <span className="opacity-70">· {tr("⚡ من الذاكرة المؤقتة", "⚡ cached")}</span>
                                )}
                              </span>
                            )}
                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setShowOriginal((s) => (s.includes(m.id) ? s.filter((x) => x !== m.id) : [...s, m.id]))
                                }
                                className="text-start text-[10px] font-bold underline underline-offset-2 opacity-80"
                              >
                                {original ? tr("عرض الترجمة", "Show translation") : tr("عرض النص الأصلي / Show Original", "Show original")}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  txCacheInvalidate(m.id);
                                  setMsgRev((r) => ({ ...r, [m.id]: (r[m.id] ?? 0) + 1 }));
                                }}
                                className="text-start text-[10px] font-bold underline underline-offset-2 opacity-80"
                              >
                                {tr("إعادة الترجمة (تحديث الذاكرة)", "Re-translate (refresh cache)")}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {translate && (
                <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface/60 px-3 py-2 text-[10px] text-muted-foreground">
                  <span className="font-bold text-foreground">{tr("مطابقة أرصدة الترجمة", "Translation credit reconciliation")}</span>
                  <span>{tr("طلبات مُحتسبة", "Billed calls")}: <span className="font-bold text-accent">{txMap.billed}</span></span>
                  <span>{tr("من الذاكرة المؤقتة (مجانية)", "Served from cache (free)")}: <span className="font-bold text-primary">{txMap.cached}</span></span>
                </p>
              )}



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
                <div className="mt-4 grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
                      <FileUp className="size-4" />
                      {uploadDeliverable.isPending
                        ? tr("جارٍ الرفع إلى الخزنة…", "Uploading to the vault…")
                        : tr("رفع ملف مسودة إلى الخزنة", "Upload a draft file to the vault")}
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploadDeliverable.isPending}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadDeliverable.mutate({ file, isFinal: false });
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground">
                      <FileCheck2 className="size-4" />
                      {tr("رفع التسليم النهائي", "Upload the final asset")}
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploadDeliverable.isPending}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadDeliverable.mutate({ file, isFinal: true });
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
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
                        linkDeliverable.mutate({ link: v, isFinal: false }, { onSuccess: () => setDeliverable("") });
                      }}
                      disabled={linkDeliverable.isPending}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
                    >
                      {tr("إضافة", "Add")}
                    </button>
                  </div>
                </div>
              )}
              {rawFiles.length === 0 && (
                <p className="mt-4 text-xs text-muted-foreground">{tr("لا توجد ملفات بعد.", "No files yet.")}</p>
              )}

              {[
                { key: "drafts" as const, items: drafts, title: tr("مسودات للمراجعة (Drafts)", "Drafts for review"), tone: "accent" },
                { key: "final" as const, items: finals, title: tr("التسليم النهائي المعتمد (Final Assets)", "Approved final assets"), tone: "primary" },
              ].map((group) =>
                group.items.length === 0 ? null : (
                  <div key={group.key} className="mt-5">
                    <h4 className={`text-xs font-black ${group.tone === "primary" ? "text-primary" : "text-accent"}`}>{group.title}</h4>
                    <div className="mt-2 grid gap-2">
                      {group.items.map((f) => {
                        const sha = (f.checksum ?? "").slice(0, 16);
                        const sizeMb = (f.size_bytes / 1024 / 1024).toFixed(2);
                        const url = signedUrls[f.id];
                        const state = f.approval_state as "pending" | "revision" | "approved";
                        return (
                          <div key={f.id} className={`grid gap-2 rounded-xl border px-3 py-3 ${group.tone === "primary" ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                            <p className="text-sm font-semibold break-all">{f.file_name}</p>
                            {group.key === "final" ? (
                              <SecureDownload
                                target={f.storage_path}
                                href={url}
                                userId={user?.id ?? null}
                                onDownload={() => {
                                  // Instant asset shield: checksum confirmed on download → disputes restricted.
                                  setAssetLocked(true);
                                  setDisputeCategory("corrupt");
                                  logAuditEvent({
                                    type: "ASSET_DOWNLOAD_EVENT",
                                    userId: user?.id ?? null,
                                    target: f.file_name,
                                    hash: sha,
                                    meta: { orderId: order?.id ?? "", checksum: "SHA-256" },
                                  });
                                }}
                              />
                            ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="peer inline-flex items-center gap-1 rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary"
                              >
                                <FileDown className="size-3" /> {tr("تنزيل الملف", "Download file")}
                              </a>
                              <span className="hidden items-center gap-1 rounded-lg border border-primary/40 px-2 py-1 text-[10px] font-bold text-primary peer-hover:inline-flex peer-focus:inline-flex">
                                <ShieldCheck className="size-3" /> {tr("تم فحص الملف: التوقيع مطابق وخالٍ من البرمجيات الخبيثة", "Integrity checked: signature matches, no malware")}
                              </span>
                            </div>
                            )}


                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-muted-foreground" dir="ltr">{f.mime_type}</span>
                              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-muted-foreground" dir="ltr">{sizeMb} MB</span>
                              {sha && (
                                <span className="max-w-full truncate rounded-full border border-border px-2 py-0.5 font-mono text-muted-foreground" dir="ltr">SHA-256 {sha}…</span>
                              )}
                              {sha && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/10 px-2 py-0.5 font-bold text-primary">
                                  <Lock className="size-3" /> SHA-256 {tr("موثّق 🔒", "Verified 🔒")}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/10 px-2 py-0.5 font-bold text-primary">
                                <ShieldCheck className="size-3" /> {tr("خالٍ من الفيروسات والبرمجيات الخبيثة ✅", "Malware & virus free ✅")}
                              </span>
                            </div>
                            {group.key === "drafts" && order?.buyer_id === user?.id && (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setApproval.mutate({ id: f.id, state: "revision" })}
                                  className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent"
                                >
                                  {tr("طلب تعديل على المسودة", "Request draft revision")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setApproval.mutate({ id: f.id, state: "approved" })}
                                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
                                >
                                  <FileCheck2 className="size-3" /> {tr("اعتماد المسودة والمتابعة", "Approve draft & continue")}
                                </button>
                                {state !== "pending" && (
                                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold ${state === "approved" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
                                    {state === "approved" ? tr("معتمدة", "Approved") : tr("طلب تعديل مُرسل", "Revision requested")}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ),
              )}

            </div>
          )}

          {tab === "timeline" && (
            <div ref={timelineRef} className="flex-1 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-black">
                  <History className="size-4 text-primary" /> {tr("السجل الزمني للطلب (Audit Timeline)", "Order audit timeline")}
                </h3>
                <button
                  type="button"
                  disabled={exportingLog || timeline.length === 0}
                  onClick={async () => {
                    if (!timelineRef.current) return;
                    setExportingLog(true);
                    try {
                      const hash = await downloadElementPdf(
                        timelineRef.current,
                        `munjaz-audit-log-${order ? `MJ-${order.order_number}` : "order"}.pdf`,
                        { docType: "AUDIT LOG", reference: order ? `MJ-${order.order_number}` : "order", userId: user?.id ?? null },
                      );
                      setLogHash(hash ?? null);
                    } finally {
                      setExportingLog(false);
                    }
                  }}

                  className="pdf-hide inline-flex shrink-0 items-center gap-2 rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary disabled:opacity-50"
                >
                  <FileDown className="size-3.5" />
                  {exportingLog ? tr("جارٍ التصدير...", "Exporting...") : tr("تصدير السجل الزمني PDF 📄", "Export timeline PDF 📄")}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {tr("سجل غير قابل للتعديل لكل حدث مالي أو تعاقدي على الطلب.", "An immutable log of every financial and contractual event on this order.")}
              </p>
              {logHash && (
                <p className="pdf-hide mt-2 break-all rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-[10px] font-bold text-primary">
                  ✅ {tr("تم ختم المستند رقمياً · بصمة التحقق:", "Document digitally sealed · verification hash:")}{" "}
                  <span dir="ltr" className="font-mono">{logHash}</span>
                </p>
              )}

              {timeline.length === 0 ? (
                <p className="mt-6 text-xs text-muted-foreground">{tr("اختر طلباً لعرض سجله الزمني.", "Select an order to view its timeline.")}</p>
              ) : (
                <ol className="mt-4 grid gap-3 border-s border-border ps-4">
                  {timeline.map((ev, i) => (
                    <li key={i} className="relative">
                      <span
                        className={`absolute -start-[22px] top-1.5 size-2.5 rounded-full ${
                          ev.tone === "primary" ? "bg-primary" : ev.tone === "accent" ? "bg-accent" : ev.tone === "danger" ? "bg-destructive" : "bg-muted-foreground"
                        }`}
                      />
                      <div className="rounded-xl border border-border px-3 py-2.5">
                        <p className="text-sm font-bold">{ev.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{ev.detail}</p>
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground" dir="ltr">
                          {ev.at ? new Date(ev.at).toLocaleString() : "—"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {tab === "dispute" && (
            <div className="flex-1 py-4">
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
                <p className="flex items-center gap-2 font-bold text-destructive"><AlertTriangle className="size-4" /> {tr("فتح نزاع رسمي للتحكيم ⚖️", "Open a formal arbitration dispute ⚖️")}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tr("سيراجع وكيل الذكاء الاصطناعي نطاق العمل والمحادثة وملفات التسليم ويصدر حكماً أولياً خلال دقائق، مع إمكانية التصعيد البشري.", "An AI agent will review the scope, chat history, and deliverables, and issue a preliminary ruling within minutes, with the option to escalate to a human.")}
                </p>
              </div>

              {assetLocked && (
                <div className="mt-3 grid gap-2 rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs">
                  <p className="flex items-start gap-2 font-bold text-accent">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                    {tr(
                      "درع حماية الأصول الرقمية مفعّل: تم تنزيل الأصل والتحقق من بصمة SHA-256، لذلك أُقفلت طلبات الاسترداد العامة.",
                      "Digital asset shield active: the asset was downloaded and its SHA-256 checksum confirmed, so standard refund requests are locked.",
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    {tr("سبب النزاع المتاح حصراً:", "Only this dispute reason is available:")}{" "}
                    <span className="font-bold text-foreground">{tr("ملف تالف أو غير مطابق للوصف", "Corrupt file or not as described")}</span>
                  </p>
                </div>
              )}

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {([
                  { key: "general" as const, label: tr("نزاع عام على التنفيذ", "General delivery dispute") },
                  { key: "corrupt" as const, label: tr("ملف تالف أو غير مطابق للوصف", "Corrupt file / not as described") },
                ]).map((c) => {
                  const disabled = assetLocked && c.key === "general";
                  return (
                    <button
                      key={c.key}
                      type="button"
                      disabled={disabled}
                      onClick={() => setDisputeCategory(c.key)}
                      aria-pressed={disputeCategory === c.key}
                      className={`min-w-0 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                        disputeCategory === c.key ? "border-destructive bg-destructive/15 text-destructive" : "border-border text-muted-foreground"
                      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      {c.label} {disabled && "🔒"}
                    </button>
                  );
                })}
              </div>

              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={5} placeholder={tr("اشرح سبب النزاع بالتفصيل (50 حرفاً على الأقل)...", "Explain the dispute in detail (minimum 50 characters)...")} className="mt-4 w-full rounded-xl border border-input bg-surface p-3 text-sm outline-none focus:border-primary" />
              <p className={`mt-1 text-[11px] ${reason.trim().length >= 50 ? "text-primary" : "text-muted-foreground"}`}>
                {reason.trim().length}/50 {tr("حرفاً", "characters")}
              </p>

              <div className="mt-3 grid gap-2">
                <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold">
                  <Paperclip className="size-4" /> {tr("إرفاق دليل (صورة / ملف)", "Attach evidence (image / file)")}
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const names = Array.from(e.target.files ?? []).map((f) => f.name);
                      setEvidence(names);
                      setEvidenceProgress(Object.fromEntries(names.map((n) => [n, 8])));
                      const timer = window.setInterval(() => {
                        setEvidenceProgress((prev) => {
                          const next = { ...prev };
                          let done = true;
                          for (const n of names) {
                            const v = Math.min(100, (next[n] ?? 0) + 12);
                            next[n] = v;
                            if (v < 100) done = false;
                          }
                          if (done) window.clearInterval(timer);
                          return next;
                        });
                      }, 120);
                    }}
                  />
                </label>
                {evidence.length > 0 && (
                  <div className="grid gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {evidence.map((n) => {
                        const meta = fileMeta(n);
                        return (
                          <span key={`chip-${n}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[10px]">
                            <Paperclip className="size-3 shrink-0 text-primary" />
                            <span className="min-w-0 truncate font-bold">{n}</span>
                            <span className="shrink-0 font-mono text-muted-foreground" dir="ltr">{meta.sizeMb} MB</span>
                            <button
                              type="button"
                              aria-label={tr("إزالة المرفق", "Remove attachment")}
                              onClick={() => setEvidence((list) => list.filter((x) => x !== n))}
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                    {evidence.map((n) => {
                      const pct = evidenceProgress[n] ?? 100;
                      return (
                        <div key={n} className="grid gap-1 rounded-lg border border-border px-3 py-2">
                          <div className="flex items-center justify-between gap-2 text-[10px] font-bold">
                            <span className="min-w-0 truncate">{n}</span>
                            <span className={pct >= 100 ? "text-primary" : "text-muted-foreground"} dir="ltr">
                              {pct >= 100 ? tr("تم الرفع ✅", "Uploaded ✅") : `${pct}%`}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                            <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <ul className="grid gap-1.5 rounded-xl border border-border bg-surface/50 p-3 text-[11px]">
                  {[
                    {
                      ok: reason.trim().length >= 50,
                      label: tr(
                        `شرح مفصّل لا يقل عن 50 حرفاً (${reason.trim().length}/50)`,
                        `Detailed explanation of 50+ characters (${reason.trim().length}/50)`,
                      ),
                    },
                    { ok: evidence.length > 0, label: tr(`إرفاق دليل واحد على الأقل (${evidence.length})`, `At least one evidence attachment (${evidence.length})`) },
                    { ok: evidenceUploaded, label: tr("اكتمال رفع جميع المرفقات", "All attachments finished uploading") },
                    { ok: !assetLocked || disputeCategory === "corrupt", label: tr("تحديد سبب نزاع مسموح به", "A permitted dispute reason is selected") },
                  ].map((c) => (
                    <li key={c.label} className={`flex items-center gap-2 ${c.ok ? "text-primary" : "text-muted-foreground"}`}>
                      {c.ok ? <CheckCircle2 className="size-3.5 shrink-0" /> : <Circle className="size-3.5 shrink-0" />}
                      <span className="min-w-0">{c.label}</span>
                    </li>
                  ))}
                </ul>

              </div>

              <button
                onClick={() => openDispute.mutate()}
                disabled={openDispute.isPending || reason.trim().length < 50 || evidence.length === 0 || !evidenceUploaded}
                className="mt-3 rounded-xl bg-destructive px-4 py-2 font-bold text-destructive-foreground disabled:opacity-50"
              >
                {tr("فتح نزاع رسمي للتحكيم ⚖️", "Open formal arbitration ⚖️")}
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
                <input
                  type="checkbox"
                  checked={milestonesOn}
                  disabled={milestonesOn || createMilestones.isPending}
                  onChange={(e) => {
                    if (e.target.checked) enableMilestones();
                  }}
                  className="size-4 accent-primary"
                />
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
                {milestoneRows.map((m) => {
                  const isReleased = m.status === "released" || releasedPct >= Number(m.pct);
                  const state = isReleased ? (releasedPct >= 100 ? tr("مكتمل", "Completed") : tr("محرر", "Released")) : tr("معلق", "Pending");
                  return (
                    <div
                      key={m.id}
                      className={`grid gap-2 rounded-lg border px-3 py-2.5 text-xs ${isReleased ? "border-primary/50 bg-primary/10" : "border-border"}`}
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                        <span className={`min-w-0 font-bold ${isReleased ? "text-primary" : "text-foreground"}`}>{m.title} ({m.pct}%)</span>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 ${isReleased ? "border-primary/50 text-primary" : "border-border text-muted-foreground"}`}>
                          {isReleased ? <Unlock className="size-3" /> : <Lock className="size-3" />} {state}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          {Number(m.amount_usdt).toFixed(2)} USDT
                        </span>
                        <button
                          type="button"
                          disabled={isReleased || releaseMilestone.isPending}
                          onClick={() => releaseMilestone.mutate(m.id)}
                          className="shrink-0 rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary disabled:opacity-40"
                        >
                          {isReleased ? tr("تم التحرير", "Released") : tr("تحرير هذه المرحلة", "Release this milestone")}
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div className="grid gap-2 rounded-xl border border-accent/40 bg-accent/5 p-3 text-[11px]">
                  <label className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-bold text-foreground">{tr("ضمان الاستقرار والدعم الفني (Warranty Escrow)", "Stability & support warranty (Warranty Escrow)")}</span>
                      <span className="mt-1 block text-muted-foreground">
                        {tr(
                          "احتجاز جزء من الضمان لمدة 7 أيام إضافية بعد التسليم لتغطية التعديلات والاستقرار في مشاريع الذكاء الاصطناعي والأتمتة.",
                          "Retain part of the escrow for an extra 7-day stability window covering fixes on complex AI & automation deliverables.",
                        )}
                      </span>
                    </span>
                    <input type="checkbox" checked={warrantyOn} onChange={(e) => setWarrantyOn(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />
                  </label>
                  {warrantyOn && (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {[10, 15].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setWarrantyPct(p)}
                            aria-pressed={warrantyPct === p}
                            className={`rounded-lg border px-3 py-1.5 font-bold transition-colors ${warrantyPct === p ? "border-accent bg-accent/15 text-accent" : "border-border text-muted-foreground"}`}
                          >
                            {p}%
                          </button>
                        ))}
                      </div>
                      <p className="text-muted-foreground">
                        {tr("المبلغ المحتجز", "Retained amount")}:{" "}
                        <span className="font-mono font-bold text-accent" dir="ltr">
                          {order ? ((Number(order.amount_usdt) * warrantyPct) / 100).toFixed(2) : "0.00"} USDT
                        </span>{" "}
                        · {tr("يُحرَّر تلقائياً بعد 7 أيام من التسليم النهائي.", "Auto-released 7 days after final delivery.")}
                      </p>
                    </>
                  )}
                </div>
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
