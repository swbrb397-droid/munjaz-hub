import { useEffect, useState, type ComponentType } from "react";
import { ChevronLeft, ChevronRight, Coins, Crown, ShieldCheck, X, Zap } from "lucide-react";
import { useLang } from "@/lib/lang";

const SEEN_KEY = "munjaz_manifesto_seen";

type Chapter = {
  icon: ComponentType<{ className?: string }>;
  title: [string, string];
  quote: [string, string];
  points: Array<[string, string]>;
};

const CHAPTERS: ReadonlyArray<Chapter> = [
  {
    icon: Coins,
    title: ["السيادة والتحرر المالي", "Financial sovereignty"],
    quote: [
      "المال الحر كرامة؛ حين لا يستأذن جهدك أحداً، يصير عرقك ملكك وحدك.",
      "Free money is dignity: when your effort asks no permission, your sweat is yours alone.",
    ],
    points: [
      ["التعامل حصرياً بعملة USDT عبر شبكتي TRC20 و BEP20 دون وسطاء بنكيين.", "Everything settles in USDT over TRC20 and BEP20 — no banking intermediaries."],
      ["لا تجميد للأموال ولا قيود جغرافية؛ الإيداع والسحب يتمّان من محفظتك مباشرة.", "No frozen funds and no geographic gates — deposits and payouts move straight from your wallet."],
    ],
  },
  {
    icon: ShieldCheck,
    title: ["قدسية العهد والعدالة", "The sanctity of the covenant"],
    quote: [
      "العقد الذي يحرسه الرمز لا ينكث؛ العدالة هنا ليست وعداً، بل آلية.",
      "A covenant guarded by code is never broken: justice here is a mechanism, not a promise.",
    ],
    points: [
      ["نظام الضمان الذكي (Escrow) يحجز مبلغ المشتري قبل بدء العمل ويحميه حتى التسليم.", "Smart escrow locks the buyer's funds before work starts and protects them until delivery."],
      ["تقسيم المشروع إلى «معالم مرحلية» يحرّر المال جزئياً برضا الطرفين فقط.", "Splitting a project into milestones releases funds partially, only with both parties' consent."],
    ],
  },
  {
    icon: Crown,
    title: ["نبالة الصنعة وعرش الهيمنة", "Craft nobility and the apex throne"],
    quote: [
      "الرتبة لا تُشترى، تُنتزع بالإتقان؛ والتاج يليق بمن التزم.",
      "Rank is never bought — it is earned by mastery, and the crown suits the committed.",
    ],
    points: [
      ["ثمانية مستويات تُحسب بخوارزمية النقاط الأربع: الطلبات، حجم التداول، النجوم، والالتزام بالمواعيد.", "Eight levels computed from four metrics: orders, volume, star rating and on-time delivery."],
      ["الرتب تجميلية بالكامل ولا تقيّد النشر؛ شارة الهيمنة ترفع ظهورك في نتائج البحث.", "Ranks are cosmetic and never cap publishing; the Dominance badge lifts your search visibility."],
    ],
  },
  {
    icon: Zap,
    title: ["أرض الفعل والسيادة", "The ground of action"],
    quote: [
      "بعد الميثاق يأتي البناء؛ ابدأ الآن ودع أثرك يتكلم.",
      "After the covenant comes the building: start now and let your work speak.",
    ],
    points: [
      ["لوحة تحكم موحّدة تجمع الطلبات والمحفظة والرتبة في مكان واحد.", "One unified dashboard for orders, wallet and rank."],
      ["سحب مؤمَّن بمراجعة إدارية، ونشر مشاريعك وخدماتك مباشرة بلا انتظار.", "Secured payouts with admin review, and instant publishing of your services."],
    ],
  },
];

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

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-background/70 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label={tr("ميثاق المُنجِز", "The Munjaz Manifesto")}
    >
      <div className="w-full max-w-xl rounded-2xl border border-primary/20 bg-card/85 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-black">{tr("ميثاق المُنجِز", "The Munjaz Manifesto")}</h2>
          <button
            type="button"
            onClick={finish}
            aria-label={tr("إغلاق", "Close")}
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div key={step} className="mt-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_28px_-8px_var(--primary)]">
              <Icon className="size-5" />
            </span>
            <h3 className="text-base font-black">{lang === "ar" ? chapter.title[0] : chapter.title[1]}</h3>
          </div>

          <p className="mt-4 border-s-2 border-accent/50 ps-3 text-sm italic leading-relaxed text-accent">
            {lang === "ar" ? chapter.quote[0] : chapter.quote[1]}
          </p>

          <p className="mt-5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {tr("كيف تعمل المنصة؟", "How does the platform work?")}
          </p>
          <ul className="mt-2 grid gap-2 text-sm text-muted-foreground">
            {chapter.points.map((p) => (
              <li key={p[0]} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{lang === "ar" ? p[0] : p[1]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            aria-label={tr("السابق", "Previous")}
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground disabled:opacity-40"
          >
            <ChevronRight className="size-4 ltr:hidden" />
            <ChevronLeft className="size-4 rtl:hidden" />
          </button>

          <div className="flex items-center gap-2">
            {CHAPTERS.map((c, i) => (
              <button
                key={c.title[0]}
                type="button"
                onClick={() => setStep(i)}
                aria-label={`${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-2 bg-border"}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setStep((s) => Math.min(CHAPTERS.length - 1, s + 1))}
            disabled={last}
            aria-label={tr("التالي", "Next")}
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground disabled:opacity-40"
          >
            <ChevronLeft className="size-4 ltr:hidden" />
            <ChevronRight className="size-4 rtl:hidden" />
          </button>
        </div>

        <button
          type="button"
          onClick={last ? finish : () => setStep((s) => s + 1)}
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-black text-primary-foreground transition-transform duration-200 hover:scale-[1.02]"
        >
          {last ? tr("أقرّ بالميثاق، ولنبدأ البناء", "I accept the covenant — let's build") : tr("التالي", "Next")}
        </button>
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
