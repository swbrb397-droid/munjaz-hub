import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Award, Coins, ShoppingBag, TrendingUp, Users } from "lucide-react";

import { Card, Section } from "@/components/site/Shell";
import { PrestigeTracker } from "@/components/site/PrestigeTracker";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { useOrders, useProfile, useReferrals, useWallet } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم | المنجز" },
      { name: "description", content: "لوحة تحكم تفاعلية بعرض مزدوج للمشتري والبائع: الدخل المباشر، الطلبات النشطة، تقدم XP، ومؤشرات محفظة USDT." },
      { property: "og:title", content: "لوحة التحكم | المنجز" },
      { property: "og:description", content: "تابع دخلك وطلباتك ومستواك في المنجز لحظياً." },
    ],
  }),
  component: Dashboard,
});

const num = (v: unknown) => Number(v ?? 0);

function Dashboard() {
  const { tr } = useLang();
  const { user } = useAuth();
  const [view, setView] = useState<"seller" | "buyer">("seller");

  const profile = useProfile();
  const wallet = useWallet();
  const orders = useOrders();
  const referrals = useReferrals();

  const rows = orders.data ?? [];
  const asSeller = useMemo(() => rows.filter((o) => o.seller_id === user?.id), [rows, user]);
  const asBuyer = useMemo(() => rows.filter((o) => o.buyer_id === user?.id), [rows, user]);
  const list = view === "seller" ? asSeller : asBuyer;

  const active = list.filter((o) => ["pending", "in_progress", "delivered"].includes(o.status));
  const completed = list.filter((o) => o.status === "completed");
  const escrow = list.filter((o) => o.escrow_locked).reduce((s, o) => s + num(o.amount_usdt), 0);

  const stats =
    view === "seller"
      ? [
          { icon: Coins, label: tr("إجمالي الأرباح", "Lifetime earnings"), value: `${num(wallet.data?.lifetime_earned).toLocaleString()} USDT`, sub: tr("محرَّرة من الضمان", "Released from escrow") },
          { icon: ShoppingBag, label: tr("طلبات نشطة", "Active orders"), value: String(active.length), sub: tr("قيد التنفيذ أو التسليم", "In progress or delivered") },
          { icon: TrendingUp, label: tr("طلبات مكتملة", "Completed orders"), value: String(profile.data?.completed_orders ?? completed.length), sub: tr("سجل الإنجاز", "Completion record") },
          { icon: Users, label: tr("عمولات الإحالة", "Referral commissions"), value: `${(referrals.data?.totalEarned ?? 0).toLocaleString()} USDT`, sub: `${referrals.data?.referrals.length ?? 0} ${tr("إحالة", "referrals")}` },
        ]
      : [
          { icon: Coins, label: tr("إجمالي الإنفاق", "Total spending"), value: `${asBuyer.reduce((s, o) => s + num(o.amount_usdt), 0).toLocaleString()} USDT`, sub: `${asBuyer.length} ${tr("طلب", "orders")}` },
          { icon: ShoppingBag, label: tr("طلبات جارية", "Ongoing orders"), value: String(active.length), sub: tr("بانتظار التسليم/المراجعة", "Awaiting delivery/review") },
          { icon: TrendingUp, label: tr("مبالغ في الضمان", "Amounts in escrow"), value: `${escrow.toLocaleString()} USDT`, sub: tr("محجوزة بأمان", "Safely held") },
          { icon: Users, label: tr("الرصيد المتاح", "Available balance"), value: `${num(wallet.data?.available_usdt).toLocaleString()} USDT`, sub: "USDT" },
        ];

  const xp = profile.data?.xp_points ?? 0;
  const level = profile.data?.level ?? 1;
  const nextLevelXp = level * 500;
  const pct = Math.min(100, Math.round((xp / Math.max(1, nextLevelXp)) * 100));

  // Prestige metrics come from real seller activity only.
  const sellerCompleted = asSeller.filter((o) => o.status === "completed");
  const prestige = {
    orders: profile.data?.completed_orders ?? sellerCompleted.length,
    volume: sellerCompleted.reduce((s, o) => s + num(o.amount_usdt), 0),
    rating: num(profile.data?.rating),
    onTime: sellerCompleted.length
      ? Math.round(
          (sellerCompleted.filter((o) => !o.due_at || !o.completed_at || new Date(o.completed_at) <= new Date(o.due_at)).length /
            sellerCompleted.length) *
            100,
        )
      : 0,
  };

  const loadingCore = profile.isLoading || wallet.isLoading || orders.isLoading;


  return (
    <Section
      title={tr("لوحة التحكم", "Dashboard")}
      subtitle={profile.data?.display_name || user?.email || tr("عرض مزدوج: بائع / مشتري", "Dual view: seller / buyer")}
      action={
        <div className="flex rounded-xl border border-border p-1">
          {(["seller", "buyer"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-4 py-2 text-sm ${view === v ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground"}`}
            >
              {v === "seller" ? tr("بائع", "Seller") : tr("مشتري", "Buyer")}
            </button>
          ))}
        </div>
      }
    >
      {loadingCore && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <div className="h-5 w-5 animate-pulse rounded bg-secondary" />
              <div className="mt-3 h-3 w-24 animate-pulse rounded bg-secondary" />
              <div className="mt-2 h-7 w-32 animate-pulse rounded bg-secondary" />
              <div className="mt-2 h-3 w-20 animate-pulse rounded bg-secondary" />
            </Card>
          ))}
        </div>
      )}

      <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${loadingCore ? "hidden" : "animate-in fade-in duration-500"}`}>
        {stats.map((s) => (
          <Card key={s.label}>
            <s.icon className="size-5 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
          </Card>
        ))}
      </div>

      {view === "seller" && (
        <div className="mt-6">
          <PrestigeTracker metrics={prestige} />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h3 className="font-bold">{tr("الطلبات النشطة", "Active orders")}</h3>
          <div className="mt-4 grid gap-3">
            {orders.isLoading && <p className="text-sm text-muted-foreground">{tr("جارٍ التحميل…", "Loading…")}</p>}
            {!orders.isLoading && active.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {tr("لا توجد طلبات نشطة بعد.", "No active orders yet.")}
              </p>
            )}
            {active.map((o) => {
              const progress = o.status === "delivered" ? 90 : o.status === "in_progress" ? 55 : 15;
              return (
                <div key={o.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{o.title}</p>
                      <p className="text-xs text-muted-foreground">#MJ-{o.order_number} · {o.category ?? tr("عام", "General")}</p>
                    </div>
                    <div className="text-end">
                      <p className="font-bold text-primary">{num(o.amount_usdt)} USDT</p>
                      <p className="text-xs text-muted-foreground">{o.status}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-secondary">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid gap-4">
          {view === "seller" && (
          <Card>
            <div className="flex items-center gap-2">
              <Award className="size-5 text-violet" />
              <h3 className="font-bold">
                {tr("المستوى", "Level")} {level}
                {profile.data?.is_verified ? ` · ${tr("موثّق", "Verified")}` : ""}
              </h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground" dir="ltr">XP {xp} / {nextLevelXp}</p>
            <div className="mt-2 h-3 rounded-full bg-secondary">
              <div className="h-3 rounded-full bg-gradient-to-l from-primary to-violet" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">KYC: {profile.data?.kyc_tier ?? "tier0"}</span>
              <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                {profile.data?.completed_orders ?? 0} {tr("طلب مكتمل", "completed orders")}
              </span>
            </div>
          </Card>
          )}

          {view === "buyer" && (
            <Card>
              <h3 className="font-bold">{tr("مؤشرات المشتري", "Buyer metrics")}</h3>
              <dl className="mt-3 grid gap-2 text-sm">
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">{tr("طلبات مكتملة", "Completed orders")}</dt>
                  <dd className="font-semibold">{completed.length}</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">{tr("طلبات جارية", "Ongoing orders")}</dt>
                  <dd className="font-semibold">{active.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{tr("مبالغ محجوزة في الضمان", "Held in escrow")}</dt>
                  <dd className="font-semibold text-accent" dir="ltr">{escrow.toFixed(2)} USDT</dd>
                </div>
              </dl>
              <Link
                to="/store"
                className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
              >
                {tr("تصفّح المتجر", "Browse the store")}
                <ArrowLeft className="size-4 rtl:rotate-180" />
              </Link>
            </Card>
          )}
        </div>
      </div>
    </Section>
  );
}
