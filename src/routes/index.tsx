import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, BadgeCheck, Gamepad2, ShieldCheck, Sparkle, Star, Zap } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useMock } from "@/lib/mock";
import { useListings, useNfts } from "@/lib/catalog";
import { useLang } from "@/lib/lang";
import { VerifiedBadge } from "@/components/site/VerifiedBadge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "مُنجَز | سوق الخدمات الرقمية بعملة USDT" },
      { name: "description", content: "منصة مُنجَز: خدمات مستقلين بضمان الوساطة، منتجات رقمية، دورات، جلسات قيمنق، ومعرض NFT — بمحفظة USDT داخلية بدون رسوم." },
      { property: "og:title", content: "مُنجَز | سوق الخدمات الرقمية بعملة USDT" },
      { property: "og:description", content: "ضمان ذكي، محفظة USDT داخلية، وتسويات نزاعات بالذكاء الاصطناعي." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { tr } = useLang();
  const { data: featured = [] } = useListings({ sort: "popular" });
  const { data: nfts = [] } = useNfts({ sort: "price_desc" });
  return (
    <>
      <Hero />
      <Ticker />
      <Section title={tr("خدمات مميزة", "Featured services")} subtitle={tr("بضمان الوساطة ومراحل تسليم موثقة", "With escrow protection and verified delivery milestones")} action={<Link to="/store" className="text-sm text-primary">{tr("تصفح الكل ←", "Browse all ←")}</Link>}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.slice(0, 4).map((s) => (
            <ServiceCard key={s.id} {...s} />
          ))}
        </div>
      </Section>

      <Section title={tr("منتجات رقمية ودورات", "Digital products & courses")} subtitle={tr("تسليم فوري وتشغيل داخل المنصة", "Instant delivery and in-platform access")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.filter((s) => s.category === "course" || s.category === "product").map((s) => (
            <ServiceCard key={s.id} {...s} />
          ))}
        </div>
      </Section>

      <Section title={tr("معرض NFT", "NFT gallery")} subtitle={tr("أصول رقمية موثقة على Polygon", "Verified digital assets on Polygon")} action={<Link to="/store" className="text-sm text-primary">{tr("المعرض الكامل ←", "Full gallery ←")}</Link>}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {nfts.slice(0, 3).map((n) => (
            <NftCard key={n.id} {...n} />
          ))}
        </div>
      </Section>


      <AffiliateCalculator />
    </>
  );
}

function Hero() {
  const { tr } = useLang();
  return (
    <div className="relative overflow-hidden border-b border-border">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkle className="size-3.5" /> {tr("ضمان ذكي + تسوية نزاعات بالذكاء الاصطناعي", "Smart escrow + AI dispute resolution")}
          </span>
          <h1 className="mt-5 text-4xl leading-tight font-black sm:text-6xl">
            {tr("سوق رقمي كامل يعمل بـ", "A full digital marketplace powered by")} <span className="neon-text">USDT</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            {tr(
              "خدمات مستقلين، منتجات فورية، دورات، جلسات قيمنق، و NFT — بمحفظة داخلية بدون رسوم غاز، وسحوبات فورية للحسابات الموثقة.",
              "Freelance services, instant products, courses, gaming sessions, and NFTs — with a gas-free internal wallet and instant withdrawals for verified accounts.",
            )}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/store" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground glow">
              {tr("ابدأ التصفح", "Start browsing")} <ArrowLeft className="size-4" />
            </Link>
            <Link to="/dashboard" className="rounded-xl border border-border px-5 py-3 font-semibold text-foreground hover:bg-secondary">
              {tr("لوحة التحكم", "Dashboard")}
            </Link>
          </div>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-4">
            {[
              { k: "12.4M", v: tr("حجم تداول USDT", "USDT trading volume") },
              { k: "48K", v: tr("طلب مكتمل", "orders completed") },
              { k: "0%", v: tr("رسوم داخلية", "internal fees") },
            ].map((s) => (
              <div key={s.v}>
                <p className="text-2xl font-black text-primary">{s.k}</p>
                <p className="text-xs text-muted-foreground">{s.v}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <Card className="glow">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-primary" />
              <div>
                <p className="font-bold">{tr("ضمان المراحل (Escrow)", "Milestone escrow")}</p>
                <p className="text-sm text-muted-foreground">{tr("تُجمَّد الأموال حتى اعتماد التسليم أو حكم الوكيل الذكي.", "Funds are held until delivery is approved or the AI agent rules.")}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <Zap className="size-5 text-accent" />
              <div>
                <p className="font-bold">{tr("سحب فوري للموثقين", "Instant withdrawal for verified users")}</p>
                <p className="text-sm text-muted-foreground">TRC-20 · BEP-20 · Polygon {tr("برسوم مصغّرة", "with minimal fees")}.</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <Gamepad2 className="size-5 text-violet" />
              <div>
                <p className="font-bold">{tr("مركز القيمنق والتدريب", "Gaming & coaching hub")}</p>
                <p className="text-sm text-muted-foreground">{tr("حجز جلسات مباشرة مع مدربين محترفين.", "Book live sessions with professional coaches.")}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Ticker() {
  const { tickers } = useMock();
  return (
    <div className="overflow-hidden border-b border-border bg-surface/60 py-3">
      <div className="flex gap-8 whitespace-nowrap px-4 text-sm">
        {[...tickers, ...tickers].map((t, i) => (
          <span key={i} className="flex items-center gap-2 text-muted-foreground">
            <span className="font-semibold text-foreground">{t.pair}</span>
            <span className="text-primary">{t.value}</span>
            <span className="text-xs">{t.change}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function ServiceCard({
  id, title, seller, price, rating, orders, verified, tag, cover,
}: { id: string; title: string; seller: string; price: number; rating: number; orders: number; verified: boolean; tag: string; cover: string; category?: string }) {
  const { tr } = useLang();
  return (
    <Link to="/listing/$id" params={{ id }} className="block">
      <Card className="flex h-full flex-col transition-colors hover:border-primary/50">
        <div className="relative mb-4 h-28 overflow-hidden rounded-xl border border-border">
          <img src={cover} alt={title} loading="lazy" width={768} height={512} className="size-full object-cover" />
          <span className="absolute bottom-2 start-2 rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-semibold text-foreground backdrop-blur">
            {tag}
          </span>
        </div>
        <h3 className="mt-1 font-bold leading-snug">{title}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          {seller} {verified && <VerifiedBadge />}
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Star className="size-3.5 fill-accent text-accent" /> {rating} · {orders} {tr("طلب", "orders")}
        </div>
        <p className="mt-4 text-lg font-black text-primary">{price} USDT</p>
      </Card>
    </Link>
  );
}

export function NftCard({ name, collection, price, hue }: { name: string; collection: string; price: number; hue: number }) {
  return (
    <Card className="transition-transform hover:-translate-y-1">
      <div
        className="h-44 rounded-xl"
        style={{ background: `radial-gradient(circle at 30% 25%, oklch(0.8 0.18 ${hue}), oklch(0.25 0.08 ${hue + 40}))` }}
      />
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{collection}</p>
          <p className="font-bold">{name}</p>
        </div>
        <p className="font-black text-primary">{price} USDT</p>
      </div>
    </Card>
  );
}

function AffiliateCalculator() {
  const { tr } = useLang();
  const [referrals, setReferrals] = useState(25);
  const [avgSpend, setAvgSpend] = useState(400);
  const share = 0.18;
  const commission = 0.1;
  const monthly = referrals * avgSpend * commission * share;

  return (
    <Section title={tr("حاسبة برنامج الإحالة", "Referral program calculator")} subtitle={tr("احصل على 15–20% من صافي عمولة المنصة لمدة 12 شهراً لكل مُحال", "Earn 15–20% of net platform commission for 12 months per referral")}>
      <Card className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-6">
          <label className="grid gap-2">
            <span className="flex justify-between text-sm"><span>{tr("عدد المُحالين", "Number of referrals")}</span><span className="font-bold text-primary">{referrals}</span></span>
            <input type="range" min={1} max={300} value={referrals} onChange={(e) => setReferrals(Number(e.target.value))} className="accent-[oklch(0.76_0.17_165)]" />
          </label>
          <label className="grid gap-2">
            <span className="flex justify-between text-sm"><span>{tr("متوسط إنفاق المُحال شهرياً (USDT)", "Average referral monthly spend (USDT)")}</span><span className="font-bold text-primary">{avgSpend}</span></span>
            <input type="range" min={50} max={3000} step={50} value={avgSpend} onChange={(e) => setAvgSpend(Number(e.target.value))} className="accent-[oklch(0.76_0.17_165)]" />
          </label>
        </div>
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-5 text-center">
          <p className="text-sm text-muted-foreground">{tr("دخلك الشهري التقديري", "Your estimated monthly income")}</p>
          <p className="mt-2 text-4xl font-black text-primary">{monthly.toFixed(0)}</p>
          <p className="text-sm text-muted-foreground">USDT / {tr("شهر", "month")}</p>
          <p className="mt-4 text-xs text-muted-foreground">≈ {(monthly * 12).toFixed(0)} USDT {tr("خلال 12 شهراً", "over 12 months")}</p>
        </div>
      </Card>
    </Section>
  );
}
