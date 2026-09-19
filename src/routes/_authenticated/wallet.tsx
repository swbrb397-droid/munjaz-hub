import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/cloud-client";
import { useAuth } from "@/hooks/use-auth";
import { gasEstimates } from "@/lib/gas";

import {
  ArrowUpFromLine,
  BadgeCheck,
  FileText,
  Info,
  Loader2,
  Lock,
  ShieldAlert,
  Sparkles,
  Timer,
} from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { ReceiptModal, type ReceiptData } from "@/components/site/ReceiptModal";
import { useLang } from "@/lib/lang";
import { useProfile, useRoles, useTransactions, useWallet } from "@/lib/queries";
import {
  MIN_WITHDRAWAL,
  WITHDRAWAL_FEE,
  slaHoursForTier,
  useMyWithdrawals,
  withdrawalErrorMessage,
  type WithdrawalNetwork,
} from "@/lib/withdrawals";
import { parseUsdt } from "@/lib/security";
import { isEmailLike, validatePayoutAddress } from "@/lib/address";
import { useWalletRealtime } from "@/lib/deposits";
import { toast } from "sonner";
import { useLockedEscrow } from "@/lib/escrow";
import { TopUpDialog } from "@/components/site/TopUpDialog";
import { ReferralWidget } from "@/components/site/ReferralWidget";
import { RedeemPassCard } from "@/components/site/RedeemPassCard";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "المحفظة الداخلية USDT | المنجز" },
      {
        name: "description",
        content:
          "أودع واسحب USDT عبر TRC-20 و BEP-20 و Polygon، وتابع سجل المعاملات والمبالغ المحجوزة في الضمان.",
      },
      { property: "og:title", content: "المحفظة الداخلية USDT | المنجز" },
      {
        property: "og:description",
        content: "إيداع وسحب USDT بدون رسوم داخلية مع سحب فوري للحسابات الموثقة.",
      },
    ],
  }),
  component: WalletPage,
});

const networks = [
  { value: "trc20", label: "TRC-20" },
  { value: "bep20", label: "BEP-20" },
  { value: "polygon", label: "Polygon" },
] as const;

const rates: Record<string, number> = { USD: 1.0002, SAR: 3.7506, AED: 3.6731, EUR: 0.9184 };

const RATE_HINT: Record<string, [string, string]> = {
  USD: ["الدولار الأمريكي — سعر تحويل تقريبي لحظي", "US Dollar — indicative live conversion rate"],
  SAR: ["الريال السعودي — سعر تحويل تقريبي لحظي", "Saudi Riyal — indicative live conversion rate"],
  AED: ["الدرهم الإماراتي — سعر تحويل تقريبي لحظي", "UAE Dirham — indicative live conversion rate"],
  EUR: ["اليورو — سعر تحويل تقريبي لحظي", "Euro — indicative live conversion rate"],
};

const COOLING_LOCK_HOURS = 24;

/** Always render money with exactly two decimals. */
function usdt2(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

/** Hours remaining on a 24h security cooling lock, 0 when clear. */
function coolingHoursLeft(stamps: Array<string | null | undefined>): number {
  const now = Date.now();
  let left = 0;
  for (const s of stamps) {
    if (!s) continue;
    const elapsed = now - new Date(s).getTime();
    const remaining = COOLING_LOCK_HOURS * 3600_000 - elapsed;
    if (remaining > left) left = remaining;
  }
  return left > 0 ? Math.ceil(left / 3600_000) : 0;
}

/**
 * Crypto-deposit funds that never passed through an escrow order.
 * Only this portion is subject to the 5% anti-mixing surcharge.
 */
function useUnspentDeposits() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["unspent-deposits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("unspent_deposit_balance", { _user_id: user!.id });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}

function WalletPage() {
  const { tr, lang } = useLang();
  const wallet = useWallet();
  const profile = useProfile();
  const roles = useRoles();
  const isAdmin = (roles.data ?? []).includes("admin");
  const txs = useTransactions();
  const requests = useMyWithdrawals();
  const lockedEscrow = useLockedEscrow();
  const unspentDeposits = useUnspentDeposits();
  useWalletRealtime();
  const [topUp, setTopUp] = useState(false);
  const [network, setNetwork] = useState<WithdrawalNetwork>("polygon");
  const gasRows = useMemo(() => gasEstimates(), []);

  const [amount, setAmount] = useState("250");
  const [legalAck, setLegalAck] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [payoutAddress, setPayoutAddress] = useState("");
  const { user } = useAuth();
  const qc = useQueryClient();

  // Payout address is the only wallet column the client may write; balances are
  // mutated exclusively by secure database routines.
  useEffect(() => {
    const saved = wallet.data?.payout_address ?? "";
    if (isEmailLike(saved)) {
      // Legacy rows stored an email here — purge it so no payout can target it.
      setPayoutAddress("");
      if (user) {
        void supabase
          .from("wallets")
          .update({ payout_address: null })
          .eq("user_id", user.id)
          .then(() => {
            void qc.invalidateQueries({ queryKey: ["wallet"] });
            toast.error(
              tr(
                "تم حذف عنوان سحب غير صالح (بريد إلكتروني) من محفظتك — يرجى إدخال عنوان USDT صحيح.",
                "An invalid payout address (email) was removed from your wallet — please enter a valid USDT address.",
              ),
            );
          });
      }
      return;
    }
    setPayoutAddress(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.data?.payout_address, user?.id]);

  const savePayout = useMutation({
    mutationFn: async (value: string) => {
      if (!user) throw new Error(tr("يجب تسجيل الدخول.", "You must be signed in."));
      const invalid = validatePayoutAddress(value, network);
      if (invalid) throw new Error(invalid);
      const { error } = await supabase
        .from("wallets")
        .update({ payout_address: value, payout_address_updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      toast.success(tr("تم حفظ عنوان السحب", "Payout address saved"));
      toast.warning(
        tr(
          "تم تفعيل قفل أمني لمدة 24 ساعة على السحب بعد تعديل عنوان المحفظة.",
          "A 24-hour security lock is now active on withdrawals after changing your payout address.",
        ),
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const balance = Number(wallet.data?.available_usdt ?? 0);
  // Escrow held = live sum of orders still in flight (in_progress / delivered /
  // disputed). Completed, cancelled and refunded orders never count, so a fully
  // settled account always reads 0.00 USDT.
  const locked = lockedEscrow.data ?? 0;
  const tier = (profile.data as { account_tier?: string } | null)?.account_tier ?? "free";
  const frozen = Boolean((profile.data as { is_frozen?: boolean } | null)?.is_frozen);
  const sla = slaHoursForTier(tier);
  const parsed = parseUsdt(amount) ?? 0;

  // Smart AML: service earnings are 100% exempt from the anti-mixing surcharge.
  // Only unspent crypto deposits that never entered escrow require the consent.
  const availableNow = Number(wallet.data?.available_usdt ?? 0);
  const unspent = Math.max(0, Number(unspentDeposits.data ?? 0));
  const earnedAvailable = Math.max(0, availableNow - unspent);
  const amlExempt = parsed > 0 && parsed <= earnedAvailable;

  // Triple trigger: password change, MFA change, or payout-address change.
  const rawLockHours = coolingHoursLeft([
    (profile.data as { password_last_changed_at?: string | null } | null)?.password_last_changed_at,
    (profile.data as { mfa_updated_at?: string | null } | null)?.mfa_updated_at,
    (wallet.data as { payout_address_updated_at?: string | null } | null)
      ?.payout_address_updated_at,
  ]);
  // Administrators bypass the 24h security cooling lock (operational testing).
  const lockHours = isAdmin ? 0 : rawLockHours;

  const withdraw = useMutation({
    mutationFn: async () => {
      if (lockHours > 0) throw new Error("COOLING_LOCK");
      const requestedAmount = parseUsdt(amount);
      if (requestedAmount === null) throw new Error("INVALID_AMOUNT");
      if (requestedAmount < MIN_WITHDRAWAL) throw new Error("MIN_WITHDRAWAL_10");
      if (requestedAmount > balance) throw new Error("INSUFFICIENT_FUNDS");
      const target = payoutAddress.trim() || (wallet.data?.payout_address ?? "");
      const invalidAddress = validatePayoutAddress(target, network);
      if (invalidAddress) throw new Error(invalidAddress);

      const { data, error } = await supabase.rpc("request_withdrawal", {
        _amount: requestedAmount,
        _network: network,
        _address: target,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wallet"] });
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      void qc.invalidateQueries({ queryKey: ["withdrawals"] });
    },
  });

  const submit = () => {
    setFeedback(null);
    withdraw.mutate(undefined, {
      onSuccess: () => {
        const message = tr(
          `تم استلام الطلب — المعالجة خلال ${sla} ساعة.`,
          `Request received — processing within ${sla} hours.`,
        );
        setFeedback(message);
        toast.success(message);
      },
      onError: (e: Error) => {
        const message =
          e.message === "COOLING_LOCK"
            ? tr(
                `السحب مجمد مؤقتاً لمدة ${lockHours} ساعة بعد إجراء تعديل أمني على حسابك.`,
                `Withdrawals are locked for ${lockHours} more hour(s) after a recent security change.`,
              )
            : withdrawalErrorMessage(e.message, lang === "ar");
        setFeedback(message);
        toast.error(message);
      },
    });
  };

  return (
    <Section
      title={tr("المحفظة الداخلية", "Internal wallet")}
      subtitle={tr(
        "جميع الأرصدة بعملة USDT — تحويلات داخلية بدون رسوم غاز",
        "All balances in USDT — internal transfers with no gas fees",
      )}
      action={
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTopUp(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground glow"
          >
            <Sparkles className="size-4" /> {tr("شحن المحفظة", "Top up wallet")}
          </button>
          <button
            onClick={() =>
              document
                .getElementById("withdraw-card")
                ?.scrollIntoView({ behavior: "smooth", block: "center" })
            }
            className="inline-flex items-center gap-2 rounded-xl border border-primary/50 px-4 py-2 font-bold text-primary"
          >
            <ArrowUpFromLine className="size-4" /> {tr("طلب سحب", "Request withdrawal")}
          </button>
        </div>
      }
    >
      <p className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-500">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        الحد الأدنى للشحن بالبطاقة: 15 USD — البوابة تخضع للصيانة المؤقتة، يرجى استخدام التحويل
        المباشر عبر USDT كريبتو
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="glow lg:col-span-1">
          <p className="text-sm text-muted-foreground">
            {tr("الرصيد المتاح", "Available balance")}
          </p>
          <p className="mt-1 text-4xl font-black text-primary" dir="ltr">
            {usdt2(balance)}
          </p>
          <p className="text-sm text-muted-foreground">USDT</p>
          <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
            <p>
              {tr("محجوز في الضمان", "Held in escrow")}:{" "}
              <span className="font-bold text-foreground" dir="ltr">
                {usdt2(locked)} USDT
              </span>
            </p>
            <p>
              {tr("إجمالي الأرباح", "Lifetime earned")}:{" "}
              <span className="font-bold text-accent" dir="ltr">
                {usdt2(wallet.data?.lifetime_earned)} USDT
              </span>
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {Object.entries(rates).map(([c, r]) => (
              <div
                key={c}
                title={tr(RATE_HINT[c]?.[0] ?? c, RATE_HINT[c]?.[1] ?? c)}
                className="cursor-help rounded-lg border border-border px-3 py-2"
              >
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  {c} <Info className="size-3 opacity-60" />
                </span>
                <p className="font-semibold" dir="ltr">
                  ≈ {(balance * r).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
          <p
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${
              profile.data?.is_verified
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/40 bg-amber-500/10 text-amber-500"
            }`}
          >
            <BadgeCheck className="size-3.5" />
            {profile.data?.is_verified
              ? tr("حساب موثق — سحب فوري مفعّل", "Verified account — instant withdrawal enabled")
              : tr(
                  "حساب غير موثق — السحب يخضع للمراجعة والجدولة",
                  "Unverified account — withdrawals are reviewed and scheduled",
                )}
          </p>

          {lockHours > 0 && (
            <p className="mt-3 inline-flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-500">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              {tr(
                `السحب مجمد مؤقتاً لمدة ${lockHours} ساعة بعد إجراء تعديل أمني على حسابك.`,
                `Withdrawals are temporarily locked for ${lockHours} more hour(s) after a recent security change.`,
              )}
            </p>
          )}
          <div className="mt-4 border-t border-border pt-4">
            <label className="grid gap-2 text-xs font-bold text-muted-foreground">
              {tr("عنوان السحب المحفوظ", "Saved payout address")}
              <input
                value={payoutAddress}
                onChange={(e) => setPayoutAddress(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                dir="ltr"
                maxLength={64}
                placeholder="T… / 0x…"
                className="field-lux w-full px-3 py-2 text-foreground"
              />
            </label>
            <button
              type="button"
              onClick={() => savePayout.mutate(payoutAddress.trim())}
              disabled={savePayout.isPending || !user || !payoutAddress.trim()}
              className="mt-2 w-full rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-xs font-bold text-primary disabled:opacity-50"
            >
              {savePayout.isPending
                ? tr("جارٍ الحفظ...", "Saving...")
                : tr("حفظ العنوان", "Save address")}
            </button>
          </div>
        </Card>

        <Card id="withdraw-card" className="lg:col-span-2">
          <h3 className="flex items-center gap-2 font-bold">
            <ArrowUpFromLine className="size-4 text-accent" /> {tr("طلب سحب", "Withdrawal request")}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 font-bold uppercase text-accent">
              {tier}
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Timer className="size-3.5" />
              {tr(`المعالجة الآلية خلال ${sla} ساعة`, `AI processing within ${sla} hours`)}
            </span>
          </div>

          {frozen && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <ShieldAlert className="size-4" />
              {tr(
                "الحساب مجمّد أمنياً — السحب معطّل حتى مراجعة الإدارة.",
                "Account frozen for security — withdrawals are disabled pending admin review.",
              )}
            </p>
          )}

          <div className="mt-4 grid gap-2">
            <p className="text-xs font-bold text-muted-foreground">
              {tr(
                "مُحسِّن رسوم الشبكة (Gas Optimizer) — اختر الشبكة الأوفر",
                "Network gas optimizer — pick the cheapest route",
              )}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {gasRows.map((g) => {
                const selected = network === g.value;
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setNetwork(g.value as WithdrawalNetwork)}
                    aria-pressed={selected}
                    className={`grid min-w-0 gap-1 rounded-xl border px-3 py-2.5 text-start transition-colors ${
                      selected
                        ? "border-primary bg-primary/15"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-black">{g.label}</span>
                      {g.tone === "best" && (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-black text-primary-foreground">
                          {tr("موصى بها · رسوم فائقة الانخفاض ⚡", "Recommended · ultra-low ⚡")}
                        </span>
                      )}
                      {g.tone === "high" && (
                        <span className="rounded-full border border-destructive/50 px-1.5 py-0.5 text-[9px] font-black text-destructive">
                          {tr("رسوم أعلى", "Higher fee")}
                        </span>
                      )}
                    </span>
                    <span
                      className={`font-mono text-[11px] font-bold ${g.tone === "best" ? "text-primary" : "text-muted-foreground"}`}
                      dir="ltr"
                    >
                      ≈ {g.fee.toFixed(3)} USDT
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {tr(g.etaAr, g.etaEn)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-muted-foreground">{tr("الشبكة", "Network")}</span>
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value as WithdrawalNetwork)}
                className="field-lux  px-3 py-2 outline-none focus:border-primary"
              >
                {networks.map((n) => (
                  <option key={n.value} value={n.value}>
                    {n.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-muted-foreground">
                {tr(
                  `المبلغ (USDT) — الحد الأدنى ${MIN_WITHDRAWAL}`,
                  `Amount (USDT) — min ${MIN_WITHDRAWAL}`,
                )}
              </span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                maxLength={16}
                className="field-lux  px-3 py-2 outline-none focus:border-primary"
              />
            </label>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {tr(
                "سيُرسل السحب إلى عنوان السحب المحفوظ في بطاقة الرصيد.",
                "The withdrawal will be sent to the payout address saved in the balance card.",
              )}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/60 p-4 text-sm">
            <span className="text-muted-foreground">
              {tr("الرسوم:", "Fee:")}{" "}
              <span className="text-foreground" dir="ltr">
                {usdt2(WITHDRAWAL_FEE)} USDT
              </span>
              {" · "}
              {tr("الصافي:", "Net:")}{" "}
              <span className="text-foreground" dir="ltr">
                {usdt2(Math.max(0, parsed - WITHDRAWAL_FEE))} USDT
              </span>
            </span>
            <button
              onClick={submit}
              disabled={withdraw.isPending || frozen || lockHours > 0 || !legalAck}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-60"
            >
              {withdraw.isPending && <Loader2 className="size-4 animate-spin" />}
              {withdraw.isPending
                ? tr("بانتظار التأكيد…", "Pending confirmation…")
                : tr("تأكيد السحب", "Confirm withdrawal")}
            </button>
          </div>

          <label className="mt-3 flex items-start gap-2 rounded-xl border border-border/70 bg-surface-2/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <input
              type="checkbox"
              checked={legalAck}
              onChange={(e) => setLegalAck(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>
              {tr(
                "أقر بأن الأموال المسحوبة ناتجة عن نشاط اقتصادي حقيقي على المنصة، وأوافق على تطبيق رسوم مكافحة خلط الأموال بنسبة 5% على أي جزء من مبلغ الإيداع الكريبتو لم يدخل ضمان أي طلب (البند 2 من الشروط).",
                "I confirm the withdrawn funds stem from real on-platform economic activity and I accept the 5% anti-mixing surcharge on any portion of crypto-deposit funds that never entered escrow (Terms §2).",
              )}
            </span>
          </label>
          {feedback && <p className="mt-3 text-xs text-primary">{feedback}</p>}
          <p className="mt-3 text-xs text-muted-foreground">
            {tr(
              "الطلبات ذات درجة خطورة مرتفعة تُحال تلقائياً لمراجعة بشرية، وتُحجز الأموال حتى إتمام التحويل.",
              "High risk-score requests are routed automatically to human review; funds stay locked until payout completes.",
            )}
          </p>
          <p className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {tr(
              "إشعار ضريبي: المنصة لا تقتطع أي ضرائب، ويتحمل المستخدم وحده مسؤولية الإفصاح عن أرباحه وسداد أي التزامات ضريبية وفق قوانين بلد إقامته.",
              "Tax notice: the platform withholds no taxes. You are solely responsible for declaring your earnings and settling any tax obligations under the laws of your country of residence.",
            )}
          </p>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <RedeemPassCard />
        <ReferralWidget />
      </div>

      <Card className="mt-6">
        <h3 className="flex items-center gap-2 font-bold">
          <Lock className="size-4 text-accent" /> {tr("قائمة طلبات السحب", "Withdrawal queue")}
        </h3>
        <div className="mt-4 grid gap-3">
          {(requests.data ?? []).length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {tr("لا توجد طلبات سحب.", "No withdrawal requests yet.")}
            </p>
          )}
          {(requests.data ?? []).map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4 text-sm"
            >
              <div className="min-w-40">
                <p className="font-semibold" dir="ltr">
                  {usdt2(r.amount_usdt)} USDT · {r.network}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <span className="rounded-lg border border-border px-2.5 py-1 text-xs">
                {r.status}
              </span>
              <span className="text-xs text-muted-foreground">
                {tr("درجة الخطورة", "Risk score")}: {Number(r.risk_score)}
              </span>
              {r.process_by && (
                <span className="ms-auto text-xs text-muted-foreground">
                  {tr("المعالجة قبل", "Process by")} {new Date(r.process_by).toLocaleString()}
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-6">
        <h3 className="font-bold">{tr("سجل المعاملات", "Transaction history")}</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-start text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                {[
                  tr("النوع", "Type"),
                  tr("الشبكة", "Network"),
                  tr("المبلغ", "Amount"),
                  tr("الحالة", "Status"),
                  tr("التاريخ", "Date"),
                  tr("الإيصال", "Receipt"),
                ].map((h) => (
                  <th key={h} className="py-2 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(txs.data ?? []).map((t) => (
                <tr key={t.id} className="border-b border-border/60 last:border-0">
                  <td className="py-3">{t.type}</td>
                  <td className="text-muted-foreground">{t.network ?? tr("داخلي", "Internal")}</td>
                  <td
                    className={
                      Number(t.amount) >= 0
                        ? "font-semibold text-primary"
                        : "font-semibold text-destructive"
                    }
                  >
                    {Number(t.amount) > 0 ? "+" : ""}
                    {usdt2(t.amount)} USDT
                  </td>
                  <td className="text-muted-foreground">{t.status}</td>
                  <td className="text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        setReceipt({
                          txId: t.id,
                          type: String(t.type),
                          network: t.network ?? tr("داخلي", "Internal"),
                          gateway: t.network ? `USDT · ${t.network}` : "USDT",
                          amount: `${usdt2(t.amount)} USDT`,
                          status: String(t.status),
                          date: new Date(t.created_at).toLocaleString(),
                        })
                      }

                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold hover:border-primary hover:text-primary"
                    >
                      <FileText className="size-3.5" /> {tr("عرض الإيصال 📄", "View receipt 📄")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!txs.isLoading && (txs.data ?? []).length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {tr("لا توجد معاملات بعد.", "No transactions yet.")}
            </p>
          )}
        </div>
      </Card>

      {topUp && <TopUpDialog onClose={() => setTopUp(false)} />}

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </Section>
  );
}
