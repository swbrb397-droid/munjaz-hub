import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  FlaskConical,
  Gavel,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useDisputes, useOrders, useRoles } from "@/lib/queries";
import { supabase } from "@/lib/cloud-client";
import {
  logSecurityEvent,
  useResolveWithdrawal,
  useSecurityIncidents,
  useSetAccountFrozen,
  useWithdrawalQueue,
} from "@/lib/withdrawals";
import { formatUsdt } from "@/lib/security";
import { toast } from "sonner";
import {
  useAdminDisputes,
  useResolveDispute,
  vaultUrl,
  type AdminDispute,
} from "@/lib/admin-cases";
import { useAdminOverview, useSandboxAction, type SandboxKind } from "@/lib/admin-ops";
import { useKycSubmissions, useReviewKyc } from "@/lib/kyc";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "لوحة الإدارة | المنجز" },
      { name: "description", content: "إدارة النزاعات، مركز توثيق الهوية (KYC)، وتحليلات إيرادات المنصة بعملة USDT." },
      { property: "og:title", content: "لوحة الإدارة | المنجز" },
      { property: "og:description", content: "قائمة النزاعات، طلبات التوثيق، ومؤشرات الإيرادات في مكان واحد." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { tr } = useLang();
  const qc = useQueryClient();
  const roles = useRoles();
  const isAdmin = (roles.data ?? []).includes("admin");

  const disputes = useDisputes();
  const kyc = useKycSubmissions(isAdmin, "pending");
  const reviewKyc = useReviewKyc();
  const overview = useAdminOverview(isAdmin);
  const orders = useOrders();
  const payouts = useWithdrawalQueue(isAdmin);
  const incidents = useSecurityIncidents(isAdmin);
  const resolvePayout = useResolveWithdrawal();
  const setFrozen = useSetAccountFrozen();

  // Security sentinel: record unauthorized attempts to reach the admin area.
  useEffect(() => {
    if (roles.isLoading || roles.data === undefined || isAdmin) return;
    void logSecurityEvent("admin_access_attempt", "Non-admin user opened the admin dashboard");
  }, [roles.isLoading, roles.data, isAdmin]);

  const tabs = [
    { key: "disputes", label: tr("النزاعات", "Disputes"), icon: Gavel },
    { key: "payouts", label: tr("السحوبات", "Payouts"), icon: Banknote },
    { key: "security", label: tr("الأمن", "Security"), icon: ShieldAlert },
    { key: "kyc", label: tr("التوثيق", "KYC"), icon: ShieldCheck },
    { key: "revenue", label: tr("الإيرادات", "Revenue"), icon: TrendingUp },
    { key: "sandbox", label: tr("مختبر الاختبار", "Test sandbox"), icon: FlaskConical },
  ] as const;

  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("disputes");

  const resolveCase = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "resolved" | "rejected" }) => {
      const { error } = await supabase
        .from("dispute_cases")
        .update({ status, resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["disputes"] }),
  });


  const rows = orders.data ?? [];
  const volume = rows.reduce((s, o) => s + Number(o.amount_usdt ?? 0), 0);
  const fees = rows.reduce((s, o) => s + Number(o.platform_fee_usdt ?? 0), 0);
  const disputeRate = rows.length ? ((disputes.data?.length ?? 0) / rows.length) * 100 : 0;

  if (roles.isLoading) {
    return <Section title={tr("لوحة الإدارة", "Admin Dashboard")}><Card>{tr("جارٍ التحقق من الصلاحيات…", "Checking permissions…")}</Card></Section>;
  }

  if (!isAdmin) {
    return (
      <Section title={tr("لوحة الإدارة", "Admin Dashboard")} subtitle={tr("صلاحيات محدودة", "Restricted access")}>
        <Card>
          <p className="text-sm text-muted-foreground">
            {tr("هذه اللوحة مخصّصة لمشرفي المنصة فقط.", "This dashboard is restricted to platform administrators.")}
          </p>
        </Card>
      </Section>
    );
  }

  return (
    <Section title={tr("لوحة الإدارة", "Admin Dashboard")} subtitle={tr("تشغيل المنصة والرقابة والتحليلات", "Platform operations, oversight, and analytics")}>
      <Card className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${tab === t.key ? "bg-primary font-bold text-primary-foreground" : "border border-border text-muted-foreground"}`}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
        <Link
          to="/admin/audit"
          className="ms-auto inline-flex items-center gap-2 rounded-lg border border-primary/50 bg-primary/10 px-4 py-2 text-sm font-bold text-primary"
        >
          <ScrollText className="size-4" /> {tr("سجل التدقيق", "Audit log")}
        </Link>
      </Card>


      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          [tr("إجمالي المستخدمين", "Registered users"), String(overview.data?.totalUsers ?? 0)],
          [tr("طلبات توثيق معلّقة", "Pending KYC requests"), String(overview.data?.pendingKyc ?? 0)],
          [tr("أموال محجوزة في الضمان", "Funds in escrow"), `${formatUsdt(overview.data?.escrowLocked ?? 0)} USDT`],
          [
            tr("إجمالي الإيداعات المكتملة", "Completed deposits"),
            `${formatUsdt(overview.data?.depositsTotal ?? 0)} USDT · ${overview.data?.depositsCount ?? 0}`,
          ],
          [tr("نزاعات مفتوحة", "Open disputes"), String(overview.data?.openDisputes ?? 0)],
          [tr("طلبات سحب قيد المعالجة", "Pending withdrawals"), String(overview.data?.pendingWithdrawals ?? 0)],
        ].map(([label, value]) => (
          <Card key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-black text-primary" dir="ltr">
              {overview.isLoading ? "0" : value}
            </p>
          </Card>
        ))}
      </div>

      {tab === "disputes" && <DisputeDesk isAdmin={isAdmin} />}

      {tab === "payouts" && (
        <Card>
          <h3 className="font-bold">{tr("قائمة معالجة السحوبات", "Withdrawal processing queue")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {tr(
              "الوكيل الآلي يعتمد طلبات Pro/Corporate خلال 12 ساعة، والمجاني خلال 48 ساعة، ويحوّل الطلبات المشبوهة للمراجعة البشرية.",
              "The AI agent auto-approves Pro/Corporate within 12h, free tier within 48h, and routes suspicious requests to human review.",
            )}
          </p>
          <div className="mt-4 grid gap-3">
            {(payouts.data ?? []).length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {tr("لا توجد طلبات سحب.", "No withdrawal requests.")}
              </p>
            )}
            {(payouts.data ?? []).map((w) => (
              <div key={w.id} className="grid gap-3 rounded-xl border border-border p-4 text-sm md:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-semibold">
                    {formatUsdt(w.amount_usdt)} USDT · {w.network} · <span className="uppercase text-accent">{w.tier}</span>
                  </p>
                  <p className="break-all text-xs text-muted-foreground">{w.address}</p>
                  <p className="mt-1 text-xs">
                    <span className={Number(w.risk_score) >= 50 ? "font-bold text-destructive" : "text-muted-foreground"}>
                      {tr("درجة الخطورة", "Risk")}: {Number(w.risk_score)}
                    </span>
                    {" · "}
                    <span className="text-muted-foreground">{w.status}</span>
                    {" · SLA "}{w.sla_hours}h
                  </p>
                  {Array.isArray(w.risk_flags) && w.risk_flags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(w.risk_flags as string[]).map((f) => (
                        <span key={f} className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{f}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <button
                    disabled={resolvePayout.isPending || w.status === "paid" || w.status === "rejected"}
                    onClick={() => resolvePayout.mutate({ id: w.id, action: "approve" })}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {tr("اعتماد", "Approve")}
                  </button>
                  <button
                    disabled={resolvePayout.isPending || w.status === "paid" || w.status === "rejected"}
                    onClick={() => resolvePayout.mutate({ id: w.id, action: "pay" })}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {tr("تم الدفع", "Mark paid")}
                  </button>
                  <button
                    disabled={resolvePayout.isPending || w.status === "paid" || w.status === "rejected"}
                    onClick={() => resolvePayout.mutate({ id: w.id, action: "reject" })}
                    className="rounded-lg border border-destructive/50 px-3 py-1.5 text-xs text-destructive disabled:opacity-50"
                  >
                    {tr("رفض وإرجاع", "Reject & refund")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "security" && (
        <Card>
          <h3 className="font-bold">{tr("حارس الأمن — سجل الحوادث", "Security sentinel — incident log")}</h3>
          <div className="mt-4 grid gap-3">
            {(incidents.data ?? []).length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {tr("لا توجد حوادث أمنية.", "No security incidents.")}
              </p>
            )}
            {(incidents.data ?? []).map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4 text-sm">
                <div className="min-w-56">
                  <p className="font-semibold">{i.kind} · <span className="uppercase text-destructive">{i.severity}</span></p>
                  <p className="text-xs text-muted-foreground">{i.detail}</p>
                  <p className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString()}</p>
                </div>
                {i.froze_account && (
                  <span className="rounded-lg border border-destructive/50 px-2.5 py-1 text-xs text-destructive">
                    {tr("تم تجميد الحساب", "Account frozen")}
                  </span>
                )}
                {i.user_id && (
                  <div className="ms-auto flex flex-wrap gap-2">
                    <button
                      onClick={() => setFrozen.mutate({ userId: i.user_id!, frozen: false })}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                    >
                      {tr("رفع التجميد", "Unfreeze")}
                    </button>
                    <button
                      onClick={() => setFrozen.mutate({ userId: i.user_id!, frozen: true, reason: i.detail })}
                      className="rounded-lg border border-destructive/50 px-3 py-1.5 text-xs text-destructive"
                    >
                      {tr("تجميد", "Freeze")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "kyc" && (
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-bold">{tr("مركز توثيق الهوية", "KYC center")}</h3>
            <Link to="/admin/kyc" className="ms-auto text-xs font-bold text-primary">
              {tr("فتح طابور المراجعة الكامل ←", "Open full review queue ←")}
            </Link>
          </div>
          <div className="mt-4 grid gap-3">
            {(kyc.data ?? []).length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {tr("لا توجد طلبات توثيق معلّقة.", "No pending verification requests.")}
              </p>
            )}
            {(kyc.data ?? []).map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4 text-sm">
                <div className="min-w-44">
                  <p className="font-semibold">{u.full_name || u.profile?.display_name || u.user_id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">{u.doc_type} · {u.status}</p>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
                <div className="ms-auto flex flex-wrap gap-2">
                  <button
                    disabled={reviewKyc.isPending}
                    onClick={() => reviewKyc.mutate({ id: u.id, approve: true })}
                    className="min-h-[44px] rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {tr("اعتماد التوثيق", "Approve")}
                  </button>
                  <Link
                    to="/admin/kyc"
                    className="inline-flex min-h-[44px] items-center rounded-lg border border-destructive/50 px-4 text-xs text-destructive"
                  >
                    {tr("رفض مع ذكر السبب", "Reject with reason")}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "revenue" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [tr("إجمالي حجم التداول", "Total trading volume"), `${volume.toLocaleString()} USDT`],
            [tr("صافي عمولة المنصة", "Net platform commission"), `${fees.toLocaleString()} USDT`],
            [tr("عدد الطلبات", "Orders"), String(rows.length)],
            [tr("نسبة النزاعات", "Dispute rate"), `${disputeRate.toFixed(1)}%`],
          ].map(([k, v]) => (
            <Card key={k}>
              <p className="text-sm text-muted-foreground">{k}</p>
              <p className="text-2xl font-black text-primary">{v}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === "sandbox" && <SandboxPanel />}
    </Section>
  );
}

/* --------------------------------------------- super-admin test & sandbox */

/** Private bench for the platform owner to exercise deposits, KYC, and arbitration. */
function SandboxPanel() {
  const { tr } = useLang();
  const sandbox = useSandboxAction();
  const [last, setLast] = useState<string | null>(null);

  const run = (kind: SandboxKind, done: string) =>
    sandbox.mutate(kind, {
      onSuccess: (res) => {
        setLast(`${done} — ${JSON.stringify(res)}`);
        toast.success(done);
      },
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : tr("فشل التنفيذ", "Action failed")),
    });

  const actions: { kind: SandboxKind; title: string; detail: string; done: string }[] = [
    {
      kind: "deposit",
      title: tr("محاكاة إشعار إيداع", "Simulate deposit webhook"),
      detail: tr("إضافة 10 USDT إلى محفظتك كإيداع مؤكد لاختبار القيد التلقائي.", "Credits 10 USDT to your wallet as a confirmed deposit."),
      done: tr("تم قيد إيداع اختباري بقيمة 10 USDT", "Test deposit of 10 USDT credited"),
    },
    {
      kind: "kyc",
      title: tr("إنشاء طلب توثيق اختباري", "Inject test KYC"),
      detail: tr("إنشاء طلب توثيق معلّق لاختبار الاعتماد والرفض.", "Creates a pending verification request to test approve/reject."),
      done: tr("تم إنشاء طلب توثيق معلّق", "Pending KYC request created"),
    },
    {
      kind: "dispute",
      title: tr("إنشاء طلب متنازع عليه", "Simulate disputed order"),
      detail: tr("إنشاء طلب ضمان بقيمة 25 USDT تحت النزاع لاختبار قرارات التحكيم دون أموال حقيقية.", "Creates a 25 USDT escrow order under dispute to test arbitration."),
      done: tr("تم إنشاء طلب متنازع عليه", "Disputed order created"),
    },
  ];

  return (
    <Card>
      <h3 className="font-bold">{tr("مختبر الاختبار والتشخيص", "Test & debug sandbox")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {tr(
          "هذه الأدوات متاحة للمشرف الأعلى فقط وتنفّذ عمليات حقيقية على حسابك أنت لأغراض الاختبار.",
          "Owner-only tools. They run real operations against your own account for testing.",
        )}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {actions.map((a) => (
          <div key={a.kind} className="grid content-between gap-3 rounded-xl border border-border p-4">
            <div>
              <p className="text-sm font-bold">{a.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{a.detail}</p>
            </div>
            <button
              type="button"
              disabled={sandbox.isPending}
              onClick={() => run(a.kind, a.done)}
              className="min-h-[44px] rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {sandbox.isPending ? tr("جارٍ التنفيذ…", "Running…") : tr("تشغيل", "Run")}
            </button>
          </div>
        ))}
      </div>
      {last && (
        <p className="mt-4 break-all rounded-xl border border-border bg-surface-2/60 p-3 font-mono text-[11px] text-muted-foreground" dir="ltr">
          {last}
        </p>
      )}
    </Card>
  );
}

/* ------------------------------------------------- dispute resolution desk */

/** Super-admin desk: live disputes with escrow figures, evidence, and verdicts. */
function DisputeDesk({ isAdmin }: { isAdmin: boolean }) {
  const { tr } = useLang();
  const cases = useAdminDisputes(isAdmin, true);
  const resolve = useResolveDispute();
  const [ruling, setRuling] = useState("");
  const [confirming, setConfirming] = useState<{
    item: AdminDispute;
    action: "release" | "refund";
  } | null>(null);

  const runVerdict = () => {
    if (!confirming) return;
    resolve.mutate(
      {
        id: confirming.item.id,
        action: confirming.action,
        orderId: confirming.item.order_id,
        ...(ruling.trim() ? { ruling: ruling.trim() } : {}),
      },
      {
        onSuccess: () => {
          toast.success(
            confirming.action === "refund"
              ? tr("تم استرداد كامل الضمان للمشتري ✅", "Full escrow refunded to the buyer ✅")
              : tr("تم تحرير الضمان للبائع ✅", "Escrow released to the seller ✅"),
          );
          setRuling("");
          setConfirming(null);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  return (
    <Card>
      <h3 className="font-bold">{tr("مكتب حسم النزاعات", "Dispute resolution desk")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {tr(
          "قرارات نهائية تُحرّك أرصدة المحافظ فوراً وتُسجَّل في سجل التدقيق.",
          "Final verdicts move wallet balances immediately and are written to the audit log.",
        )}
      </p>

      <div className="mt-4 grid gap-3">
        {cases.isLoading && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {tr("جارٍ تحميل النزاعات…", "Loading disputes…")}
          </p>
        )}
        {!cases.isLoading && (cases.data ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {tr("لا توجد نزاعات مفتوحة.", "No open disputes.")}
          </p>
        )}
        {(cases.data ?? []).map((d) => (
          <div key={d.id} className="grid gap-3 rounded-xl border border-border p-4 text-sm">
            <div className="grid gap-1">
              <p className="font-bold">
                {d.order?.title ?? tr("بدون طلب مرتبط", "No linked order")}
                {d.order && (
                  <span className="ms-2 font-mono text-xs text-muted-foreground" dir="ltr">
                    #MJ-{d.order.order_number}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{d.reason}</p>
              <p className="text-xs">
                <span className="rounded-md border border-border px-2 py-0.5">{d.status}</span>
                {d.order && (
                  <span className="ms-2 font-bold text-primary">
                    {tr("محجوز في الضمان", "Held in escrow")}: {formatUsdt(d.order.amount_usdt)} USDT
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {tr("المشتري", "Buyer")}: {d.buyer?.display_name ?? "—"} ·{" "}
                {tr("البائع", "Seller")}: {d.seller?.display_name ?? "—"}
              </p>
            </div>

            <div className="grid gap-1 rounded-lg border border-border/70 p-3 text-[11px]">
              <p className="font-bold">{tr("الأدلة المرفوعة", "Submitted evidence")}</p>
              {(Array.isArray(d.evidence) ? d.evidence : []).length === 0 ? (
                <p className="text-muted-foreground">{tr("لا توجد أدلة.", "No evidence.")}</p>
              ) : (
                (Array.isArray(d.evidence) ? d.evidence : []).map((raw, i) => {
                  const entry = (typeof raw === "string" ? { name: raw } : (raw ?? {})) as Record<
                    string,
                    unknown
                  >;
                  const name = String(entry["name"] ?? `evidence-${i + 1}`);
                  const path = typeof entry["path"] === "string" ? (entry["path"] as string) : null;
                  return (
                    <button
                      key={`${name}-${i}`}
                      type="button"
                      disabled={!path}
                      onClick={async () => {
                        if (!path) return;
                        const url = await vaultUrl(path);
                        if (url) window.open(url, "_blank", "noopener");
                        else toast.error(tr("تعذّر فتح الدليل.", "Could not open the evidence."));
                      }}
                      className="truncate rounded-md border border-border px-2 py-1 text-start hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      {name}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setConfirming({ item: d, action: "refund" })}
                className="min-h-[44px] rounded-xl border border-destructive/60 px-4 py-2 text-xs font-bold text-destructive"
              >
                {tr("حكم لصالح المشتري (استرداد)", "Rule for buyer (refund)")}
              </button>
              <button
                type="button"
                onClick={() => setConfirming({ item: d, action: "release" })}
                className="min-h-[44px] rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
              >
                {tr("حكم لصالح البائع (تحرير)", "Rule for seller (release)")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirming && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-background/85 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-6">
            <h4 className="text-sm font-black">
              {confirming.action === "refund"
                ? tr("تأكيد الحكم لصالح المشتري", "Confirm ruling for the buyer")
                : tr("تأكيد الحكم لصالح البائع", "Confirm ruling for the seller")}
            </h4>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {confirming.action === "refund"
                ? tr(
                    `سيُعاد كامل مبلغ ${formatUsdt(confirming.item.order?.amount_usdt ?? 0)} USDT إلى رصيد المشتري، ويُعلَّم الطلب كمسترد، ويُغلق النزاع نهائياً.`,
                    "The full escrow amount returns to the buyer, the order is marked refunded, and the dispute closes permanently.",
                  )
                : tr(
                    `سيُحرَّر مبلغ ${formatUsdt(confirming.item.order?.amount_usdt ?? 0)} USDT إلى رصيد البائع بعد خصم عمولة المنصة، ويُعلَّم الطلب كمكتمل، ويُغلق النزاع نهائياً.`,
                    "The escrow is released to the seller minus the platform commission, the order is marked completed, and the dispute closes permanently.",
                  )}
            </p>
            <textarea
              value={ruling}
              onChange={(e) => setRuling(e.target.value)}
              rows={3}
              placeholder={tr("حيثيات القرار (اختياري)…", "Ruling notes (optional)…")}
              className="mt-3 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={resolve.isPending}
                onClick={runVerdict}
                className="min-h-[44px] flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {resolve.isPending
                  ? tr("جارٍ التنفيذ…", "Executing…")
                  : tr("تأكيد الحكم النهائي", "Confirm final verdict")}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="min-h-[44px] rounded-xl border border-border px-4 py-2 text-sm font-bold"
              >
                {tr("إلغاء", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
