import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronDown, Crown, Loader2, Sparkles } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { RedeemPassCard } from "@/components/site/RedeemPassCard";
import { TopUpDialog } from "@/components/site/TopUpDialog";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useWallet } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "باقات الاشتراك | المُنجِز" },
      { name: "description", content: "باقات المجانية والمحترفين والشركات بعملة USDT مع مزايا واضحة وتسريع دورة الضمان." },
      { property: "og:title", content: "باقات الاشتراك | المُنجِز" },
      { property: "og:description", content: "10 USDT للمحترفين و49 USDT للشركات — الظهور يعتمد على الكفاءة فقط." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

type TierId = "free" | "pro" | "corporate";

const TIERS: Array<{
  id: TierId;
  name: string;
  price: number;
  featured?: boolean;
  premium?: boolean;
  cta: string;
  features: string[];
}> = [
  {
    id: "free",
    name: "الباقة المجانية",
    price: 0,
    cta: "باقتك الحالية",
    features: [
      "عمولة المنصة: 10% قياسية",
      "حجز أمان الضمان (Escrow) لمدة 36 ساعة فقط",
      "حد رفع الملفات 50MB",
      "رابط إحالة مالي قياسي لمدة 12 شهراً",
      "أولوية متساوية في محرك البحث تعتمد على الكفاءة",
    ],
  },
  {
    id: "pro",
    name: "باقة المحترفين",
    price: 10,
    featured: true,
    cta: "ترقية إلى Pro الآن",
    features: [
      "عمولة المنصة: 5% مخفضة فقط",
      "تقليص حجز الضمان إلى 12 ساعة فقط (مع توثيق KYC)",
      "رفع ملفات حتى 500MB",
      "شارة «بائع Pro موثق» (دون التأثير على خوارزمية جدارة البحث)",
      "دعم فني ذو أولوية",
    ],
  },
  {
    id: "corporate",
    name: "باقة الشركات",
    price: 49,
    premium: true,
    cta: "حجز مقعد الشركات",
    features: [
      "عمولة المنصة: 2.5% أدنى عمولة في المنصة",
      "تسريع دورة الضمان إلى 6 ساعات فقط",
      "رفع مشاريع وسائط حتى 2GB عبر التخزين السحابي المباشر",
      "شارة «حساب شركات معتمد»",
      "مدير حساب مخصص وأدوات إدارة فرق العمل",
    ],
  },
];

function PricingPage() {
  const { tr } = useLang();
  const [openTable, setOpenTable] = useState(false);
  const [topUp, setTopUp] = useState<number | null>(null);
  const { user } = useAuth();
  const profile = useProfile();
  const wallet = useWallet();
  const qc = useQueryClient();
  const currentTier = profile.data?.account_tier ?? "free";
  const purchase = useMutation({
    mutationFn: async (tier: "pro" | "corporate") => {
      const { data, error } = await supabase.rpc("purchase_subscription_plan", { p_tier: tier });
      if (error) throw new Error(error.message);
      const result = data as { success?: boolean; message?: string; missing_amount?: number } | null;
      if (!result?.success) return result;
      return result;
    },
    onSuccess: (result) => {
      if (!result?.success) {
        setTopUp(Math.max(1, Number(result?.missing_amount ?? 0)));
        toast.error(tr("رصيدك غير كافٍ؛ اشحن المبلغ المتبقي لإتمام الترقية.", "Insufficient balance; top up the remainder to upgrade."));
        return;
      }
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(tr("تم تفعيل الباقة لمدة 30 يوماً.", "Your plan is active for 30 days."));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const upgrade = (tier: TierId, price: number) => {
    if (tier === "free" || tier === currentTier) return;
    if (!user) {
      toast.error(tr("سجّل الدخول أولاً لترقية باقتك.", "Sign in first to upgrade your plan."));
      return;
    }
    const available = Number(wallet.data?.available_usdt ?? 0);
    if (available < price) {
      setTopUp(Number((price - available).toFixed(2)));
      return;
    }
    purchase.mutate(tier);
  };

  return (
    <div className="overflow-x-hidden">
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-14 text-center">
          <h1 className="select-none text-3xl font-black sm:text-5xl">اختر باقتك وانطلق في منظومة «المُنجِز»</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
            محرك البحث والظهور الداخلي يعتمد 100% على الكفاءة والتقييم الحقيقي لجميع المستخدمين بلا تمييز.
          </p>
          <p className="mx-auto mt-5 inline-flex max-w-2xl items-start gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs leading-relaxed text-accent">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" />
            فعّل باقتك مباشرة من رصيد المحفظة، أو اشحن المبلغ المتبقي بأمان عبر NOWPayments.
          </p>
        </div>
      </section>

      <Section title={tr("الباقات", "Plans")} subtitle={tr("الدفع بعملة USDT عبر TRC-20 أو BEP-20", "Pay in USDT via TRC-20 or BEP-20")}>
        <div className="grid gap-5 lg:grid-cols-3">
          {TIERS.map((t) => (
            <Card
              key={t.id}
              className={`flex h-full flex-col ${t.featured ? "border-primary/60 glow" : ""} ${t.premium ? "border-accent/50" : ""}`}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <h2 className="min-w-0 truncate text-lg font-black">{t.name}</h2>
                {currentTier === t.id && <span className="shrink-0 rounded-full border border-primary/50 bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">{tr("الحالية", "Current")}</span>}
                {t.featured && <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold text-primary">الأكثر طلباً</span>}
                {t.premium && <Crown className="size-4 shrink-0 text-accent" />}
              </div>

              <p className="mt-4 text-4xl font-black text-primary">
                {t.price} <span className="text-base font-bold text-muted-foreground">USDT{t.price > 0 ? " / شهرياً" : ""}</span>
              </p>

              <ul className="mt-5 grid flex-1 gap-2.5 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="min-w-0">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={currentTier === t.id || purchase.isPending}
                onClick={() => upgrade(t.id, t.price)}
                className={`mt-6 w-full rounded-xl py-3 text-sm font-bold transition-colors ${
                  currentTier === t.id
                    ? "cursor-not-allowed border border-border text-muted-foreground"
                    : t.premium
                      ? "bg-accent text-background hover:opacity-90"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                {purchase.isPending && t.id !== "free" ? <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" />{tr("جارٍ التفعيل...", "Activating...")}</span> : currentTier === t.id ? tr("الباقة الحالية", "Current plan") : t.cta}
              </button>
            </Card>
          ))}
        </div>

        <RedeemPassCard className="mt-8" />

        <Card className="mt-8 p-0">
          <button
            type="button"
            onClick={() => setOpenTable((v) => !v)}
            aria-expanded={openTable}
            className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5 text-right"
          >
            <span className="min-w-0 font-bold">جدول مقارنة المزايا التفصيلية</span>
            <ChevronDown className={`size-4 shrink-0 transition-transform ${openTable ? "rotate-180" : ""}`} />
          </button>
          {openTable && (
            <div className="w-full overflow-x-auto border-t border-border">
              <table className="w-full min-w-[650px] text-right text-xs">
                <thead className="bg-secondary/60 text-muted-foreground">
                  <tr>
                    {["الميزة", "المجانية", "المحترفين", "الشركات"].map((h, i) => (
                      <th
                        key={h}
                        className={`whitespace-nowrap px-4 py-3 font-semibold ${i === 0 ? "sticky start-0 z-10 bg-card" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["حد التخزين والرفع", "50MB", "500MB", "2GB"],
                    ["عمولة المنصة", "10% قياسية", "5% مخفضة", "2.5% الأدنى"],
                    ["مدة حجز الضمان", "36 ساعة", "12 ساعة", "6 ساعات"],
                    ["أدوات فرق العمل", "—", "—", "متكاملة"],
                    ["الدعم الفني", "قياسي", "أولوية", "مدير حساب مخصص"],
                  ].map((r) => (
                    <tr key={r[0]} className="border-t border-border">
                      <td className="sticky start-0 z-10 whitespace-nowrap bg-card px-4 py-3 font-semibold">{r[0]}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{r[1]}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-primary">{r[2]}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-accent">{r[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </Card>
      </Section>

      {topUp !== null && <TopUpDialog defaultAmount={topUp} onClose={() => setTopUp(null)} />}
    </div>
  );
}
