import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Copy, Crown, Loader2, QrCode, Sparkles, X } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "باقات الاشتراك والمقاعد | الـمُـنْـجِـز" },
      { name: "description", content: "باقات المجانية والمحترفين والشركات بعملة USDT — مقاعد محدودة، حجز فوري، وتسريع دورة الضمان." },
      { property: "og:title", content: "باقات الاشتراك والمقاعد | الـمُـنْـجِـز" },
      { property: "og:description", content: "10 USDT للمحترفين و49 USDT للشركات — الظهور يعتمد على الكفاءة فقط." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

type TierId = "free" | "pro" | "corp";

const WALLETS: Record<"TRC-20" | "BEP-20", string> = {
  "TRC-20": "TJmunjazPro492xKq7Yb3Zn8Rf5Tc2Wd6La",
  "BEP-20": "0x9F42Ae1Cd73B8e05aF16D2c48b3E7a90C51D2B84",
};

const TIERS: Array<{
  id: TierId;
  name: string;
  price: number;
  featured?: boolean;
  premium?: boolean;
  seats?: { left: number; total: number };
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
    seats: { left: 842, total: 1000 },
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
    id: "corp",
    name: "باقة الشركات",
    price: 49,
    premium: true,
    seats: { left: 67, total: 100 },
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
  const [checkout, setCheckout] = useState<TierId | null>(null);
  const [openTable, setOpenTable] = useState(false);

  const active = useMemo(() => TIERS.find((t) => t.id === checkout) ?? null, [checkout]);

  return (
    <div className="overflow-x-hidden">
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-14 text-center">
          <h1 className="text-3xl font-black sm:text-5xl">اختر باقتك وانطلق في منظومة «الـمُـنْـجِـز»</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
            محرك البحث والظهور الداخلي يعتمد 100% على الكفاءة والتقييم الحقيقي لجميع المستخدمين بلا تمييز.
          </p>
          <p className="mx-auto mt-5 inline-flex max-w-2xl items-start gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs leading-relaxed text-accent">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" />
            المقاعد الاحترافية ومقاعد الشركات محدودة ويتم اعتماد الحجز التلقائي بأسبقية اكتمال الدفع عبر شبكة USDT.
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
                {t.featured && <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold text-primary">الأكثر طلباً</span>}
                {t.premium && <Crown className="size-4 shrink-0 text-accent" />}
              </div>

              <p className="mt-4 text-4xl font-black text-primary">
                {t.price} <span className="text-base font-bold text-muted-foreground">USDT{t.price > 0 ? " / شهرياً" : ""}</span>
              </p>

              {t.seats && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{`المتبقي: ${t.seats.left} / ${t.seats.total} مقعد`}</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full ${t.premium ? "bg-accent" : "bg-primary"}`}
                      style={{ width: `${(t.seats.left / t.seats.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

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
                disabled={t.id === "free"}
                onClick={() => setCheckout(t.id)}
                className={`mt-6 w-full rounded-xl py-3 text-sm font-bold transition-colors ${
                  t.id === "free"
                    ? "cursor-not-allowed border border-border text-muted-foreground"
                    : t.premium
                      ? "bg-accent text-background hover:opacity-90"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                {t.cta}
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

      {active && <CheckoutModal name={active.name} price={active.price} onClose={() => setCheckout(null)} />}
    </div>
  );
}

function CheckoutModal({ name, price, onClose }: { name: string; price: number; onClose: () => void }) {
  const { tr } = useLang();
  const [network, setNetwork] = useState<"TRC-20" | "BEP-20">("TRC-20");
  const [left, setLeft] = useState(15 * 60);

  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [left]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const expired = left === 0;
  const address = WALLETS[network];

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success(tr("تم نسخ عنوان المحفظة", "Wallet address copied"));
    } catch {
      toast.error(tr("تعذّر النسخ", "Copy failed"));
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-background/80 p-4 backdrop-blur" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="min-w-0 truncate text-lg font-black">{name} — {price} USDT</h2>
          <button type="button" onClick={onClose} aria-label={tr("إغلاق", "Close")} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border">
            <X className="size-4" />
          </button>
        </div>

        {expired ? (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-center">
            <p className="text-sm font-bold text-destructive">انتهت مهلة الحجز</p>
            <button
              type="button"
              onClick={() => setLeft(15 * 60)}
              className="mt-3 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              تجديد الحجز
            </button>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-accent/40 bg-accent/10 p-3 text-center text-xs font-semibold text-accent">
            {`المقعد محجوز لك مؤقتاً لمدة ${mm}:${ss} دقيقة. يرجى إتمام التحويل قبل انتهاء المهلة.`}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["TRC-20", "BEP-20"] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNetwork(n)}
              className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                network === n ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="mt-4 grid place-items-center rounded-xl border border-border bg-secondary/40 p-6">
          <QrCode className="size-24 text-muted-foreground" />
          <p className="mt-2 text-[10px] text-muted-foreground">{tr("امسح رمز QR للدفع", "Scan the QR code to pay")}</p>
        </div>

        <p className="mt-4 text-xs font-semibold">{tr("عنوان محفظة الإيداع", "Deposit wallet address")}</p>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input readOnly dir="ltr" value={address} className="min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-[11px] text-muted-foreground" />
          <button type="button" onClick={copyAddress} className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground" aria-label={tr("نسخ", "Copy")}>
            <Copy className="size-4" />
          </button>
        </div>

        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> بانتظار تأكيد الشبكة...
        </p>
      </div>
    </div>
  );
}
