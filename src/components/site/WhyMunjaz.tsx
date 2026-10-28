import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Coins, Lock, PackageCheck, Scale, ShieldCheck, Trophy, Wallet, type LucideIcon } from "lucide-react";
import { useLang } from "@/lib/lang";

type Role = "buyer" | "seller";
type Bi = [string, string];
type Feature = { icon: LucideIcon; title: Bi; buyer: Bi; seller: Bi };

/** Ordered by priority: trust first, money second, speed and fairness after. */
const FEATURES: Feature[] = [
  {
    icon: ShieldCheck,
    title: ["الضمان المالي (Escrow)", "Escrow protection"],
    buyer: ["مالك محجوز لدى المنصة، ولا يصل للبائع إلا بعد استلامك ورضاك.", "Your money is held by the platform and only reaches the seller after you approve."],
    seller: ["المبلغ محجوز قبل أن تبدأ — لن تعمل مجاناً أبداً.", "The full amount is locked before you start — you never work for free."],
  },
  {
    icon: Wallet,
    title: ["دفع وسحب فوري بـ USDT", "Instant USDT payments"],
    buyer: ["ادفع من أي دولة دون بطاقة بنكية أو رفض بوابات الدفع.", "Pay from any country without a bank card or gateway rejections."],
    seller: ["اسحب أرباحك لمحفظتك مباشرة، بلا حوالات بنكية ولا انتظار أسابيع.", "Withdraw straight to your wallet — no bank wires, no weeks of waiting."],
  },
  {
    icon: PackageCheck,
    title: ["تسليم فوري للمنتجات الرقمية", "Instant digital delivery"],
    buyer: ["تستلم الملف لحظة الدفع، مع 24 ساعة للإبلاغ عن أي خلل.", "Get the file the moment you pay, with 24 hours to report any issue."],
    seller: ["ارفع منتجك مرة واحدة وبِعه آلاف المرات تلقائياً.", "Upload once and sell it thousands of times automatically."],
  },
  {
    icon: Trophy,
    title: ["ظهور بالجدارة فقط", "Merit-only ranking"],
    buyer: ["أول من تراه هو الأفضل تقييماً، لا من دفع أكثر للإعلان.", "The first sellers you see are the best rated, not the biggest advertisers."],
    seller: ["لا إعلانات مدفوعة — جودتك وحدها ترفعك في سلّم الرتب.", "No paid ads — your quality alone climbs the rank ladder."],
  },
  {
    icon: Coins,
    title: ["عمولة عادلة", "Fair commission"],
    buyer: ["أسعار أقل لأن البائع لا يرفعها لتعويض عمولة 20%.", "Lower prices, because sellers don't inflate them to cover a 20% cut."],
    seller: ["10% فقط، و5% مع باقة المحترفين — نصف ما تأخذه المنصات الأخرى.", "Only 10%, or 5% on Pro — half of what other platforms take."],
  },
  {
    icon: Scale,
    title: ["تحكيم محايد في النزاعات", "Neutral dispute desk"],
    buyer: ["إن لم يُسلَّم العمل كما اتُّفق، يُعاد لك مالك كلياً أو جزئياً.", "If the work isn't delivered as agreed, you get a full or partial refund."],
    seller: ["سجل المحادثة يُقفل كدليل لا يُعدَّل، فيُحفظ حقك بالأدلة.", "The chat is locked as tamper-proof evidence that protects you."],
  },
];

const STEPS: Bi[] = [
  ["تدفع أو تقبل العرض", "Pay or accept the offer"],
  ["يُحجز المبلغ بأمان", "Funds are locked safely"],
  ["تستلم ثم يُفرَج عنه", "Receive, then it's released"],
];

export function WhyMunjaz() {
  const { tr } = useLang();
  const [role, setRole] = useState<Role>("buyer");

  return (
    <section className="border-b border-border" aria-labelledby="why-munjaz">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="chip">{tr("من نحن", "About us")}</span>
          <h2 id="why-munjaz" className="mt-3 text-2xl font-black sm:text-4xl">
            {tr("لماذا المُنجِز؟", "Why Al Munjiz?")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {tr(
              "سوق رقمي عالمي بلا حدود يجمع العمل الحر والمنتجات الرقمية في مكان واحد — مالك محمي، وحقك مضمون، بلا بنوك ولا عمولات جائرة.",
              "A borderless marketplace for freelance work and digital products — your money protected, your rights guaranteed, no banks and no unfair fees.",
            )}
          </p>
        </div>

        {/* Safety cycle: the whole idea in three glances. */}
        <ol className="mx-auto mt-8 grid max-w-3xl grid-cols-3 gap-2 sm:gap-4">
          {STEPS.map((s, i) => (
            <li key={s[0]} className="grid justify-items-center gap-2 text-center">
              <span className="grid size-10 place-items-center rounded-full border border-primary/50 bg-primary/10 text-sm font-black text-primary">
                {i === 1 ? <Lock className="size-4" /> : <bdi>{i + 1}</bdi>}
              </span>
              <span className="text-[11px] font-bold leading-snug sm:text-sm">{tr(s[0], s[1])}</span>
            </li>
          ))}
        </ol>

        <div role="tablist" aria-label={tr("اختر دورك", "Choose your role")} className="mx-auto mt-10 grid max-w-sm grid-cols-2 gap-1 rounded-xl border border-border p-1">
          {(["buyer", "seller"] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={role === r}
              onClick={() => setRole(r)}
              className={`min-h-11 rounded-lg px-3 text-sm font-bold transition-colors ${
                role === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {r === "buyer" ? tr("أنا مشتري", "I'm a buyer") : tr("أنا مستقل / بائع", "I'm a seller")}
            </button>
          ))}
        </div>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            const text = role === "buyer" ? f.buyer : f.seller;
            return (
              <li key={f.title[0]} className="flex gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/50">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-bold">
                    <bdi className="text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</bdi>
                    {tr(f.title[0], f.title[1])}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{tr(text[0], text[1])}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to={role === "buyer" ? "/store" : "/create-listing"} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">
            {role === "buyer" ? tr("ابدأ التصفح", "Start browsing") : tr("انشر أول عرض لك", "Publish your first offer")}
            <ArrowLeft className="size-4 rtl:rotate-0 ltr:rotate-180" />
          </Link>
          <Link to="/pricing" className="inline-flex min-h-11 items-center rounded-xl border border-border px-5 text-sm font-bold hover:bg-secondary">
            {tr("الباقات", "Plans")}
          </Link>
        </div>
      </div>
    </section>
  );
}
