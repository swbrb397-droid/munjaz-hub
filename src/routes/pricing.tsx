import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronDown, Crown, Loader2, Sparkles } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";

import { TopUpDialog } from "@/components/site/TopUpDialog";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useWallet } from "@/lib/queries";
import { supabase } from "@/lib/cloud-client";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "باقات الاشتراك | المنجز" },
      { name: "description", content: "باقات المجانية والمحترفين والشركات بعملة USDT مع مزايا واضحة وتسريع دورة الضمان." },
      { property: "og:title", content: "باقات الاشتراك | المنجز" },
      { property: "og:description", content: "10 USDT للمحترفين و49 USDT للشركات — الظهور يعتمد على الكفاءة فقط." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

type TierId = "free" | "pro" | "corporate";

type Bi = [string, string];

const TIERS: Array<{
  id: TierId;
  name: Bi;
  price: number;
  featured?: boolean;
  premium?: boolean;
  cta: Bi;
  features: Bi[];
}> = [
  {
    id: "free",
    name: ["الباقة المجانية", "Free Tier"],
    price: 0,
    cta: ["باقتك الحالية", "Your current plan"],
    features: [
      ["عمولة المنصة: 10% قياسية", "Platform commission: standard 10%"],
      ["حجز أمان الضمان (Escrow) لمدة 48 ساعة", "Escrow hold period: 48 hours"],
      ["حد رفع الملفات 50MB", "File upload limit: 50MB"],
      ["رابط إحالة مالي قياسي لمدة 12 شهراً", "Standard referral link valid for 12 months"],
      [
        "أولوية متساوية في محرك البحث تعتمد على الكفاءة",
        "Equal search visibility based purely on performance",
      ],
    ],
  },
  {
    id: "pro",
    name: ["باقة المحترفين", "Pro Tier"],
    price: 10,
    featured: true,
    cta: ["ترقية إلى Pro الآن", "Upgrade to Pro now"],
    features: [
      ["عمولة المنصة: 5% مخفضة فقط", "Platform commission: reduced 5%"],
      [
        "تقليص حجز الضمان إلى 24 ساعة (مع توثيق KYC)",
        "Escrow hold reduced to 24 hours (with verified KYC)",
      ],
      ["رفع ملفات حتى 500MB", "File uploads up to 500MB"],
      [
        "شارة «بائع Pro موثق» (دون التأثير على خوارزمية جدارة البحث)",
        "“Verified Pro Seller” badge (search ranking stays merit-based)",
      ],
      ["دعم فني ذو أولوية", "Priority technical support"],
    ],
  },
  {
    id: "corporate",
    name: ["باقة الشركات", "Corporate Tier"],
    price: 49,
    premium: true,
    cta: ["حجز مقعد الشركات", "Reserve a corporate seat"],
    features: [
      ["عمولة المنصة: 2.5% أدنى عمولة في المنصة", "Platform commission: lowest at 2.5%"],
      [
        "تسريع دورة الضمان إلى 12–16 ساعة (بموافقة المشتري)",
        "Escrow hold accelerated to 12–16 hours (with buyer approval)",
      ],
      [
        "رفع مشاريع وسائط حتى 2GB عبر التخزين السحابي المباشر",
        "Media projects up to 2GB via direct cloud storage",
      ],
      ["شارة «حساب شركات معتمد»", "“Certified Corporate Account” badge"],
      [
        "مدير حساب مخصص وأدوات إدارة فرق العمل",
        "Dedicated account manager and team management tools",
      ],
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
          <h1 className="select-none text-3xl font-black sm:text-5xl">
            {tr("اختر باقتك وانطلق في منظومة المنجز", "Choose your plan and grow with Al-Munjaz")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {tr(
              "محرك البحث والظهور الداخلي يعتمد 100% على الكفاءة والتقييم الحقيقي لجميع المستخدمين بلا تمييز.",
              "Search visibility is based 100% on real performance and ratings, equally for every user.",
            )}
          </p>
          <p className="mx-auto mt-5 inline-flex max-w-2xl items-start gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs leading-relaxed text-accent">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" />
            {tr(
              "فعّل باقتك مباشرة من رصيد المحفظة، أو اشحن المبلغ المتبقي بأمان عبر NOWPayments.",
              "Activate your plan straight from your wallet balance, or top up the remainder securely.",
            )}
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
                <h2 className="min-w-0 truncate text-lg font-black">{tr(t.name[0], t.name[1])}</h2>
                {currentTier === t.id && <span className="shrink-0 rounded-full border border-primary/50 bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">{tr("الحالية", "Current")}</span>}
                {t.featured && <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold text-primary">{tr("الأكثر طلباً", "Most popular")}</span>}
                {t.premium && <Crown className="size-4 shrink-0 text-accent" />}
              </div>

              <p className="mt-4 text-4xl font-black text-primary">
                {t.price} <span className="text-base font-bold text-muted-foreground">USDT{t.price > 0 ? tr(" / شهرياً", " / month") : ""}</span>
              </p>

              <ul className="mt-5 grid flex-1 gap-2.5 text-sm">
                {t.features.map((f) => (
                  <li key={f[0]} className="flex items-start gap-2 text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="min-w-0">{tr(f[0], f[1])}</span>
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
                {purchase.isPending && t.id !== "free" ? <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" />{tr("جارٍ التفعيل...", "Activating...")}</span> : currentTier === t.id ? tr("الباقة الحالية", "Current plan") : tr(t.cta[0], t.cta[1])}
              </button>
            </Card>
          ))}
        </div>

        

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
              <table className="w-full min-w-[620px] text-right text-xs">
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
                    ["مدة حجز الضمان", "48 ساعة", "24 ساعة (مع KYC)", "12–16 ساعة"],
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
