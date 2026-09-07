import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Info, ShieldAlert, Users, CheckCircle2, Wallet2, Clock, X } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useProfile, useReferrals } from "@/lib/queries";

export const Route = createFileRoute("/referrals")({
  head: () => ({
    meta: [
      { title: "مركز الإحالة والعمولات | المُنجِز" },
      { name: "description", content: "تتبع رابط الإحالة الفريد، أرباح العمولات لمدة 12 شهراً، وسجل الإحالات مع الشروط القانونية الكاملة." },
      { property: "og:title", content: "مركز الإحالة والعمولات | المُنجِز" },
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
  const profile = useProfile();
  const data = useReferrals();
  const [terms, setTerms] = useState(false);

  const loading = data.isLoading || profile.isLoading;
  const code = (profile.data as { referral_code?: string } | null)?.referral_code ?? "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const refLink = code ? `${origin}/auth?ref=${code}` : "";

  const referrals = data.data?.referrals ?? [];
  const commissions = data.data?.commissions ?? [];

  const kpis = useMemo(() => {
    const total = commissions.reduce((s, c) => s + Number(c.commission_usdt ?? 0), 0);
    return {
      joined: referrals.length,
      active: referrals.filter((r) => r.is_active).length,
      total,
      lifetime: referrals.reduce((s, r) => s + Number(r.total_earned_usdt ?? 0), 0),
    };
  }, [referrals, commissions]);

  const copy = async () => {
    if (!refLink) return;
    try {
      await navigator.clipboard.writeText(refLink);
      toast.success(tr("تم نسخ رابط الإحالة", "Referral link copied"));
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
              <input
                readOnly
                value={refLink || tr("سجّل الدخول لإنشاء رابطك", "Sign in to generate your link")}
                dir="ltr"
                aria-label={tr("رابط الإحالة", "Affiliate link")}
                onFocus={(e) => e.currentTarget.select()}
                className="field-lux min-w-0 overflow-x-auto px-3 py-2.5 font-mono text-[11px] text-accent sm:text-xs"
              />
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
              لكل بائع رابط إحالة فريد واحد، ويتم تثبيت المشتري بحسابك بشكل دائم ونهائي فور إتمام التسجيل.
            </p>
          </Card>

          <div className="flex items-start gap-2 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-xs leading-relaxed text-accent">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>
              تنبيه مالي وقانوني: يستفيد المُحيل من عمولة الإحالة على مشتريات المستخدم لمدة 12 شهراً فقط من تاريخ التسجيل
              (20% ترويجية خلال أول 30 يوماً، ثم 10% للأشهر الـ 11 المتبقية). تُقتطع كافة العمولات حصراً من صافي أرباح
              المنصة؛ وإذا كان ربح المنصة 0%، تكون العمولة 0 USDT تلقائياً دون أي مساس بمستحقات البائع.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Users, label: tr("إجمالي المسجلين", "Total joined"), value: kpis.joined.toString(), tone: "text-foreground" },
              { icon: CheckCircle2, label: tr("الإحالات النشطة", "Active referrals"), value: kpis.active.toString(), tone: "text-foreground" },
              { icon: Wallet2, label: tr("إجمالي العمولات (USDT)", "Total commissions (USDT)"), value: kpis.total.toFixed(2), tone: "text-primary" },
              { icon: Clock, label: tr("الأرباح التراكمية (USDT)", "Lifetime earnings (USDT)"), value: kpis.lifetime.toFixed(2), tone: "text-accent" },
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
  const items = [
    ["مدة الاستحقاق", "12 شهراً (365 يوماً) فقط من تاريخ تسجيل المشتري، وتسقط بعدها العمولة تلقائياً وتعود للمنصة."],
    ["حظر الإحالات الذاتية", "يُحظر إنشاء حسابات متعددة من نفس الجهاز أو الشبكة، مع تجميد فوري للرصيد عند المخالفة."],
    ["أحادية الارتباط", "يتم تثبيت المشتري برابط بائع واحد للأبد دون إمكانية التبديل."],
    ["فترات الضمان", "تخضع كافة أرباح الإحالة لفترة حجز الضمان (Escrow) والتحقق قبل الإفراج المالي."],
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
