import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useMock } from "@/lib/mock";
import { useLang } from "@/lib/lang";
import { NftCard, ServiceCard } from "./index";

export const Route = createFileRoute("/store")({
  head: () => ({
    meta: [
      { title: "المتجر الرقمي و NFT | مُنجَز" },
      { name: "description", content: "تصفح خدمات المستقلين، المنتجات الرقمية، الدورات، جلسات القيمنق، ومعرض NFT على منصة مُنجَز بعملة USDT." },
      { property: "og:title", content: "المتجر الرقمي و NFT | مُنجَز" },
      { property: "og:description", content: "فلترة كاملة للأصول الرقمية والدورات وخدمات المستقلين بعملة USDT." },
    ],
  }),
  component: Store,
});

function getFilters(tr: (ar: string, en: string) => string) {
  return [
    { key: "all", label: tr("الكل", "All") },
    { key: "freelance", label: tr("خدمات مستقلين", "Freelance services") },
    { key: "course", label: tr("دورات", "Courses") },
    { key: "product", label: tr("منتجات رقمية", "Digital products") },
    { key: "gaming", label: tr("قيمنق", "Gaming") },
  ] as const;
}

function Store() {
  const { tr } = useLang();
  const { services, nfts } = useMock();
  const filters = getFilters(tr);
  const [active, setActive] = useState<(typeof filters)[number]["key"]>("all");
  const [query, setQuery] = useState("");

  const list = useMemo(
    () =>
      services.filter(
        (s) => (active === "all" || s.category === active) && s.title.includes(query.trim()),
      ),
    [active, query, services],
  );

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
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("ابحث عن خدمة...", "Search for a service...")}
            className="ms-auto w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary sm:w-64"
          />
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((s) => (
            <ServiceCard key={s.id} title={s.title} seller={s.seller} price={s.price} rating={s.rating} orders={s.orders} verified={s.verified} tag={s.tag} cover={s.cover} />
          ))}
        </div>
        {list.length === 0 && <p className="py-10 text-center text-muted-foreground">{tr("لا توجد نتائج مطابقة.", "No matching results.")}</p>}
      </Section>

      <Section title={tr("معرض NFT", "NFT gallery")} subtitle={tr("مجموعات موثقة قابلة للعرض والبيع", "Verified collections available to display and sell")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {nfts.map((n) => (
            <NftCard key={n.id} {...n} />
          ))}
        </div>
      </Section>
    </>
  );
}
