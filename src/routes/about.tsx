import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, PackageCheck, Scale, ShieldCheck, Wallet, Mail } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "من نحن | المنجز" },
      { name: "description", content: "تعرّف على المنجز: سوق رقمي عالمي للعمل الحر والمنتجات الرقمية بالدفع عبر USDT وضمان مالي يحمي الطرفين." },
      { property: "og:title", content: "من نحن | المنجز" },
      { property: "og:description", content: "سوق رقمي عالمي موثوق: أموالك محجوزة حتى تستلم عملك، وتحكيم محايد عند الخلاف." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { tr } = useLang();
  const steps = [
    { icon: Wallet, t: tr("تدفع المبلغ", "You pay"), d: tr("يُخصم من محفظتك عند قبول العرض أو الشراء.", "Charged from your wallet when you accept or buy.") },
    { icon: Lock, t: tr("يُحجز بأمان", "It's held safely"), d: tr("لا يصل للبائع أثناء العمل، ولا يمكن سحبه من الطرفين.", "Neither side can withdraw it during the work.") },
    { icon: PackageCheck, t: tr("تستلم ثم يُفرج عنه", "You receive, then it's released"), d: tr("بعد اعتمادك للتسليم يُحوَّل للبائع مباشرة.", "Once you approve delivery, the seller is paid.") },
  ];
  const promises = [
    { icon: ShieldCheck, t: tr("حماية المشتري", "Buyer protection"), d: tr("مهلة فحص بعد التسليم، ولا تُفرج الأموال قبل رضاك أو انتهاء المهلة.", "An inspection window after delivery; funds aren't released before you're satisfied or the window ends.") },
    { icon: Lock, t: tr("ضمان حق البائع", "Seller guarantee"), d: tr("المبلغ محجوز قبل أن تبدأ العمل، فلا تعمل مجاناً أبداً.", "The money is locked before you start, so you never work for free.") },
    { icon: Scale, t: tr("تحكيم محايد", "Neutral arbitration"), d: tr("عند الخلاف يراجع فريق التحكيم المحادثة والتسليم، ورسائل الطلب لا يمكن تعديلها أو حذفها.", "In a dispute, arbitrators review the chat and delivery; order messages can't be edited or deleted.") },
  ];
  return (
    <Section title={tr("من نحن", "About us")} subtitle={tr("المُنجِز سوق رقمي عالمي ثنائي اللغة يجمع العمل الحر والمنتجات الرقمية في مكان واحد، بالدفع والسحب عبر USDT.", "Al Munjiz is a global bilingual marketplace for freelance work and digital products, paid and withdrawn in USDT.")}>
      <div className="mx-auto max-w-3xl space-y-10">
        <p className="leading-relaxed text-muted-foreground">
          {tr(
            "بنينا المنجز لأن كثيراً من المستقلين العرب يواجهون صعوبة في استلام أموالهم عبر البنوك، وكثيراً من المشترين يخشون الدفع لشخص لا يعرفونه. الحل بسيط: المبلغ يُحجز عندنا، ولا يصل للبائع إلا بعد أن يستلم المشتري عمله.",
            "We built Al Munjiz because many Arab freelancers struggle to get paid through banks, and many buyers fear paying strangers. The fix is simple: we hold the money, and the seller is paid only after the buyer receives the work.",
          )}
        </p>

        <div>
          <h2 className="mb-4 text-lg font-bold">{tr("كيف تُحمى أموالك؟", "How is your money protected?")}</h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={i}>
                <Card className="h-full">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <span className="grid size-7 place-items-center rounded-full border border-border text-xs"><bdi>{i + 1}</bdi></span>
                    <s.icon className="size-4 text-primary" /> {s.t}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
                </Card>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid gap-3">
          {promises.map((p, i) => (
            <Card key={i} className="flex gap-3">
              <p.icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-bold">{p.t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{p.d}</p>
              </div>
            </Card>
          ))}
        </div>

        <Card className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="size-4 text-primary" /> {tr("لأي سؤال تواصل مع الدعم من زر المساعدة أسفل الصفحة.", "For any question, reach support via the help button below.")}
          </div>
          <Link to="/store" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
            {tr("ابدأ التصفح", "Start browsing")}
          </Link>
        </Card>
      </div>
    </Section>
  );
}
