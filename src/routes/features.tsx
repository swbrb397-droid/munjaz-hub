import { createFileRoute, Link } from "@tanstack/react-router";
import { Handshake, Lock, Wallet, PackageCheck, TrendingUp, Scale, Users, type LucideIcon } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "مزايا المُنجِز | سبع ركائز تحمي صفقتك" },
      { name: "description", content: "تعرّف على ركائز المُنجِز: الصفقة المباشرة، الضمان المالي بالمراحل، الدفع بـ USDT، التسليم الرقمي الفوري، الظهور بالجدارة، التحكيم المنصف، وبرنامج الإحالة." },
      { property: "og:title", content: "مزايا المُنجِز | سبع ركائز تحمي صفقتك" },
      { property: "og:description", content: "سوق رقمي عالمي يحجز أموالك حتى تستلم، ويدفع للمستقل فور الاعتماد بـ USDT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://almunjazhub.com/features" }],
  }),
  component: FeaturesPage,
});

type Pillar = { icon: LucideIcon; title: string; lead: string; buyer: string; seller: string };

function FeaturesPage() {
  const { tr } = useLang();
  const pillars: Pillar[] = [
    {
      icon: Handshake,
      title: tr("الصفقة المباشرة", "Direct Contracts"),
      lead: tr("لديك عميل من خارج المنصة؟ أنشئ صفقة برابط خاص ترسله له، فيدفع داخل الضمان وتعمل وأنت مطمئن.", "Have a client from outside? Create a deal with a private link; they pay into escrow and you work with peace of mind."),
      buyer: tr("تتعامل مع مستقل تعرفه بحماية كاملة لأموالك.", "Work with a freelancer you know, fully protected."),
      seller: tr("تحوّل عملاءك الحاليين إلى صفقات مضمونة الدفع.", "Turn your existing clients into guaranteed-payment deals."),
    },
    {
      icon: Lock,
      title: tr("الضمان المالي والدفع على مراحل", "Escrow & Milestones"),
      lead: tr("المبلغ يُحجز قبل بدء العمل، ويُفرج عنه مرحلةً بمرحلة كلما اعتمدت التسليم.", "Funds are locked before work starts and released milestone by milestone as you approve."),
      buyer: tr("لا تدفع إلا مقابل عمل استلمته ورضيت عنه.", "You only pay for work you received and approved."),
      seller: tr("المال موجود فعلاً قبل أن تبدأ، فلا تعمل مجاناً أبداً.", "The money exists before you start — never work for free."),
    },
    {
      icon: Wallet,
      title: tr("مدفوعات سريعة بالدولار الرقمي", "Fast USDT Payments"),
      lead: tr("اشحن واسحب بـ USDT عبر شبكات TRC-20 وBEP-20 وPolygon، دون بنوك أو قيود تحويل.", "Top up and withdraw USDT on TRC-20, BEP-20 and Polygon — no banks, no transfer limits."),
      buyer: tr("ادفع من أي بلد دون بطاقة بنكية دولية.", "Pay from any country without an international card."),
      seller: tr("أرباحك تصل محفظتك بسرعة وبرسوم منخفضة.", "Your earnings reach your wallet fast with low fees."),
    },
    {
      icon: PackageCheck,
      title: tr("المنتجات الرقمية والتسليم الفوري", "Instant Digital Delivery"),
      lead: tr("قوالب وأكواد ودورات وكتب تُسلَّم لحظة الدفع من خزنة آمنة، مع مهلة 24 ساعة للإبلاغ عن أي مشكلة.", "Templates, code, courses and e-books delivered the moment you pay from a secure vault, with a 24-hour window to report issues."),
      buyer: tr("تحصل على ما اشتريته فوراً، ومالك محمي إن كان الملف معطوباً.", "Get your purchase instantly; your money is protected if the file is broken."),
      seller: tr("تبيع منتجك آلاف المرات دون أن تتدخل في كل طلب.", "Sell your product many times without handling each order."),
    },
    {
      icon: TrendingUp,
      title: tr("ظهور عادل بالجدارة", "Fair Merit Ranking"),
      lead: tr("ترتيب البائعين يعتمد على جودة العمل والتقييمات والالتزام فقط — لا إعلانات مدفوعة ولا شراء للظهور.", "Sellers rank by quality, reviews and reliability only — no paid ads, no bought visibility."),
      buyer: tr("ترى أفضل المستقلين فعلاً، لا من دفع أكثر.", "You see the truly best freelancers, not the highest bidders."),
      seller: tr("جهدك وحده يرفعك في سلّم الرتب.", "Your work alone moves you up the ranks."),
    },
    {
      icon: Scale,
      title: tr("مهلة فحص وتحكيم منصف", "Inspection & Fair Arbitration"),
      lead: tr("بعد التسليم لديك وقت كافٍ لفحص العمل، وعند الخلاف يراجع فريق محايد المحادثة والتسليم ويحكم بالعدل، حتى بتسوية جزئية.", "After delivery you get time to inspect; in a dispute a neutral team reviews the chat and delivery and rules fairly, including partial splits."),
      buyer: tr("حقك محفوظ إن لم يطابق العمل المتفق عليه.", "Your rights are safe if the work doesn't match the agreement."),
      seller: tr("لا يُلغى أجرك بسبب شكوى غير عادلة.", "Your pay isn't cancelled over an unfair complaint."),
    },
    {
      icon: Users,
      title: tr("برنامج الشراكة والإحالة", "Referral Program"),
      lead: tr("شارك رابطك الخاص واحصل على نسبة من عمولة المنصة عن كل من يسجّل عبرك ويتعامل.", "Share your link and earn a share of the platform commission from everyone who joins and trades through you."),
      buyer: tr("ادعُ أصدقاءك واكسب دون أن تبيع شيئاً.", "Invite friends and earn without selling anything."),
      seller: tr("دخل إضافي مستمر فوق أرباح عملك.", "Ongoing extra income on top of your work."),
    },
  ];

  return (
    <Section title={tr("مزايا المُنجِز", "Why Al Munjaz Hub")} subtitle={tr("سبع ركائز تجعل كل صفقة آمنة وعادلة للطرفين.", "Seven pillars that keep every deal safe and fair for both sides.")}>
      <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
        {pillars.map((p, i) => (
          <Card key={p.title} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-secondary text-primary">
                <p.icon className="size-5" aria-hidden />
              </span>
              <h2 className="text-base font-bold sm:text-lg">
                <span className="me-1 text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                {p.title}
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{p.lead}</p>
            <dl className="mt-auto grid gap-2 border-t border-border pt-3 text-sm">
              <div>
                <dt className="font-semibold text-foreground">{tr("للمشتري", "For buyers")}</dt>
                <dd className="text-muted-foreground">{p.buyer}</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">{tr("للمستقل والبائع", "For sellers")}</dt>
                <dd className="text-muted-foreground">{p.seller}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
      <div className="mx-auto mt-8 flex max-w-5xl flex-wrap justify-center gap-3">
        <Link to="/store" className="inline-flex min-h-[44px] items-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground">
          {tr("ابدأ التصفح", "Start browsing")}
        </Link>
        <Link to="/pricing" className="inline-flex min-h-[44px] items-center rounded-lg border border-border px-5 text-sm font-semibold hover:bg-secondary">
          {tr("الباقات", "Plans")}
        </Link>
      </div>
    </Section>
  );
}
