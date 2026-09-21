import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, ShieldCheck, Star, Timer } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { VerifiedBadge } from "@/components/site/VerifiedBadge";
import { MediaShowcase } from "@/components/site/MediaShowcase";
import { DmcaTrigger } from "@/components/site/DmcaModal";
import { CoverImage } from "@/components/site/CoverImage";

import { useLang } from "@/lib/lang";
import { sanitizeText } from "@/lib/security";
import { useAuth } from "@/hooks/use-auth";
import { useWallet } from "@/lib/queries";
import { useCreateOrder, useListing } from "@/lib/orders";
import { isInstantCategory } from "@/lib/instant-delivery";
import { supabase } from "@/lib/cloud-client";
import { TopUpDialog } from "@/components/site/TopUpDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/listing/$id")({
  head: () => ({
    meta: [
      { title: "تفاصيل العرض | المنجز" },
      { name: "description", content: "تفاصيل الخدمة أو المنتج الرقمي على المنجز: السعر بعملة USDT، مدة التسليم، نطاق العمل، وشراء محمي بضمان الوساطة." },
      { property: "og:title", content: "تفاصيل العرض | المنجز" },
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

  const [sow, setSow] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [topUp, setTopUp] = useState(false);

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

  const price = Number.isFinite(Number(item.price)) ? Number(item.price) : 0;
  const feeRate = item.feeRate ?? 0.10;
  const feePct = Math.round(feeRate * 1000) / 10; // e.g. 10, 5, 2.5
  const fee = Number((price * feeRate).toFixed(2));
  const sellerNet = Number((price - fee).toFixed(2));
  const balance = Number(wallet.data?.available_usdt ?? 0);
  const isOwner = !!user && item.ownerId === user.id;
  const deliveryDays = Number(item.deliveryDays ?? 3);

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
    // Wallet gate: block unfunded orders before touching the orders table.
    if (balance < price) {
      toast.error(tr("رصيدك غير كافٍ لإتمام الطلب. يرجى شحن المحفظة أولاً", "Insufficient balance. Please top up your wallet first"));
      setTopUp(true);
      return;
    }
    try {
      const created = await createOrder.mutateAsync({
        listingId: item!.id,
        sellerId: item!.ownerId,
        title: item!.title,
        category: item!.category,
        amount: item!.price,
        deliveryDays: deliveryDays,
        sowTerms: sow.trim(),
      });
      // Instant digital fulfilment: settle the order immediately (seller is paid
      // net of the platform fee by the escrow trigger) and hand over the content.
      if (isInstantCategory(item!.category) && created?.id) {
        const settled = await supabase.from("orders").update({ status: "completed" }).eq("id", created.id);
        if (settled.error) throw new Error(settled.error.message);
        navigate({ to: "/fulfillment/$orderId", params: { orderId: created.id } });
        return;
      }
      navigate({ to: "/workspace" });
    } catch (e) {
      const message = (e as Error).message;
      if (message === "INSUFFICIENT_BALANCE") {
        toast.error(tr("رصيدك غير كافٍ لإتمام الطلب. يرجى شحن المحفظة أولاً", "Insufficient balance. Please top up your wallet first"));
        setTopUp(true);
      }
      setError(message);
    }
  }

  // Never render raw seller-supplied strings; fall back to a localized label.
  const safeTitle = sanitizeText(item.title ?? "", 160) || tr("عرض بدون عنوان", "Untitled listing");
  const safeSeller = sanitizeText(item.seller ?? "", 80) || tr("بائع موثّق", "Verified seller");
  const safeTag = sanitizeText(item.tag ?? "", 60) || tr("خدمة رقمية", "Digital service");

  return (
    <Section
      title={safeTitle}
      subtitle={`${safeSeller} · ${safeTag}`}
      action={<Link to="/store" className="inline-flex items-center gap-2 text-sm text-primary">{tr("كل العروض", "All listings")} <ArrowLeft className="size-4" /></Link>}
    >
      <div className="grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
        <Card>
          <div className="overflow-hidden rounded-xl border border-border">
            <CoverImage src={item.cover} alt={item.title} category={item.category} className="h-64 w-full" iconClassName="size-12" />
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
              { icon: Timer, t: tr("تحرير تلقائي", "Auto-release"), s: tr("خلال 48 ساعة من التسليم (الباقة المجانية)", "48 hours after delivery (Free tier)") },
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

          <MediaShowcase
            items={[{ id: "cover", src: item.cover, title: tr("غلاف الخدمة", "Service cover"), format: "image", category: item.category }]}
          />
        </Card>


        <div className="grid content-start gap-4">
          <Card>
            <p className="text-3xl font-black text-primary">{price.toFixed(2)} USDT</p>
            {/* Delivery time is fixed by the seller — read-only, never focusable. */}
            <div className="mt-4 flex items-center justify-between rounded-lg border border-border/40 bg-card/50 p-3 text-sm">
              <span className="text-muted-foreground">{tr("مدة التسليم المحددة", "Set delivery time")}</span>
              <span className="font-semibold text-foreground">
                <bdi>{deliveryDays} {tr("أيام", "days")}</bdi>
              </span>
            </div>

            <dl className="mt-4 grid gap-1 border-t border-border pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">{tr("مبلغ الضمان", "Escrow amount")}</dt><dd><bdi>{price.toFixed(2)} USDT</bdi></dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{tr(`عمولة المنصة (${feePct}%)`, `Platform fee (${feePct}%)`)}</dt><dd><bdi>{fee.toFixed(2)} USDT</bdi></dd></div>
              <div className="flex justify-between font-bold"><dt>{tr("صافي البائع", "Seller net")}</dt><dd className="text-primary"><bdi>{sellerNet.toFixed(2)} USDT</bdi></dd></div>
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
            {error && (
              <p className="mt-3 text-xs text-destructive">
                {error === "INSUFFICIENT_BALANCE"
                  ? tr("رصيدك غير كافٍ لإتمام الطلب. يرجى شحن المحفظة أولاً", "Insufficient balance. Please top up your wallet first")
                  : error}
              </p>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">
              {tr("عند الطلب يُخصم المبلغ من رصيدك ويُجمَّد في الضمان فوراً حتى اعتماد التسليم.", "On order the amount is deducted from your balance and locked in escrow until delivery is approved.")}
            </p>
            <div className="mt-3">
              <DmcaTrigger />
            </div>
          </Card>
        </div>
      </div>
      {topUp && <TopUpDialog onClose={() => setTopUp(false)} defaultAmount={Math.max(0, Number((price - balance).toFixed(2)))} />}
    </Section>
  );
}
