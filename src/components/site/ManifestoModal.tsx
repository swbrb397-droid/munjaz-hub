import { useEffect, useState, type ComponentType } from "react";
import { ChevronLeft, ChevronRight, Globe, Scale, ShieldCheck, X, Zap } from "lucide-react";
import { useLang } from "@/lib/lang";

const SEEN_KEY = "munjaz_manifesto_seen";

type Chapter = {
  icon: ComponentType<{ className?: string }>;
  badge: [string, string];
  title: [string, string];
  quote: [string, string];
  points: Array<[string, string]>;
  highlights: string[];
};

const CHAPTERS: ReadonlyArray<Chapter> = [
  {
    icon: ShieldCheck,
    badge: ["🛡️ الأمان والعهد المالي", "🛡️ Security & Financial Covenant"],
    title: ["الدرع المشفر: جهدك غير قابل للضياع", "The Encrypted Shield: Effort That Cannot Be Lost"],
    quote: [
      "العدالة هنا ليست وعوداً شفوية، بل نظام حجز ضمان مؤتمت وسياسات برمجية تحرس أتعابك.",
      "Justice here is not verbal promises, but an automated escrow system and coded policies that guard your earnings.",
    ],
    points: [
      [
        "أموال الصفقة تُحجز بالكامل في خزانة الضمان (Escrow) قبل البدء بتنفيذ أي مهمة.",
        "Deal funds are fully locked in escrow before any task begins.",
      ],
      [
        "تحرير الرصيد يتم تلقائياً فور تأكيد تسليم معالم المشروع المحددة.",
        "Balance is released automatically once the defined project milestones are confirmed delivered.",
      ],
    ],
    highlights: ["Escrow"],
  },
  {
    icon: Zap,
    badge: ["⚡ تمكين الصانع", "⚡ Maker Empowerment"],
    title: ["سيادة الصانع: الآلة تُطيع وأنت تأمر", "Maker Sovereignty: The Machine Obeys While You Command"],
    quote: [
      "الميدان لمن يقود طوفان الخوارزميات لا من يغرق فيه؛ الذكاء الاصطناعي أداة تنفيذية، وأنت سيّد الفكرة والقرار.",
      "The field belongs to those who lead the algorithmic flood, not those drowned by it; AI is an execution tool, and you are the master of idea and decision.",
    ],
    points: [
      [
        "العميل يدفع للقيمة النهائية المتقنة؛ رتبتك تتحدد بمهارة إدارتك للأدوات ودقة التسليم.",
        "The client pays for the refined final value; your rank is shaped by how skillfully you manage tools and deliver precisely.",
      ],
      [
        "نرحب بأدوات العصر الذكية لتعزيز إنتاجيتك وتخفيض زمن التنفيذ دون المساس بالجودة.",
        "We welcome modern intelligent tools to boost your productivity and reduce delivery time without touching quality.",
      ],
    ],
    highlights: ["الذكاء الاصطناعي"],
  },
  {
    icon: Scale,
    badge: ["⚖️ حماية السمعة والجدارة", "⚖️ Reputation & Merit Protection"],
    title: ["ميزان العدالة: البقاء للأكفأ ورفض الابتزاز", "The Scale of Justice: Survival of the Most Capable & No Extortion"],
    quote: [
      "لا احتكار لأسبقية التسجيل، ولا وصاية للتقييم الكيدي؛ عملك الحقيقي هو مقياس حضورك.",
      "No monopoly for early registration, and no guardianship for malicious ratings; your real work is the measure of your presence.",
      ],
    points: [
      [
        "خوارزمية البحث ترتب العروض بناءً على سرعة التفاعل ورضا المشترين اللحظي.",
        "Search ranking orders offers by response speed and live buyer satisfaction.",
      ],
      [
        "التقييم وسيلة قياس وليس أداة ضغط؛ الإدارة تتدخل لإلغاء أي تقييم كيدي خارج نطاق الاتفاق.",
        "Ratings are a measurement tool, not a pressure weapon; management intervenes to cancel any malicious review outside the agreement scope.",
      ],
    ],
    highlights: ["الجدارة"],
  },
  {
    icon: Globe,
    badge: ["🌐 الاستقلال المالي", "🌐 Financial Independence"],
    title: ["السيادة الخالصة: لا وصي على دخلك سواك", "Absolute Sovereignty: No Guardian Over Your Income But You"],
    quote: [
      "أرض عمل بلا حواجز جغرافية ولا قيود مصرفية تبتز أتعابك؛ محفظتك ملكك الخالص.",
      "A workspace with no geographic barriers and no banking restrictions extorting your earnings; your wallet is purely yours.",
    ],
    points: [
      [
        "سحب أرباحك مباشرة بالدولار الرقمي (USDT) لمحفظتك الخارجية دون تجميد بنكي.",
        "Withdraw your earnings directly in digital dollars (USDT) to your external wallet with no bank freeze.",
      ],
      [
        "لوحة تحكم فورية تجمع بين إدارة الصفقات، التواصل المباشر، والمحفظة الرقمية.",
        "A real-time dashboard unites deal management, direct communication, and your digital wallet.",
      ],
    ],
    highlights: ["USDT"],
  },
];

function HighlightText({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        terms.some((t) => t === part) ? (
          <span key={i} className="font-semibold text-emerald-400">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function ManifestoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tr, lang } = useLang();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        if (lang === "ar") {
          setStep((s) => Math.max(0, s - 1));
        } else {
          setStep((s) => Math.min(CHAPTERS.length - 1, s + 1));
        }
      } else if (e.key === "ArrowLeft") {
        if (lang === "ar") {
          setStep((s) => Math.min(CHAPTERS.length - 1, s + 1));
        } else {
          setStep((s) => Math.max(0, s - 1));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, lang]);

  if (!open) return null;
  const chapter = CHAPTERS[step]!;
  const Icon = chapter.icon;
  const last = step === CHAPTERS.length - 1;

  const finish = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage unavailable */
    }
    onClose();
  };

  const goNext = () => setStep((s) => Math.min(CHAPTERS.length - 1, s + 1));
  const goPrev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-background/70 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label={tr("ميثاق المُنجِز", "The Munjaz Manifesto")}
    >
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-border/60 bg-card p-4 shadow-2xl backdrop-blur-md sm:max-w-lg sm:p-6 md:max-w-2xl md:p-8">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-black sm:text-xl">{tr("ميثاق المُنجِز", "The Munjaz Manifesto")}</h2>
          <button
            type="button"
            onClick={finish}
            aria-label={tr("إغلاق", "Close")}
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mb-6 flex gap-2" aria-hidden="true">
          {CHAPTERS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i === step ? "bg-emerald-500" : "bg-emerald-500/20"
              }`}
            />
          ))}
        </div>

        <div
          key={step}
          className="flex min-h-[360px] flex-col justify-between select-none md:min-h-[320px]"
        >
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_28px_-8px_var(--color-emerald-500)]">
                <Icon className="size-5" />
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                <HighlightText text={lang === "ar" ? chapter.badge[0] : chapter.badge[1]} terms={chapter.highlights} />
              </span>
            </div>

            <h3 className="mb-3 text-base font-black leading-snug sm:text-lg md:text-xl">
              <HighlightText text={lang === "ar" ? chapter.title[0] : chapter.title[1]} terms={chapter.highlights} />
            </h3>

            <p className="mb-5 border-s-2 border-emerald-500/50 ps-3 text-sm italic leading-relaxed text-muted-foreground sm:text-base">
              <HighlightText text={lang === "ar" ? chapter.quote[0] : chapter.quote[1]} terms={chapter.highlights} />
            </p>

            <ul className="grid gap-3 text-sm text-muted-foreground sm:text-base">
              {chapter.points.map((p) => (
                <li key={p[0]} className="flex items-start gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span className="leading-relaxed">
                    <HighlightText text={lang === "ar" ? p[0] : p[1]} terms={chapter.highlights} />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/40 pt-4">
            <button
              type="button"
              onClick={goPrev}
              disabled={step === 0}
              aria-label={tr("السابق", "Previous")}
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <ChevronRight className="size-4 ltr:hidden" />
              <ChevronLeft className="size-4 rtl:hidden" />
            </button>

            <button
              type="button"
              onClick={last ? finish : goNext}
              className="w-full rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-bold text-black transition-colors hover:bg-emerald-600 sm:w-auto"
            >
              {last
                ? tr("أقرّ بالميثاق وأبدأ رحلتي", "I accept the charter — start my journey")
                : tr("التالي", "Next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** True once, on the first visit after registration. */
export function useManifestoFirstRun(isAuthenticated: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      if (!window.localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      /* storage unavailable */
    }
  }, [isAuthenticated]);
  return [open, setOpen] as const;
}
