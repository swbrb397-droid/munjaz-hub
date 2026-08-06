import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, FileUp, Languages, Paperclip, Send, ShieldAlert, Video } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { chatThread } from "@/lib/mock";

export const Route = createFileRoute("/workspace")({
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

const tabs = [
  { key: "chat", label: "المحادثة" },
  { key: "files", label: "التسليمات" },
  { key: "dispute", label: "النزاع" },
] as const;

function Workspace() {
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("chat");
  const [translate, setTranslate] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(chatThread);
  const [warning, setWarning] = useState(false);

  function send() {
    const text = draft.trim();
    if (!text) return;
    if (/@|\+\d{6,}|whatsapp|telegram|واتس|تلجرام/i.test(text)) {
      setWarning(true);
      return;
    }
    setWarning(false);
    setMessages([...messages, { id: Date.now(), from: "seller", name: "م. خالد", text, en: text, time: "الآن" }]);
    setDraft("");
  }

  return (
    <Section
      title="مساحة عمل الطلب #MJ-9412"
      subtitle="تطوير متجر إلكتروني · شركة أفق · 850 USDT محجوزة في الضمان"
      action={
        <button className="inline-flex items-center gap-2 rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 font-semibold text-accent">
          <Video className="size-4" /> بدء مكالمة فيديو
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
              <Languages className="size-4" /> ترجمة AI
            </button>
          </div>

          {tab === "chat" && (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto py-4">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.from === "seller" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${m.from === "seller" ? "bg-secondary" : "bg-primary text-primary-foreground"}`}>
                      <p className="mb-1 text-xs opacity-70">{m.name} · {m.time}</p>
                      <p>{translate ? m.en : m.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {warning && (
                <p className="mb-2 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <ShieldAlert className="size-4" /> تم حظر الرسالة: محاولة تبادل وسائل تواصل خارجية.
                </p>
              )}

              <div className="flex items-center gap-2 border-t border-border pt-3">
                <button className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground" aria-label="إرفاق ملف">
                  <Paperclip className="size-4" />
                </button>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="اكتب رسالتك..."
                  className="flex-1 rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button onClick={send} className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground" aria-label="إرسال">
                  <Send className="size-4" />
                </button>
              </div>
            </>
          )}

          {tab === "files" && (
            <div className="flex-1 py-4">
              <div className="grid place-items-center rounded-xl border border-dashed border-border p-10 text-center">
                <FileUp className="size-8 text-primary" />
                <p className="mt-3 font-semibold">اسحب ملفات التسليم هنا</p>
                <p className="text-xs text-muted-foreground">حتى 2GB لكل ملف · تُفتح للمشتري بعد اعتماد المرحلة</p>
              </div>
              <div className="mt-4 grid gap-2">
                {[
                  ["milestone-1-preview.zip", "18.4 MB", "معتمد"],
                  ["design-system.fig", "42.1 MB", "بانتظار المراجعة"],
                ].map(([n, s, st]) => (
                  <div key={n} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
                    <span className="font-medium">{n}</span>
                    <span className="text-muted-foreground">{s}</span>
                    <span className="text-primary">{st}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "dispute" && (
            <div className="flex-1 py-4">
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
                <p className="flex items-center gap-2 font-bold text-destructive"><AlertTriangle className="size-4" /> فتح نزاع</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  سيراجع وكيل الذكاء الاصطناعي نطاق العمل والمحادثة وملفات التسليم ويصدر حكماً أولياً خلال دقائق، مع إمكانية التصعيد البشري.
                </p>
              </div>
              <textarea rows={5} placeholder="اشرح سبب النزاع بالتفصيل..." className="mt-4 w-full rounded-xl border border-input bg-surface p-3 text-sm outline-none focus:border-primary" />
              <button className="mt-3 rounded-xl bg-destructive px-4 py-2 font-bold text-destructive-foreground">إرسال طلب النزاع</button>
            </div>
          )}
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <h3 className="font-bold">مراحل الضمان</h3>
            <div className="mt-3 grid gap-3 text-sm">
              {[
                ["المرحلة 1 — التصميم", "300 USDT", "مُفرج"],
                ["المرحلة 2 — التطوير", "400 USDT", "محجوز"],
                ["المرحلة 3 — الإطلاق", "150 USDT", "لم تبدأ"],
              ].map(([n, v, s]) => (
                <div key={n} className="rounded-lg border border-border p-3">
                  <p className="font-medium">{n}</p>
                  <p className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{v}</span><span className="text-primary">{s}</span></p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="font-bold">حماية التقييم</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              يراقب النظام محاولات ابتزاز التقييم تلقائياً. لم تُرصد أي مخالفات في هذا الطلب.
            </p>
            <button className="mt-3 w-full rounded-lg border border-border py-2 text-sm">تقديم تظلّم على تقييم</button>
          </Card>
        </div>
      </div>
    </Section>
  );
}
