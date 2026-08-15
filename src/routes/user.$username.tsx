import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, BadgeCheck, CalendarDays, Clock3, MapPin, Star, TrendingUp, Trophy } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { findSeller, type SellerListing, type SellerListingKind } from "@/lib/sellers";

export const Route = createFileRoute("/user/$username")({
  loader: ({ params }) => {
    const seller = findSeller(params.username);
    if (!seller) throw notFound();
    return { seller };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "الملف غير متاح | الـمُـنْـجِـز" }, { name: "robots", content: "noindex" }] };
    }
    const s = loaderData.seller;
    return {
      meta: [
        { title: `${s.name_ar} — ملف البائع | الـمُـنْـجِـز` },
        { name: "description", content: s.bio_ar.slice(0, 150) },
        { property: "og:title", content: `${s.name_ar} — ملف البائع | الـمُـنْـجِـز` },
        { property: "og:description", content: s.bio_en.slice(0, 150) },
        { property: "og:type", content: "profile" },
        { property: "og:image", content: s.cover_url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: s.cover_url },
      ],
    };
  },
  notFoundComponent: SellerNotFound,
  component: SellerProfilePage,
});

function SellerNotFound() {
  const { tr } = useLang();
  return (
    <Section title={tr("البائع غير موجود", "Seller not found")}>
      <Card>
        <p className="text-muted-foreground">{tr("تعذّر العثور على هذا الملف الشخصي.", "We couldn't find this profile.")}</p>
        <Link to="/leaderboard" className="mt-4 inline-flex items-center gap-2 text-sm text-primary">
          <ArrowLeft className="size-4" /> {tr("لوحة المتصدرين", "Leaderboard")}
        </Link>
      </Card>
    </Section>
  );
}

function SellerProfilePage() {
  const { seller } = Route.useLoaderData();
  const { lang, tr } = useLang();
  const [tab, setTab] = useState<SellerListingKind | "all">("all");

  const name = lang === "ar" ? seller.name_ar : seller.name_en;
  const tabs: { key: SellerListingKind | "all"; label: string }[] = [
    { key: "all", label: tr("الكل", "All") },
    { key: "service", label: tr("خدمات رقمية", "Digital services") },
    { key: "course", label: tr("دورات تدريبية", "Training courses") },
    { key: "nft", label: tr("أصول NFT", "NFT assets") },
  ];
  const listings = tab === "all" ? seller.listings : seller.listings.filter((l) => l.kind === tab);

  const stats = [
    { icon: Star, label: tr("التقييم", "Rating"), value: seller.total_rating.toFixed(2) },
    { icon: TrendingUp, label: tr("نسبة الإنجاز", "Completion rate"), value: `${seller.completion_rate.toFixed(1)}%` },
    { icon: Trophy, label: tr("المبيعات", "Total sales"), value: seller.total_sales.toLocaleString("en-US") },
    { icon: Clock3, label: tr("زمن الرد", "Response time"), value: `${seller.response_minutes} ${tr("د", "min")}` },
  ];

  return (
    <>
      <div className="relative h-44 overflow-hidden border-b border-border sm:h-60">
        <img src={seller.cover_url} alt="" loading="lazy" className="size-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>

      <Section title="" subtitle="">
        <Card className="-mt-16 flex flex-wrap items-center gap-5">
          <img
            src={seller.avatar_url}
            alt={name}
            className="size-20 rounded-2xl border border-border object-cover sm:size-24"
          />
          <div className="min-w-52 flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-black">
              {name}
              {seller.verified && <BadgeCheck className="size-5 text-accent" />}
            </h1>
            <p className="text-sm text-muted-foreground">{lang === "ar" ? seller.headline_ar : seller.headline_en}</p>
            <p className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {lang === "ar" ? seller.country_ar : seller.country_en}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" /> {tr("عضو منذ", "Member since")} {seller.member_since}
              </span>
              <span className="font-mono">@{seller.username}</span>
            </p>
          </div>
          <Link to="/store" className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground glow">
            {tr("تصفح خدماته", "Browse listings")}
          </Link>
        </Card>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <s.icon className="size-5 text-primary" />
              <p className="mt-3 text-2xl font-black">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </Card>
          ))}
        </div>

        <Card className="mt-6">
          <h2 className="font-bold">{tr("نبذة", "Bio")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {lang === "ar" ? seller.bio_ar : seller.bio_en}
          </p>
        </Card>
      </Section>

      <Section title={tr("العروض النشطة", "Active listings")} subtitle={tr("خدمات رقمية، دورات تدريبية، وأصول NFT", "Digital services, training courses, and NFT assets")}>
        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                tab === t.key
                  ? "bg-primary font-bold text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
        {listings.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">{tr("لا توجد عروض في هذا القسم.", "No listings in this category.")}</p>
        )}
      </Section>
    </>
  );
}

function ListingCard({ listing }: { listing: SellerListing }) {
  const { lang, tr } = useLang();
  const kindLabel: Record<SellerListingKind, string> = {
    service: tr("خدمة رقمية", "Digital service"),
    course: tr("دورة تدريبية", "Training course"),
    nft: tr("أصل NFT", "NFT asset"),
  };
  return (
    <Card className="overflow-hidden p-0">
      <img
        src={listing.thumbnail_url}
        alt={lang === "ar" ? listing.title_ar : listing.title_en}
        loading="lazy"
        className="h-40 w-full object-cover"
      />
      <div className="p-4">
        <span className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
          {kindLabel[listing.kind]}
        </span>
        <h3 className="mt-2 font-bold">{lang === "ar" ? listing.title_ar : listing.title_en}</h3>
        <p className="mt-2 font-black text-primary">{listing.price_usdt} USDT</p>
      </div>
    </Card>
  );
}
