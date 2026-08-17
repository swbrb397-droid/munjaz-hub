import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Info, ShieldAlert, Users, CheckCircle2, Wallet2, Clock, X } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";

export const Route = createFileRoute("/referrals")({
  head: () => ({
    meta: [
      { title: "مركز الإحالة والعمولات | الـمُـنْـجِـز" },
      { name: "description", content: "تتبع رابط الإحالة الفريد، أرباح العمولات لمدة 12 شهراً، وسجل الإحالات مع الشروط القانونية الكاملة." },
      { property: "og:title", content: "مركز الإحالة والعمولات | الـمُـنْـجِـز" },
      { property: "og:description", content: "20% ترويجية أول 30 يوماً ثم 10% للأشهر المتبقية — من صافي أرباح المنصة فقط." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReferralHub,
});

const REF_LINK = "https://munjaz.com/register?ref=MUNJAZ_PRO_492";

type Row = {
  date: string;
  buyer: string;
  asset: "خدمة" | "منتج" | "دورة";
  amount: number;
  rate: 20 | 10;
  daysLeft: number;
  commission: number;
  status: "completed" | "escrow";
};

const ROWS: Row[] = [
  { date: "2026-08-02", buyer: "usr_***98", asset: "خدمة", amount: 420, rate: 20, daysLeft: 350, commission: 8.4, status: "completed" },
  { date: "2026-07-21", buyer: "usr_***41", asset: "دورة", amount: 150, rate: 20, daysLeft: 332, commission: 3.0, status: "escrow" },
  { date: "2026-05-11", buyer: "usr_***07", asset: "منتج", amount: 90, rate: 10, daysLeft: 268, commission: 0.9, status: "completed" },
  { date: "2026-03-04", buyer: "usr_***23", asset: "خدمة", amount: 1200, rate: 10, daysLeft: 200, commission: 12.0, status: "escrow" },
];

function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-secondary ${className}`} />;
}

function ReferralHub() {
  const { tr } = useLang();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [terms, setTerms] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setRows(ROWS);
      setLoading(false);
    }, 700);
    return () => clearTimeout(t);
  }, []);

  const kpis = useMemo(() => {
    const available = rows.filter((r) => r.status === "completed").reduce((s, r) => s + r.commission, 0);
    const pending = rows.filter((r) => r.status === "escrow").reduce((s, r) => s + r.commission, 0);
    return { joined: rows.length, completed: rows.filter((r) => r.status === "completed").length, available, pending };
  }, [rows]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(REF_LINK);
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
                value={REF_LINK}
                dir="ltr"
                aria-label={tr("رابط الإحالة", "Affiliate link")}
                className="min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-muted-foreground"
              />
              <button
                type="button"
                onClick={copy}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground"
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
              { icon: CheckCircle2, label: tr("الطلبات المكتملة", "Completed orders"), value: kpis.completed.toString(), tone: "text-foreground" },
              { icon: Wallet2, label: tr("الأرباح المتاحة (USDT)", "Available earnings (USDT)"), value: kpis.available.toFixed(2), tone: "text-primary" },
              { icon: Clock, label: tr("الأرباح المعلقة في الضمان (USDT)", "Pending in escrow (USDT)"), value: kpis.pending.toFixed(2), tone: "text-accent" },
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
              <p className="min-w-0 truncate font-bold">{tr("سجل الإحالات", "Referral activity log")}</p>
              <button
                type="button"
                onClick={() => setTerms(true)}
                className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
              >
                {tr("عرض الشروط والأحكام الخاصة بنظام الإحالة", "Referral terms")}
              </button>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[880px] text-right text-xs">
                <thead className="bg-secondary/60 text-muted-foreground">
                  <tr>
                    {["تاريخ التسجيل", "معرف المشتري", "الأصل المشترى", "قيمة الصفقة", "النسبة المطبقة", "المتبقي من 12 شهراً", "قيمة العمولة", "حالة العمولة"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading &&
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-t border-border">
                        {Array.from({ length: 8 }).map((__, j) => (
                          <td key={j} className="px-4 py-3"><Skel className="h-4 w-16" /></td>
                        ))}
                      </tr>
                    ))}
                  {!loading &&
                    rows.map((r) => (
                      <tr key={r.buyer} className="border-t border-border">
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{r.date}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono">{r.buyer}</td>
                        <td className="whitespace-nowrap px-4 py-3">{r.asset}</td>
                        <td className="whitespace-nowrap px-4 py-3">{r.amount} USDT</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 ${r.rate === 20 ? "bg-accent/15 text-accent" : "bg-secondary text-muted-foreground"}`}>
                            {r.rate === 20 ? "20% ترويجي" : "10% أساسي"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{r.daysLeft} يوم</td>
                        <td className="whitespace-nowrap px-4 py-3 font-bold text-primary">{r.commission.toFixed(2)}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 ${r.status === "completed" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
                            {r.status === "completed" ? "مكتملة" : "معلقة في الضمان"}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {!loading && rows.length === 0 && (
              <div className="grid place-items-center gap-2 px-4 py-14 text-center">
                <Users className="size-8 text-muted-foreground" />
                <p className="font-bold">{tr("لا توجد إحالات بعد", "No referrals yet")}</p>
                <p className="text-xs text-muted-foreground">{tr("شارك رابطك الفريد لتبدأ بجمع العمولات.", "Share your unique link to start earning.")}</p>
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
