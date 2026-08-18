import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileWarning,
  Loader2,
  Paperclip,
  ShieldCheck,
  Timer,
  Upload,
  X,
} from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "إدارة الطلبات والضمان | الـمُـنْـجِـز" },
      {
        name: "description",
        content: "تتبّع دورة حياة الطلب من التنفيذ حتى تحرير المبلغ، مع مؤقت الضمان، تحميل التسليمات، وفتح نزاع مالي للتحكيم.",
      },
      { property: "og:title", content: "إدارة الطلبات والضمان | الـمُـنْـجِـز" },
      { property: "og:description", content: "مؤقت ضمان حي، تأكيد استلام، طلب تعديل، ونافذة تحكيم للنزاعات المالية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdersPage,
});

type OrderState = "in_progress" | "escrow" | "disputed" | "completed";

const STEPS: Array<{ key: OrderState | "delivered"; label: string }> = [
  { key: "in_progress", label: "قيد التنفيذ" },
  { key: "delivered", label: "تم التسليم والمراجعة" },
  { key: "escrow", label: "في فترة الضمان (Escrow)" },
  { key: "completed", label: "مكتمل ونهائي" },
];

const STATE_STEP: Record<OrderState, number> = {
  in_progress: 0,
  escrow: 2,
  disputed: 2,
  completed: 3,
};

const STATE_TABS: Array<{ id: OrderState; label: string }> = [
  { id: "in_progress", label: "قيد التنفيذ" },
  { id: "escrow", label: "فترة الضمان" },
  { id: "disputed", label: "نزاع مفتوح" },
  { id: "completed", label: "مكتمل" },
];

const REASONS = [
  "عدم مطابقة المواصفات",
  "تأخر التسليم عن الموعد",
  "ملفات تالفة أو غير مكتملة",
  "أخرى",
];

function pad(n: number) {
  return String(Math.floor(n)).padStart(2, "0");
}

function OrdersPage() {
  const { tr } = useLang();
  const [state, setState] = useState<OrderState>("escrow");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const totalHold = 12 * 3600;
  const [left, setLeft] = useState(11 * 3600 + 42 * 60 + 15);

  useEffect(() => {
    if (state !== "escrow" || left <= 0) return;
    const id = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [state, left]);

  const currentStep = STATE_STEP[state];
  const timer = `${pad(left / 3600)}:${pad((left % 3600) / 60)}:${pad(left % 60)}`;
  const progress = Math.max(0, Math.min(100, ((totalHold - left) / totalHold) * 100));

  return (
    <div className="overflow-x-hidden">
      <Section
        title={tr("إدارة الطلب والضمان", "Order & escrow management")}
        subtitle={tr("تتبّع حالة الطلب، حمّل التسليمات، وأدر النزاعات المالية.", "Track order state, download deliverables, manage disputes.")}
        action={
          <div className="flex flex-wrap gap-1.5">
            {STATE_TABS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setState(s.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  state === s.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="grid min-w-0 gap-4">
            <Card>
              <h2 className="text-sm font-black">مسار الطلب</h2>
              <ol className="mt-5 grid gap-4 sm:grid-cols-4">
                {STEPS.map((st, i) => {
                  const done = i < currentStep || state === "completed";
                  const active = i === currentStep && state !== "completed";
                  return (
                    <li key={st.key} className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-black ${
                            done
                              ? "bg-primary text-primary-foreground"
                              : active
                                ? "bg-accent/20 text-accent ring-2 ring-accent/50"
                                : "border border-border text-muted-foreground"
                          }`}
                        >
                          {done ? <CheckCircle2 className="size-4" /> : i + 1}
                        </span>
                        <span className={`h-1 flex-1 rounded-full ${done ? "bg-primary" : "bg-secondary"}`} />
                      </div>
                      <p className={`mt-2 text-xs font-bold ${active ? "text-accent" : done ? "text-foreground" : "text-muted-foreground"}`}>
                        {st.label}
                      </p>
                    </li>
                  );
                })}
              </ol>

              {state === "escrow" && (
                <div className="mt-5 rounded-xl border border-accent/40 bg-accent/10 p-4">
                  <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-accent">
                    <Timer className="size-4 shrink-0" />
                    {`الأرباح تحت حماية الضمان: متبقي ${timer} لتحرير المبلغ للبائع تلقائياً`}
                  </p>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">دورة الضمان المعتمدة لباقتك: 12 ساعة (Pro موثق KYC).</p>
                </div>
              )}

              {state === "disputed" && (
                <p className="mt-5 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs font-bold text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  النزاع مفتوح والرصيد مجمّد في محفظة الضمان بانتظار قرار التحكيم النهائي.
                </p>
              )}

              {state === "completed" && (
                <p className="mt-5 flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 p-4 text-xs font-bold text-primary">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                  تم تحرير المبلغ للبائع واكتمل الطلب نهائياً.
                </p>
              )}
            </Card>

            <Card>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <h2 className="min-w-0 truncate text-sm font-black">تفاصيل الطلب #ORD-8842</h2>
                <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                  {STATE_TABS.find((s) => s.id === state)?.label}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["المشتري", "@buy****_21"],
                  ["البائع", "@sell****_99"],
                  ["الخدمة المشتراة", "تصميم هوية بصرية كاملة + دليل استخدام"],
                  ["إجمالي المدفوع", "180 USDT"],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0 rounded-xl border border-border bg-secondary/40 px-4 py-3">
                    <dt className="text-[11px] text-muted-foreground">{k}</dt>
                    <dd className="mt-1 truncate text-sm font-bold">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 grid gap-2">
                {[
                  ["brand-final-pack.zip", "184 MB"],
                  ["brand-guidelines.pdf", "12 MB"],
                ].map(([name, size]) => (
                  <div key={name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border px-4 py-3">
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{size}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-bold text-primary">
                          <ShieldCheck className="size-3" /> خالٍ من الفيروسات
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toast.success("بدأ تنزيل الملف")}
                      className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground"
                      aria-label={`تنزيل ${name}`}
                    >
                      <Download className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="h-max">
            <h2 className="text-sm font-black">إجراءات المشتري</h2>
            <div className="mt-4 grid gap-2.5">
              <button
                type="button"
                disabled={state === "completed" || state === "disputed"}
                onClick={() => setConfirmOpen(true)}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
              >
                تأكيد الاستلام وتحرير الرصيد فوراً
              </button>
              <button
                type="button"
                disabled={state !== "escrow"}
                onClick={() => toast.success("تم إرسال طلب التعديل للبائع")}
                className="w-full rounded-xl border border-border py-3 text-sm font-bold text-foreground disabled:opacity-40"
              >
                طلب تعديل
              </button>
              <button
                type="button"
                disabled={state === "completed" || state === "disputed"}
                onClick={() => setDisputeOpen(true)}
                className="w-full rounded-xl border border-destructive/50 bg-destructive/10 py-3 text-sm font-bold text-destructive disabled:opacity-40"
              >
                فتح نزاع مالي (Dispute)
              </button>
            </div>
            <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <Clock className="mt-0.5 size-3.5 shrink-0" />
              في حال عدم اتخاذ أي إجراء، يُحرَّر المبلغ للبائع تلقائياً بانتهاء مؤقت الضمان.
            </p>
          </Card>
        </div>
      </Section>

      {confirmOpen && (
        <Modal title="تأكيد الاستلام" onClose={() => setConfirmOpen(false)}>
          <p className="text-sm leading-relaxed text-muted-foreground">
            سيتم تحرير مبلغ 180 USDT للبائع فوراً ولا يمكن التراجع عن العملية أو فتح نزاع بعد التأكيد.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setState("completed");
                setConfirmOpen(false);
                toast.success("تم تحرير المبلغ للبائع واكتمل الطلب");
              }}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              تأكيد وتحرير
            </button>
            <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-xl border border-border px-4 py-3 text-sm font-bold">
              إلغاء
            </button>
          </div>
        </Modal>
      )}

      {disputeOpen && (
        <DisputeModal
          onClose={() => setDisputeOpen(false)}
          onSubmitted={() => {
            setState("disputed");
            setDisputeOpen(false);
            toast.success("تم تقديم طلب التحكيم وتجميد الدفعة");
          }}
        />
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const { tr } = useLang();
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-background/80 p-4 backdrop-blur" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="min-w-0 truncate text-lg font-black">{title}</h2>
          <button type="button" onClick={onClose} aria-label={tr("إغلاق", "Close")} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

type Evidence = { id: number; name: string; size: number; progress: number };

function DisputeModal({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const [reason, setReason] = useState(REASONS[0]!);
  const [statement, setStatement] = useState("");
  const [files, setFiles] = useState<Evidence[]>([]);
  const [drag, setDrag] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tooShort = statement.trim().length < 50;
  const valid = !tooShort && !submitting;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const accepted: Evidence[] = [];
    Array.from(list).forEach((f) => {
      if (f.size > 50 * 1024 * 1024) {
        toast.error(`الملف ${f.name} يتجاوز 50MB`);
        return;
      }
      accepted.push({ id: Date.now() + Math.random(), name: f.name, size: f.size, progress: 0 });
    });
    if (accepted.length) setFiles((p) => [...p, ...accepted]);
  };

  useEffect(() => {
    if (!files.some((f) => f.progress < 100)) return;
    const id = setInterval(() => {
      setFiles((prev) => prev.map((f) => (f.progress < 100 ? { ...f, progress: Math.min(100, f.progress + 12) } : f)));
    }, 220);
    return () => clearInterval(id);
  }, [files]);

  const totalMb = useMemo(() => files.reduce((s, f) => s + f.size, 0) / (1024 * 1024), [files]);

  return (
    <Modal title="نافذة التحكيم وفض النزاعات" onClose={onClose}>
      <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs font-bold leading-relaxed text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        تنبيه: فتح النزاع يجمّد رصيد المعاملة في محفظة الضمان فوراً ويُحيل الملف للمشرف للتحكيم النهائي بناءً على شروط المنصة وإثباتات التسليم.
      </p>

      <label className="mt-4 block text-xs font-bold">سبب النزاع</label>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
      >
        {REASONS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      <label className="mt-4 block text-xs font-bold">شرح تفصيلي (50 حرفاً على الأقل)</label>
      <textarea
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        rows={4}
        placeholder="اشرح المشكلة بالتفصيل مع ذكر البنود غير المنفّذة..."
        className="mt-1.5 w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
      <p className={`mt-1 text-[11px] font-bold ${tooShort ? "text-destructive" : "text-muted-foreground"}`}>
        {tooShort ? `يجب ألا يقل الشرح عن 50 حرفاً (${statement.trim().length}/50)` : `${statement.trim().length} حرفاً`}
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mt-4 grid cursor-pointer place-items-center rounded-xl border border-dashed p-6 text-center transition-colors ${
          drag ? "border-primary bg-primary/10" : "border-border"
        }`}
      >
        <Upload className="size-6 text-primary" />
        <p className="mt-2 text-sm font-bold">اسحب أدلة الإثبات هنا أو اضغط للاختيار</p>
        <p className="text-[11px] text-muted-foreground">صور، PDF، ZIP — حتى 50MB للملف الواحد</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.zip"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-3 grid gap-2">
          {files.map((f) => (
            <div key={f.id} className="rounded-xl border border-border px-3 py-2.5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <p className="truncate text-xs font-bold">{f.name}</p>
                <button
                  type="button"
                  onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))}
                  aria-label={`حذف ${f.name}`}
                  className="grid size-6 shrink-0 place-items-center rounded-md border border-border text-muted-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${f.progress}%` }} />
              </div>
            </div>
          ))}
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <FileWarning className="size-3.5" /> {`إجمالي الأدلة: ${totalMb.toFixed(1)} MB`}
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={!valid}
        onClick={() => {
          setSubmitting(true);
          setTimeout(onSubmitted, 700);
        }}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-destructive py-3 text-sm font-bold text-destructive-foreground disabled:opacity-40"
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <AlertTriangle className="size-4" />}
        تقديم طلب التحكيم وتجميد الدفعة
      </button>
    </Modal>
  );
}
