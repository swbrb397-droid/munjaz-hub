import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Star, TrendingUp, Trophy, Zap } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { supabase } from "@/integrations/supabase/client";
import { ServiceCard } from "@/routes/index";

export const Route = createFileRoute("/user/$username")({
  head: ({ params }) => ({
    meta: [
      { title: "ملف البائع | المُنجِز" },
      { name: "description", content: "ملف بائع في منصة المُنجِز: التقييم الحقيقي، عدد الطلبات المكتملة، والعروض المنشورة." },
      { property: "og:title", content: "ملف البائع | المُنجِز" },
      { property: "og:description", content: `عروض وتقييمات البائع ${params.username} على منصة المُنجِز.` },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SellerProfilePage,
});

function SellerProfilePage() {
  const { username } = Route.useParams();
  const { lang, tr } = useLang();

  const seller = useQuery({
    queryKey: ["public-seller", username],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_leaderboard", { _limit: 200 });
      if (error) throw error;
      return (data ?? []).find((r) => String(r.id) === username || r.display_name === username) ?? null;
    },
  });

  const listings = useQuery({
    queryKey: ["public-seller-listings", username],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("owner_id", username)
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (seller.isLoading) {
    return (
      <Section title={tr("جارٍ التحميل...", "Loading...")}>
        <div className="h-32 animate-pulse rounded-2xl bg-secondary/70" />
      </Section>
    );
  }

  if (!seller.data) {
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

  const s = seller.data;
  const stats = [
    { icon: Star, label: tr("التقييم", "Rating"), value: Number(s.rating ?? 0).toFixed(2) },
    { icon: Trophy, label: tr("الطلبات المكتملة", "Completed orders"), value: Number(s.completed_orders ?? 0).toLocaleString("en-US") },
    { icon: Zap, label: tr("نقاط الخبرة", "XP points"), value: Number(s.xp_points ?? 0).toLocaleString("en-US") },
    { icon: TrendingUp, label: tr("المستوى", "Level"), value: String(s.level ?? 1) },
  ];

  return (
    <Section title="" subtitle="">
      <Card className="flex flex-wrap items-center gap-5">
        {s.avatar_url ? (
          <img src={s.avatar_url} alt={s.display_name} className="size-20 rounded-2xl object-cover" />
        ) : (
          <span className="grid size-20 place-items-center rounded-2xl border border-border bg-secondary text-xl font-black">
            {s.display_name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-black">
            {s.display_name}
            {s.is_verified && <BadgeCheck className="size-5 text-accent" />}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {tr("بيانات الأداء محسوبة مباشرة من الطلبات المكتملة على المنصة.", "Performance data is computed directly from completed platform orders.")}
          </p>
        </div>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((k) => (
          <Card key={k.label}>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <k.icon className="size-4" /> {k.label}
            </p>
            <p className="mt-2 text-2xl font-black">{k.value}</p>
          </Card>
        ))}
      </div>

      <h2 className="mb-4 mt-8 text-lg font-extrabold">{tr("العروض المنشورة", "Published offers")}</h2>
      {listings.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-secondary/70" />)}
        </div>
      ) : (listings.data ?? []).length === 0 ? (
        <Card className="py-10 text-center text-sm text-muted-foreground">
          {tr("لا توجد عروض منشورة لهذا البائع بعد.", "This seller has no published offers yet.")}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(listings.data ?? []).map((l) => (
            <ServiceCard
              key={l.id}
              id={l.id}
              title={lang === "ar" ? l.title_ar : l.title_en}
              seller={lang === "ar" ? l.seller_ar : l.seller_en}
              price={Number(l.price_usdt)}
              rating={Number(l.rating)}
              orders={l.orders_count}
              verified={l.verified}
              tag={lang === "ar" ? l.tag_ar : l.tag_en}
              cover={l.cover_key}
              category={l.category}
            />
          ))}
        </div>
      )}
    </Section>
  );
}
