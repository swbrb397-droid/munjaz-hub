import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Search, Star, Users } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { supabase } from "@/lib/cloud-client";
import { PresenceBadge, ONLINE_WINDOW_MS } from "@/lib/presence";

export const Route = createFileRoute("/freelancers")({
  head: () => ({
    meta: [
      { title: "دليل المستقلين | المنجز" },
      { name: "description", content: "تصفّح المستقلين على المنجز بالتقييم الحقيقي والطلبات المكتملة وحالة التواجد الحي." },
      { property: "og:title", content: "دليل المستقلين | المنجز" },
      { property: "og:description", content: "مستقلون حقيقيون مرتبون بالجدارة — لا ترتيب مدفوع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Freelancers,
});

function Freelancers() {
  const { tr } = useLang();
  const [q, setQ] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const dir = useQuery({
    queryKey: ["freelancers-directory"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_freelancers_directory", { _limit: 200 });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (dir.data ?? []).filter((f) => {
      if (s && !`${f.display_name} ${f.bio ?? ""}`.toLowerCase().includes(s)) return false;
      if (onlineOnly && !(f.last_active_at && Date.now() - new Date(f.last_active_at).getTime() < ONLINE_WINDOW_MS)) return false;
      return true;
    });
  }, [dir.data, q, onlineOnly]);

  return (
    <Section title={tr("دليل المستقلين", "Freelancers")} subtitle={tr("مرتّب بالجدارة: الطلبات المكتملة ثم التقييم — لا ترتيب مدفوع.", "Ranked on merit: completed orders, then rating — no paid placement.")}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="absolute end-3 top-2.5 size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("ابحث بالاسم أو المهارة", "Search by name or skill")} className="w-full rounded-lg border border-input bg-surface px-3 py-2 pe-9 text-sm outline-none focus:border-primary" />
        </label>
        <button type="button" onClick={() => setOnlineOnly((v) => !v)} className={`h-10 rounded-lg border px-3 text-xs font-bold ${onlineOnly ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
          {tr("المتصلون الآن", "Online now")}
        </button>
      </div>
      {dir.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-secondary/70" />)}</div>
      ) : rows.length === 0 ? (
        <Card className="grid place-items-center gap-3 py-14 text-center"><Users className="size-7 text-primary" /><p className="text-sm font-bold">{tr("لا يوجد مستقلون مطابقون حالياً", "No matching freelancers yet")}</p></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((f) => (
            <Link key={f.id} to="/user/$username" params={{ username: f.id }} className="block min-w-0 rounded-xl border border-border bg-card/70 p-4 transition hover:border-primary">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-sm font-black">
                  {f.avatar_url ? <img src={f.avatar_url} alt="" className="size-full object-cover" /> : f.display_name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-1 text-sm font-bold"><span className="truncate">{f.display_name}</span>{f.is_verified && <BadgeCheck className="size-4 shrink-0 text-accent" />}</p>
                  <PresenceBadge lastActive={f.last_active_at} />
                </div>
              </div>
              {f.bio && <p className="mt-2 line-clamp-2 break-words text-xs text-muted-foreground">{f.bio}</p>}
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-0.5"><Star className="size-3" /> <bdi>{Number(f.rating).toFixed(1)}</bdi></span>
                <span><bdi>{f.completed_orders}</bdi> {tr("طلب مكتمل", "completed")}</span>
                <span><bdi>{f.listings_count}</bdi> {tr("خدمة", "services")}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}
