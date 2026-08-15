import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Filter, Loader2 } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useListings, useNfts, type ListingCategory, type SortKey } from "@/lib/catalog";
import { NftCard, ServiceCard } from "./index";

export const Route = createFileRoute("/store")({
  head: () => ({
    meta: [
      { title: "المتجر الرقمي و NFT | المُنجَز" },
      { name: "description", content: "تصفح خدمات المستقلين، المنتجات الرقمية، الدورات، جلسات القيمنق، ومعرض NFT على منصة المُنجَز بعملة USDT." },
      { property: "og:title", content: "المتجر الرقمي و NFT | المُنجَز" },
      { property: "og:description", content: "فلترة كاملة للأصول الرقمية والدورات وخدمات المستقلين بعملة USDT." },
    ],
  }),
  component: Store,
});

function Store() {
  const { tr } = useLang();
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
