import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Filter, Loader2, Star, X } from "lucide-react";
import { useListing } from "@/lib/orders";
import { useLang as useLangCtx } from "@/lib/lang";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { PAGE_SIZE, useListings, useNfts, type ListingCategory, type SortKey } from "@/lib/catalog";
import { NftCard, ServiceCard } from "./index";

type StoreSearch = { listingId?: string; lang?: "ar" | "en" };

export const Route = createFileRoute("/store")({
  head: () => ({
    meta: [
      { title: "المتجر الرقمي و NFT | الـمُـنْـجِـز" },
      { name: "description", content: "تصفح خدمات المستقلين، المنتجات الرقمية، الدورات، جلسات القيمنق، ومعرض NFT على منصة الـمُـنْـجِـز بعملة USDT." },
      { property: "og:title", content: "المتجر الرقمي و NFT | الـمُـنْـجِـز" },
      { property: "og:description", content: "فلترة كاملة للأصول الرقمية والدورات وخدمات المستقلين بعملة USDT." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): StoreSearch => {
    const out: StoreSearch = {};
    if (typeof search["listingId"] === "string" && search["listingId"]) out.listingId = search["listingId"];
    if (search["lang"] === "en" || search["lang"] === "ar") out.lang = search["lang"];
    return out;
  },
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
  const [maxPrice, setMaxPrice] = useState(2000);
  const [contentLang, setContentLang] = useState<"all" | "ar" | "en">("all");
  const [delivery, setDelivery] = useState(0);
  const [page, setPage] = useState(1);

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

  const listings = useListings({
    search: query,
    category: active,
    sort,
    maxPrice,
    language: contentLang,
    maxDeliveryDays: delivery,
    page,
    pageSize: PAGE_SIZE,
  });
  const nfts = useNfts({ search: query, sort });

  const total = listings.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = listings.data?.items ?? [];

  return (
    <>
      {listingId && (
        <ListingDeepLink
          id={listingId}
          onClose={() => navigate({ to: "/store", search: (prev) => (prev.lang ? { lang: prev.lang } : {}), replace: true })}
        />
      )}
      <Section title={tr("المتجر الرقمي", "Digital store")} subtitle={tr("كل شيء بسعر USDT مع ضمان المنصة", "Everything priced in USDT with platform protection")}>
        <Card className="mb-6 grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="size-4 text-primary" />
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => { setActive(f.key); setPage(1); }}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active === f.key ? "bg-primary text-primary-foreground font-bold" : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder={tr("ابحث عن خدمة...", "Search for a service...")}
              className="w-full min-w-0 rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as SortKey); setPage(1); }}
              className="min-w-0 rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              aria-label={tr("الفرز", "Sort")}
            >
              {sorts.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <select
              value={contentLang}
              onChange={(e) => { setContentLang(e.target.value as "all" | "ar" | "en"); setPage(1); }}
              className="min-w-0 rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              aria-label={tr("لغة الخدمة", "Service language")}
            >
              <option value="all">{tr("كل اللغات", "All languages")}</option>
              <option value="ar">{tr("العربية", "Arabic")}</option>
              <option value="en">{tr("الإنجليزية", "English")}</option>
            </select>
            <select
              value={delivery}
              onChange={(e) => { setDelivery(Number(e.target.value)); setPage(1); }}
              className="min-w-0 rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              aria-label={tr("مدة التسليم", "Delivery time")}
            >
              <option value={0}>{tr("أي مدة تسليم", "Any delivery time")}</option>
              <option value={1}>{tr("خلال 24 ساعة", "Within 24 hours")}</option>
              <option value={3}>{tr("حتى 3 أيام", "Up to 3 days")}</option>
              <option value={7}>{tr("حتى 7 أيام", "Up to 7 days")}</option>
              <option value={14}>{tr("حتى 14 يوم", "Up to 14 days")}</option>
            </select>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">
              {tr("أقصى سعر", "Max price")}: <span className="font-bold text-primary" dir="ltr">{maxPrice} USDT</span>
            </span>
            <input
              type="range"
              min={0}
              max={2000}
              step={25}
              value={maxPrice}
              onChange={(e) => { setMaxPrice(Number(e.target.value)); setPage(1); }}
              className="w-full accent-[hsl(var(--primary))]"
              aria-label={tr("نطاق السعر", "Price range")}
            />
          </label>
        </Card>

        {listings.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-primary" /></div>
        ) : listings.error ? (
          <p className="py-10 text-center text-muted-foreground">{tr("تعذّر تحميل الخدمات.", "Could not load services.")}</p>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
            {tr("لا توجد خدمات معروضة حالياً", "No services are currently listed")}
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((s) => (
                <ServiceCard key={s.id} {...s} />
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
              >
                {tr("السابق", "Previous")}
              </button>
              <span className="text-muted-foreground" dir="ltr">{page} / {pages}</span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
              >
                {tr("التالي", "Next")}
              </button>
              <span className="ms-2 text-xs text-muted-foreground">{tr("النتائج", "Results")}: {total}</span>
            </div>
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
