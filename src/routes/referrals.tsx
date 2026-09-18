import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useEnsureReferralCode } from "@/lib/referral-code";
import { toast } from "sonner";
import { CheckCircle2, Copy, Info, Percent, ShieldAlert, Users, Lock, Wallet2, Clock, X } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useProfile, useReferrals } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/referrals")({
  head: () => ({
    meta: [
      { title: "مركز الإحالة والعمولات | المنجز" },
      { name: "description", content: "تتبع رابط الإحالة الفريد، أرباح العمولات لمدة 12 شهراً، وسجل الإحالات مع الشروط القانونية الكاملة." },
      { property: "og:title", content: "مركز الإحالة والعمولات | المنجز" },
      { property: "og:description", content: "20% ترويجية أول 30 يوماً ثم 10% للأشهر المتبقية — من صافي أرباح المنصة فقط." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReferralHub,
});

function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-secondary ${className}`} />;
}

function ReferralHub() {
  const { tr } = useLang();
  const { user } = useAuth();
  const profile = useProfile();
  const data = useReferrals();
  const [terms, setTerms] = useState(false);

  const loading = data.isLoading || profile.isLoading;
  const storedCode = (profile.data as { referral_code?: string } | null)?.referral_code ?? "";
  const code = useEnsureReferralCode(storedCode, profile.isSuccess || profile.isError);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const refLink = code ? `${origin}/?ref=${code}` : "";

  const referrals = data.data?.referrals ?? [];
  const commissions = data.data?.commissions ?? [];

  const kpis = useMemo(() => {
    // Every row in referral_commissions is already settled from a realised NET
    // platform fee (Commission = NetPlatformFee × Rate) — those are available.
    // Anything accrued on the referral but not yet settled is still escrow-held.
    const available = commissions.reduce((s, c) => s + Number(c.commission_usdt ?? 0), 0);
    const lifetime = referrals.reduce((s, r) => s + Number(r.total_earned_usdt ?? 0), 0);
    const escrowLocked = Math.max(0, lifetime - available);
    const now = Date.now();
    const daysLeft = referrals
      .map((r) => Math.ceil((new Date(r.expires_at).getTime() - now) / 86_400_000))
      .filter((d) => d > 0);
    return {
      joined: referrals.length,
      active: referrals.filter((r) => r.is_active).length,
      available,
      escrowLocked,
      lifetime,
      cycleDaysLeft: daysLeft.length ? Math.max(...daysLeft) : 0,
    };
  }, [referrals, commissions]);

  const copy = async () => {
    if (!refLink) return;
    try {
      await navigator.clipboard.writeText(refLink);
      toast.success(tr("تم نسخ رابط الإحالة بنجاح", "Referral link copied successfully"));
    } catch {
      toast.error(tr("تعذّر النسخ", "Copy failed"));
    }
  };

  return (
    <div className="overflow-x-hidden">
      <Section
        title={tr("مركز الإحالة والعمولات", "Referral & affiliate hub")}
        subtitle={tr("رابط واحد فريد لكل بائع — وعمولة لمدة 12 شهراً من صافي أرباح المنصة.", "One unique link per seller — 12 months of commission from net platform profit.")}
      >
        <div className="grid gap-4">
          <Card>
            <p className="mb-3 text-sm font-bold">{tr("رابط الإحالة الفريد", "Unique affiliate link")}</p>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <div className="field-lux min-w-0 overflow-x-auto px-3 py-2.5" dir="ltr">
                <p className="whitespace-nowrap font-mono text-[11px] text-accent sm:text-xs">
                  {refLink || tr("سجّل الدخول لإنشاء رابطك", "Sign in to generate your link")}
                </p>
              </div>
              <button
                type="button"
                onClick={copy}
                disabled={!refLink}
                className="chip chip-hover shrink-0 !text-primary disabled:opacity-50"
              >
                <Copy className="size-4" /> {tr("نسخ الرابط", "Copy link")}
              </button>
            </div>

            <p className="mt-3 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs leading-relaxed text-primary">
              <Info className="mt-0.5 size-4 shrink-0" />
              {tr(
                "لكل بائع رابط إحالة فريد واحد، ويتم تثبيت المشتري بحسابك بشكل دائم ونهائي فور إتمام التسجيل.",
                "Each seller has one unique referral link, and a buyer is permanently attributed to your account as soon as they sign up.",
              )}
            </p>
          </Card>

          <div className="rounded-lg border border-accent/40 bg-accent/10 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-accent">
              <ShieldAlert className="size-4 shrink-0" />
              {tr("تنبيه مالي وقانوني", "Financial and legal notice")}
            </p>
            <ul className="mt-3 grid gap-3 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2">
              <li className="flex items-start gap-2">
                <Clock className="mt-0.5 size-4 shrink-0 text-accent" />
                {tr("الاستحقاق لمدة 365 يوماً: 20% لأول 30 يوماً، ثم 10% للأشهر الـ11 التالية.", "Eligibility lasts 365 days: 20% for the first 30 days, then 10% for the next 11 months.")}
              </li>
              <li className="flex items-start gap-2">
                <Percent className="mt-0.5 size-4 shrink-0 text-accent" />
                {tr("العمولة = صافي رسوم المنصة × النسبة، وإذا كانت الرسوم صفراً فالعمولة 0.00 USDT.", "Commission equals net platform fee × rate; zero fees produce 0.00 USDT commission.")}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                {tr("لا تمس عمولة الإحالة مستحقات البائع أو قيمة الطلب.", "Referral commission never reduces the seller's proceeds or order value.")}
              </li>
              <li className="flex items-start gap-2">
                <Lock className="mt-0.5 size-4 shrink-0 text-accent" />
                {tr("مشتريات باقات Pro وCorporate مستثناة من احتساب العمولات.", "Pro and Corporate plan purchases are excluded from commissions.")}
              </li>
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Users, label: tr("إجمالي المسجلين", "Total joined"), value: kpis.joined.toString(), tone: "text-foreground" },
              { icon: Wallet2, label: tr("أرباح الإحالة المتاحة (USDT)", "Available referral earnings (USDT)"), value: kpis.available.toFixed(2), tone: "text-primary" },
              { icon: Lock, label: tr("أرباح قيد حجز الضمان (USDT)", "Escrow-locked earnings (USDT)"), value: kpis.escrowLocked.toFixed(2), tone: "text-accent" },
              {
                icon: Clock,
                label: tr("دورة الاستحقاق (365 يوماً)", "Eligibility cycle (365 days)"),
                value: kpis.cycleDaysLeft ? `${kpis.cycleDaysLeft} ${tr("يوماً", "days")}` : tr("لا توجد دورة نشطة", "No active cycle"),
                tone: "text-foreground",
              },
            ].map((k) => (
              <Card key={k.label}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <k.icon className="size-4 shrink-0" />
                  <span className="min-w-0 truncate">{k.label}</span>
                </div>
                {loading ? <Skel className="mt-3 h-8 w-24" /> : <p className={`mt-2 text-3xl font-black ${k.tone}`}>{k.value}</p>}
              </Card>
            ))}
          </div>

          <Card className="p-0">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border p-5">
              <p className="min-w-0 truncate font-bold">{tr("سجل العمولات", "Commission log")}</p>
              <button
                type="button"
                onClick={() => setTerms(true)}
                className="chip chip-hover shrink-0"
              >
                {tr("شروط نظام الإحالة", "Referral terms")}
              </button>
            </div>

            {loading ? (
              <div className="grid gap-2 p-5">
                {[0, 1, 2].map((i) => <Skel key={i} className="h-10 w-full" />)}
              </div>
            ) : commissions.length === 0 ? (
              <div className="grid place-items-center gap-2 px-4 py-14 text-center">
                <Users className="size-8 text-muted-foreground" />
                <p className="font-bold">{tr("لا توجد إحالات بعد", "No referrals yet")}</p>
                <p className="text-xs text-muted-foreground">{tr("شارك رابطك الفريد لتبدأ بجمع العمولات.", "Share your unique link to start earning.")}</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[560px] text-right text-xs">
                  <thead className="bg-secondary/60 text-muted-foreground">
                    <tr>
                      {[tr("التاريخ", "Date"), tr("رسوم المنصة", "Platform fee"), tr("قيمة العمولة", "Commission"), tr("الطلب", "Order")].map((h) => (
                        <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((c) => (
                      <tr key={c.id} className="border-t border-border">
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                        <td className="whitespace-nowrap px-4 py-3">{Number(c.platform_fee_usdt).toFixed(2)} USDT</td>
                        <td className="whitespace-nowrap px-4 py-3 font-bold text-primary">{Number(c.commission_usdt).toFixed(2)}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-muted-foreground">{c.order_id ? String(c.order_id).slice(0, 8) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </Section>

      {terms && <TermsModal onClose={() => setTerms(false)} />}
    </div>
  );
}

function TermsModal({ onClose }: { onClose: () => void }) {
  const { tr } = useLang();
  const items: Array<[string, string]> = [
    [
      tr("مدة الاستحقاق", "Eligibility period"),
      tr(
        "12 شهراً (365 يوماً) فقط من تاريخ تسجيل المشتري، وتسقط بعدها العمولة تلقائياً وتعود للمنصة.",
        "12 months (365 days) from the buyer's sign-up date; afterwards the commission lapses automatically and returns to the platform.",
      ),
    ],
    [
      tr("حظر الإحالات الذاتية", "No self-referrals"),
      tr(
        "يُحظر إنشاء حسابات متعددة من نفس الجهاز أو الشبكة، مع تجميد فوري للرصيد عند المخالفة.",
        "Creating multiple accounts from the same device or network is prohibited; balances are frozen immediately on violation.",
      ),
    ],
    [
      tr("أحادية الارتباط", "Single attribution"),
      tr(
        "يتم تثبيت المشتري برابط بائع واحد للأبد دون إمكانية التبديل.",
        "A buyer is permanently attributed to one seller's link and cannot be switched.",
      ),
    ],
    [
      tr("فترات الضمان", "Escrow periods"),
      tr(
        "تخضع كافة أرباح الإحالة لفترة حجز الضمان (Escrow) والتحقق قبل الإفراج المالي.",
        "All referral earnings are subject to the escrow hold and verification before payout.",
      ),
    ],
  ];
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-background/80 p-4 backdrop-blur" role="dialog" aria-modal="true">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="min-w-0 truncate text-lg font-black">{tr("شروط وأحكام نظام الإحالة", "Referral terms & conditions")}</h2>
          <button type="button" onClick={onClose} aria-label={tr("إغلاق", "Close")} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border">
            <X className="size-4" />
          </button>
        </div>
        <ol className="mt-4 grid gap-3 text-sm">
          {items.map(([t, d], i) => (
            <li key={t} className="rounded-xl border border-border bg-secondary/40 p-3">
              <p className="font-bold text-primary">{i + 1}. {t}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">
          {tr("فهمت وأوافق", "I understand")}
        </button>
      </div>
    </div>
  );
}
