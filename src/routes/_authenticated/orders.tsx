import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, Lock, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { TopUpDialog } from "@/components/site/TopUpDialog";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import { VerifiedBadge } from "@/components/site/VerifiedBadge";
import { useOrders, useWallet } from "@/lib/queries";
import { useOrderTransition, useReleasedByOrder, type OrderStatus } from "@/lib/orders";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "طلباتي وحالة الضمان | المُنجِز" },
      {
        name: "description",
        content: "كل طلباتك في مكان واحد: رقم الطلب، حالة الضمان، المبلغ المتبقي بعملة USDT، ورابط مباشر لمساحة العمل.",
      },
      { property: "og:title", content: "طلباتي وحالة الضمان | المُنجِز" },
      { property: "og:description", content: "تابع أرقام الطلبات وحالة الضمان والمبالغ المتبقية بعملة USDT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdersPage,
});

const STATUS_LABEL: Record<OrderStatus, [string, string]> = {
  pending: ["بانتظار الدفع", "Awaiting payment"],
  in_progress: ["الضمان مموّل — قيد التنفيذ", "Escrow funded — in progress"],
  delivered: ["تم التسليم — بانتظار الاعتماد", "Delivered — awaiting approval"],
  completed: ["مكتمل", "Completed"],
  disputed: ["نزاع مفتوح", "Dispute open"],
  cancelled: ["ملغي", "Cancelled"],
  refunded: ["مسترجع", "Refunded"],
};

const FILTERS: Array<{ id: "all" | OrderStatus; ar: string; en: string }> = [
  { id: "all", ar: "الكل", en: "All" },
  { id: "pending", ar: "بانتظار الدفع", en: "Awaiting payment" },
  { id: "in_progress", ar: "قيد التنفيذ", en: "In progress" },
  { id: "delivered", ar: "تم التسليم", en: "Delivered" },
  { id: "completed", ar: "مكتمل", en: "Completed" },
  { id: "disputed", ar: "نزاع", en: "Disputed" },
];

function statusTone(s: OrderStatus) {
  if (s === "completed") return "border-primary/50 bg-primary/10 text-primary";
  if (s === "disputed" || s === "cancelled" || s === "refunded") return "border-destructive/50 bg-destructive/10 text-destructive";
  if (s === "pending") return "border-border bg-secondary text-muted-foreground";
  return "border-accent/50 bg-accent/10 text-accent";
}

function OrdersPage() {
  const { tr } = useLang();
  const { user } = useAuth();
  const { profile: myProfile } = useUserProfile();
  const orders = useOrders();
  const wallet = useWallet();
  const transition = useOrderTransition();
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [topUp, setTopUp] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = orders.data ?? [];
  const ids = useMemo(() => rows.map((o) => o.id), [rows]);
  const released = useReleasedByOrder(ids);
  const balance = Number(wallet.data?.available_usdt ?? 0);

  const visible = filter === "all" ? rows : rows.filter((o) => o.status === filter);

  return (
    <Section
      title={tr("طلباتي", "My orders")}
      subtitle={tr(
        "رقم الطلب، حالة الضمان، والمبلغ المتبقي بعملة USDT — بيانات حية من قاعدة البيانات.",
        "Order number, escrow status and remaining USDT — live from the database.",
      )}
      action={
        <Link to="/wallet" className="inline-flex items-center gap-2 rounded-xl border border-primary/50 px-3 py-2 text-sm font-bold text-primary">
          <Wallet className="size-4" /> {tr("المحفظة", "Wallet")}
        </Link>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              filter === f.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
            }`}
          >
            {tr(f.ar, f.en)}
          </button>
        ))}
      </div>

      {orders.isLoading && (
        <div className="mt-6 grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-primary" /></div>
      )}

      {!orders.isLoading && visible.length === 0 && (
        <Card className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">{tr("لا توجد طلبات بعد.", "No orders yet.")}</p>
          <Link to="/store" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary">
            {tr("تصفح المتجر", "Browse the store")} <ArrowLeft className="size-4" />
          </Link>
        </Card>
      )}

      <div className="mt-6 grid gap-3">
        {visible.map((o) => {
          const amount = Number(o.amount_usdt ?? 0);
          const paidOut = released.data?.[o.id] ?? 0;
          const remaining = Math.max(0, amount - paidOut);
          const isBuyer = o.buyer_id === user?.id;
          const needsFunding = isBuyer && o.status === "pending";
          const shortfall = Math.max(0, amount - balance);
          const [ar, en] = STATUS_LABEL[o.status];

          return (
            <Card key={o.id} className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-border px-2.5 py-1 font-mono text-xs font-black" dir="ltr">
                  #{o.order_number}
                </span>
                <span className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${statusTone(o.status)}`}>{tr(ar, en)}</span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                  {isBuyer ? tr("مشترٍ", "Buyer") : tr("بائع", "Seller")}
                  {myProfile?.is_verified && <VerifiedBadge label={false} />}
                </span>
                {o.escrow_locked && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                    <Lock className="size-3" /> {tr("الضمان محجوز", "Escrow locked")}
                  </span>
                )}
              </div>

              <p className="text-sm font-bold leading-snug">{o.title}</p>

              <dl className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
                  <dt className="text-[11px] text-muted-foreground">{tr("قيمة الطلب", "Order value")}</dt>
                  <dd className="mt-0.5 text-sm font-bold" dir="ltr">{amount.toFixed(2)} USDT</dd>
                </div>
                <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
                  <dt className="text-[11px] text-muted-foreground">{tr("المُحرَّر للبائع", "Released to seller")}</dt>
                  <dd className="mt-0.5 text-sm font-bold" dir="ltr">{paidOut.toFixed(2)} USDT</dd>
                </div>
                <div className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2">
                  <dt className="text-[11px] text-muted-foreground">{tr("المتبقي في الضمان", "Remaining in escrow")}</dt>
                  <dd className="mt-0.5 text-sm font-black text-primary" dir="ltr">{remaining.toFixed(2)} USDT</dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/workspace"
                  search={{ order: o.id }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:border-primary hover:text-primary"
                >
                  <ShieldCheck className="size-3.5" /> {tr("فتح مساحة الطلب", "Open order workspace")}
                </Link>

                {needsFunding && shortfall > 0 && (
                  <button
                    type="button"
                    onClick={() => setTopUp(shortfall)}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground glow"
                  >
                    <Sparkles className="size-3.5" /> {tr("ادفع عبر NOWPayments", "Pay with NOWPayments")}
                  </button>
                )}

                {needsFunding && shortfall <= 0 && (
                  <button
                    type="button"
                    disabled={transition.isPending}
                    onClick={() => {
                      setError(null);
                      transition.mutate(
                        { id: o.id, status: "in_progress" },
                        { onError: (e: Error) => setError(e.message) },
                      );
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                  >
                    <Lock className="size-3.5" /> {tr("تمويل الضمان الآن", "Fund escrow now")}
                  </button>
                )}
              </div>

              {needsFunding && shortfall > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {tr(
                    `رصيدك ${balance.toFixed(2)} USDT — تحتاج ${shortfall.toFixed(2)} USDT إضافية لتمويل الضمان.`,
                    `Balance ${balance.toFixed(2)} USDT — you need ${shortfall.toFixed(2)} USDT more to fund escrow.`,
                  )}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                {tr("أُنشئ في", "Created")}: {new Date(o.created_at).toLocaleString()}
              </p>
            </Card>
          );
        })}
      </div>

      {error && <p className="mt-4 text-xs text-destructive">{error}</p>}

      {topUp !== null && <TopUpDialog defaultAmount={topUp} onClose={() => setTopUp(null)} />}
    </Section>
  );
}
