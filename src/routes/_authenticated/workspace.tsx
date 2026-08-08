import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileUp, Languages, Paperclip, Send, ShieldAlert, Video } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { useOrders } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/workspace")({
  head: () => ({
    meta: [
      { title: "مساحة عمل الطلب | مُنجَز" },
      { name: "description", content: "محادثة لحظية مع ترجمة فورية بالذكاء الاصطناعي، مكالمات فيديو، تسليم الملفات، وفتح نزاع محمي بضمان المنصة." },
      { property: "og:title", content: "مساحة عمل الطلب | مُنجَز" },
      { property: "og:description", content: "تواصل، سلّم، وأدر نزاعاتك داخل مساحة عمل واحدة آمنة." },
    ],
  }),
  component: Workspace,
});

type Msg = { id: number; from: "me" | "them"; name: string; text: string; time: string };

function Workspace() {
  const { tr } = useLang();
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
    { key: "dispute", label: tr("النزاع", "Dispute") },
  ] as const;

  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("chat");
  const [translate, setTranslate] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [warning, setWarning] = useState(false);
  const [reason, setReason] = useState("");
  const [disputeMsg, setDisputeMsg] = useState<string | null>(null);

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
        reason: reason.trim(),
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
      subtitle={order ? `${order.title} · ${Number(order.amount_usdt)} USDT · ${order.status}` : tr("لا توجد طلبات بعد", "No orders yet")}
      action={
        <button className="inline-flex items-center gap-2 rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 font-semibold text-accent">
          <Video className="size-4" /> {tr("بدء مكالمة فيديو", "Start video call")}
        </button>
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
                  placeholder={tr("اكتب رسالتك...", "Type your message...")}
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
              <div className="mt-4 grid gap-2">
                {(Array.isArray(order?.deliverables) ? (order!.deliverables as unknown[]) : []).map((d, i) => (
                  <div key={i} className="rounded-lg border border-border px-4 py-3 text-sm">{String(d)}</div>
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
          <Card>
            <h3 className="font-bold">{tr("حالة الضمان", "Escrow status")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {order?.escrow_locked
                ? tr("المبلغ محجوز في الضمان حتى اعتماد التسليم.", "Funds are held in escrow until delivery is approved.")
                : tr("لا توجد مبالغ محجوزة على هذا الطلب.", "No funds are currently held for this order.")}
            </p>
            {order?.auto_release_at && (
              <p className="mt-2 text-xs text-primary">
                {tr("إطلاق تلقائي في", "Auto-release at")}: {new Date(order.auto_release_at).toLocaleString()}
              </p>
            )}
          </Card>
        </div>
      </div>
    </Section>
  );
}
