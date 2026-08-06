import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { nfts, services } from "@/lib/mock";
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

const filters = [
  { key: "all", label: "الكل" },
  { key: "freelance", label: "خدمات مستقلين" },
  { key: "course", label: "دورات" },
  { key: "product", label: "منتجات رقمية" },
  { key: "gaming", label: "قيمنق" },
] as const;

function Store() {
  const [active, setActive] = useState<(typeof filters)[number]["key"]>("all");
  const [query, setQuery] = useState("");

  const list = useMemo(
    () =>
      services.filter(
        (s) => (active === "all" || s.category === active) && s.title.includes(query.trim()),
      ),
    [active, query],
  );

  return (
    <>
      <Section title="المتجر الرقمي" subtitle="كل شيء بسعر USDT مع ضمان المنصة">
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
            placeholder="ابحث عن خدمة..."
            className="ms-auto w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary sm:w-64"
          />
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((s) => (
            <ServiceCard key={s.id} title={s.title} seller={s.seller} price={s.price} rating={s.rating} orders={s.orders} verified={s.verified} tag={s.tag} />
          ))}
        </div>
        {list.length === 0 && <p className="py-10 text-center text-muted-foreground">لا توجد نتائج مطابقة.</p>}
      </Section>

      <Section title="معرض NFT" subtitle="مجموعات موثقة قابلة للعرض والبيع">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {nfts.map((n) => (
            <NftCard key={n.id} {...n} />
          ))}
        </div>
      </Section>
    </>
  );
}
