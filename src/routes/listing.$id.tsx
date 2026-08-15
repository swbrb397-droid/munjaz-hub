import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, ShieldCheck, Star, Timer } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { VerifiedBadge } from "@/components/site/VerifiedBadge";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { useWallet } from "@/lib/queries";
import { useCreateOrder, useListing } from "@/lib/orders";

export const Route = createFileRoute("/listing/$id")({
  head: () => ({
    meta: [
      { title: "تفاصيل العرض | المُنجَز" },
      { name: "description", content: "تفاصيل الخدمة أو المنتج الرقمي على المُنجَز: السعر بعملة USDT، مدة التسليم، نطاق العمل، وشراء محمي بضمان الوساطة." },
      { property: "og:title", content: "تفاصيل العرض | المُنجَز" },
      { property: "og:description", content: "اشترِ بضمان الوساطة USDT مع تحرير تلقائي بعد اعتماد التسليم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ListingDetail,
});

function ListingDetail() {
  const { id } = Route.useParams();
  const { tr } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const listing = useListing(id);
  const wallet = useWallet();
  const createOrder = useCreateOrder();

  const [days, setDays] = useState(3);
  const [sow, setSow] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (listing.isLoading) {
    return (
      <Section title={tr("جارٍ التحميل", "Loading")}>
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-primary" /></div>
      </Section>
    );
  }

  const item = listing.data;
  if (!item) {
    return (
      <Section title={tr("العرض غير متاح", "Listing unavailable")} subtitle={tr("قد يكون محذوفاً أو غير منشور.", "It may be deleted or unpublished.")}>
        <Link to="/store" className="text-primary">{tr("العودة للمتجر", "Back to store")}</Link>
      </Section>
    );
  }

  const fee = Number((item.price * 0.1).toFixed(2));
  const balance = Number(wallet.data?.available_usdt ?? 0);
  const isOwner = !!user && item.ownerId === user.id;

  async function buy() {
    setError(null);
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (!item!.ownerId) {
      setError(tr("هذا العرض بدون بائع مرتبط ولا يمكن شراؤه.", "This listing has no linked seller and cannot be purchased."));
      return;
    }
    try {
      await createOrder.mutateAsync({
        listingId: item!.id,
        sellerId: item!.ownerId,
        title: item!.title,
        category: item!.category,
        amount: item!.price,
        deliveryDays: days,
        sowTerms: sow.trim(),
      });
      navigate({ to: "/workspace" });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Section
      title={item.title}
      subtitle={`${item.seller} · ${item.tag}`}
      action={<Link to="/store" className="inline-flex items-center gap-2 text-sm text-primary">{tr("كل العروض", "All listings")} <ArrowLeft className="size-4" /></Link>}
    >
      <div className="grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
        <Card>
          <div className="overflow-hidden rounded-xl border border-border">
            <img src={item.cover} alt={item.title} width={1024} height={512} className="h-64 w-full object-cover" />
          </div>
          <h1 className="mt-5 text-2xl font-black">{item.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {item.seller} {item.verified && <VerifiedBadge />}
            <span className="inline-flex items-center gap-1"><Star className="size-3.5 fill-accent text-accent" /> {item.rating}</span>
            <span>· {item.orders} {tr("طلب", "orders")}</span>
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, t: tr("ضمان وساطة", "Escrow protected"), s: tr("تُجمَّد الأموال حتى الاعتماد", "Funds held until approval") },
              { icon: Timer, t: tr("تحرير تلقائي", "Auto-release"), s: tr("خلال 72 ساعة من التسليم", "72 hours after delivery") },
              { icon: Star, t: tr("جودة موثقة", "Verified quality"), s: tr("تقييمات محمية ضد الابتزاز", "Ratings protected from blackmail") },
            ].map((b) => (
              <div key={b.t} className="rounded-xl border border-border p-3">
                <b.icon className="size-4 text-primary" />
                <p className="mt-2 text-sm font-bold">{b.t}</p>
                <p className="text-xs text-muted-foreground">{b.s}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-8 text-lg font-bold">{tr("نطاق العمل (SOW)", "Statement of work (SOW)")}</h2>
          <textarea
            value={sow}
            onChange={(e) => setSow(e.target.value)}
            rows={5}
            placeholder={tr("اكتب متطلباتك بدقة: المخرجات، الصيغ، عدد التعديلات...", "Describe your requirements: deliverables, formats, revisions...")}
            className="mt-3 w-full rounded-xl border border-input bg-surface p-3 text-sm outline-none focus:border-primary"
          />
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <p className="text-3xl font-black text-primary">{item.price} USDT</p>
            <div className="mt-4 grid gap-2 text-sm">
              <label className="text-xs text-muted-foreground" htmlFor="days">{tr("مدة التسليم (أيام)", "Delivery time (days)")}</label>
              <input
                id="days"
                type="number"
                min={1}
                max={60}
                value={days}
                onChange={(e) => setDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary"
              />
            </div>

            <dl className="mt-4 grid gap-1 border-t border-border pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">{tr("مبلغ الضمان", "Escrow amount")}</dt><dd>{item.price} USDT</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{tr("عمولة المنصة (10%)", "Platform fee (10%)")}</dt><dd>{fee} USDT</dd></div>
              <div className="flex justify-between font-bold"><dt>{tr("صافي البائع", "Seller net")}</dt><dd className="text-primary">{(item.price - fee).toFixed(2)} USDT</dd></div>
            </dl>

            {user && (
              <p className="mt-3 text-xs text-muted-foreground">
                {tr("رصيدك المتاح", "Your available balance")}: <span className={balance >= item.price ? "text-primary" : "text-destructive"}>{balance.toFixed(2)} USDT</span>
              </p>
            )}

            <button
              onClick={buy}
              disabled={createOrder.isPending || isOwner}
              className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground glow disabled:opacity-50"
            >
              {createOrder.isPending
                ? tr("جارٍ إنشاء الطلب...", "Creating order...")
                : isOwner
                  ? tr("هذا عرضك", "This is your listing")
                  : user
                    ? tr("اطلب الآن بضمان الوساطة", "Order now with escrow")
                    : tr("سجّل الدخول للطلب", "Sign in to order")}
            </button>
            {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
            <p className="mt-3 text-[11px] text-muted-foreground">
              {tr("يُنشأ الطلب بحالة (قيد الانتظار)، ثم تموّله من مساحة الطلب لتجميد المبلغ في الضمان.", "The order is created as pending; fund it from the workspace to lock the amount in escrow.")}
            </p>
          </Card>
        </div>
      </div>
    </Section>
  );
}
