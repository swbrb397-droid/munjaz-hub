import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Filter, Loader2, Star, X } from "lucide-react";
import { useListing } from "@/lib/orders";
import { useLang as useLangCtx } from "@/lib/lang";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useListings, useNfts, type ListingCategory, type SortKey } from "@/lib/catalog";
import { NftCard, ServiceCard } from "./index";

export const Route = createFileRoute("/store")({
  head: () => ({
    meta: [
      { title: "المتجر الرقمي و NFT | الـمُـنْـجِـز" },
      { name: "description", content: "تصفح خدمات المستقلين، المنتجات الرقمية، الدورات، جلسات القيمنق، ومعرض NFT على منصة الـمُـنْـجِـز بعملة USDT." },
      { property: "og:title", content: "المتجر الرقمي و NFT | الـمُـنْـجِـز" },
      { property: "og:description", content: "فلترة كاملة للأصول الرقمية والدورات وخدمات المستقلين بعملة USDT." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    listingId: typeof search["listingId"] === "string" ? (search["listingId"] as string) : undefined,
    lang: search["lang"] === "en" || search["lang"] === "ar" ? (search["lang"] as "ar" | "en") : undefined,
  }),
  component: Store,
});

/** Deep-link quick view: /store?listingId=xyz&lang=ar opens the listing directly. */
function ListingDeepLink({ id, onClose }: { id: string; onClose: () => void }) {
  const { tr } = useLangCtx();
  const listing = useListing(id);
  const item = listing.data;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-background/85 p-4 backdrop-blur" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="min-w-0 truncate text-sm font-black">{tr("عرض مشارَك 🔗", "Shared listing 🔗")}</h2>
          <button type="button" onClick={onClose} aria-label={tr("إغلاق", "Close")} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border">
            <X className="size-4" />
          </button>
        </div>

        {listing.isLoading ? (
          <div className="grid place-items-center py-10"><Loader2 className="size-5 animate-spin text-primary" /></div>
        ) : !item ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{tr("العرض غير متاح أو تم حذفه.", "This listing is unavailable.")}</p>
        ) : (
          <>
            <div className="mt-4 h-32 overflow-hidden rounded-xl border border-border">
              <img src={item.cover} alt={item.title} className="size-full object-cover" width={768} height={512} />
            </div>
            <h3 className="mt-3 font-bold leading-snug">{item.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{item.seller}</p>
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Star className="size-3.5 fill-accent text-accent" /> {item.rating} · {item.orders} {tr("طلب", "orders")}
            </p>
            <p className="mt-3 text-lg font-black text-primary">{item.price} USDT</p>
            <Link
              to="/listing/$id"
              params={{ id }}
              onClick={onClose}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
            >
              {tr("فتح صفحة العرض كاملة", "Open full listing")} <ArrowLeft className="size-4" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function Store() {
  const { tr, lang, setLang } = useLang();
  const { listingId, lang: langParam } = Route.useSearch();
  const navigate = useNavigate();

  // Respect the language carried by the deep link without an extra redirect.
  useEffect(() => {
    if (langParam && langParam !== lang) setLang(langParam);
  }, [langParam, lang, setLang]);
  const [active, setActive] = useState<ListingCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const filters: { key: ListingCategory | "all"; label: string }[] = [
    { key: "all", label: tr("الكل", "All") },
    { key: "freelance", label: tr("خدمات مستقلين", "Freelance services") },
    { key: "course", label: tr("دورات", "Courses") },
    { key: "product", label: tr("منتجات رقمية", "Digital products") },
    { key: "gaming", label: tr("قيمنق", "Gaming") },
  ];

  const sorts: { key: SortKey; label: string }[] = [
    { key: "recent", label: tr("الأحدث", "Newest") },
    { key: "price_asc", label: tr("السعر: الأقل", "Price: low to high") },
    { key: "price_desc", label: tr("السعر: الأعلى", "Price: high to low") },
    { key: "rating", label: tr("الأعلى تقييماً", "Top rated") },
    { key: "popular", label: tr("الأكثر طلباً", "Most ordered") },
  ];

  const listings = useListings({ search: query, category: active, sort });
  const nfts = useNfts({ search: query, sort });

  return (
    <>
      {listingId && (
        <ListingDeepLink
          id={listingId}
          onClose={() => navigate({ to: "/store", search: (prev) => ({ ...prev, listingId: undefined }), replace: true })}
        />
      )}
      <Section title={tr("المتجر الرقمي", "Digital store")} subtitle={tr("كل شيء بسعر USDT مع ضمان المنصة", "Everything priced in USDT with platform protection")}>
        <Card className="mb-6 flex flex-wrap items-center gap-3">
          <Filter className="size-4 text-primary" />
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActive(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                active === f.key ? "bg-primary text-primary-foreground font-bold" : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="ms-auto rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            aria-label={tr("الفرز", "Sort")}
          >
            {sorts.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("ابحث عن خدمة...", "Search for a service...")}
            className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary sm:w-64"
          />
        </Card>

        {listings.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-primary" /></div>
        ) : listings.error ? (
          <p className="py-10 text-center text-muted-foreground">{tr("تعذّر تحميل الخدمات.", "Could not load services.")}</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(listings.data ?? []).map((s) => (
                <ServiceCard key={s.id} {...s} />
              ))}
            </div>
            {(listings.data ?? []).length === 0 && (
              <p className="py-10 text-center text-muted-foreground">{tr("لا توجد نتائج مطابقة.", "No matching results.")}</p>
            )}
          </>
        )}
      </Section>

      <Section title={tr("معرض NFT", "NFT gallery")} subtitle={tr("مجموعات موثقة قابلة للعرض والبيع", "Verified collections available to display and sell")}>
        {nfts.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(nfts.data ?? []).map((n) => (
                <NftCard key={n.id} {...n} />
              ))}
            </div>
            {(nfts.data ?? []).length === 0 && (
              <p className="py-10 text-center text-muted-foreground">{tr("لا توجد نتائج مطابقة.", "No matching results.")}</p>
            )}
          </>
        )}
      </Section>
    </>
  );
}
