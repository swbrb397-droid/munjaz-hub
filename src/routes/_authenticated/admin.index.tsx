import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, Gavel, ShieldAlert, ShieldCheck, TrendingUp } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useDisputes, useKycQueue, useOrders, useRoles } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import {
  logSecurityEvent,
  useResolveWithdrawal,
  useSecurityIncidents,
  useSetAccountFrozen,
  useWithdrawalQueue,
} from "@/lib/withdrawals";
import { formatUsdt } from "@/lib/security";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "لوحة الإدارة | الـمُـنْـجِـز" },
      { name: "description", content: "إدارة النزاعات، مركز توثيق الهوية (KYC)، وتحليلات إيرادات المنصة بعملة USDT." },
      { property: "og:title", content: "لوحة الإدارة | الـمُـنْـجِـز" },
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
  const kyc = useKycQueue(isAdmin);
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

  const verifyUser = useMutation({
    mutationFn: async ({ id, verified }: { id: string; verified: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_verified: verified, kyc_tier: verified ? "tier2" : "tier0" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kyc-queue"] }),
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
      </Card>

      {tab === "disputes" && (
        <Card>
          <h3 className="font-bold">{tr("قائمة النزاعات", "Disputes list")}</h3>
          <div className="mt-4 grid gap-3">
            {(disputes.data ?? []).length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {tr("لا توجد نزاعات مفتوحة.", "No open disputes.")}
              </p>
            )}
            {(disputes.data ?? []).map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4 text-sm">
                <div className="min-w-48">
                  <p className="font-semibold">{d.kind} · {d.status}</p>
                  <p className="text-xs text-muted-foreground">{d.reason}</p>
                </div>
                <span className="text-muted-foreground">
                  {tr("حكم AI", "AI ruling")}: {d.ai_verdict ?? tr("قيد التحليل", "Analyzing")}
                </span>
                <div className="ms-auto flex flex-wrap gap-2">
                  <button onClick={() => resolveCase.mutate({ id: d.id, status: "resolved" })} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">{tr("اعتماد", "Approve")}</button>
                  <button onClick={() => resolveCase.mutate({ id: d.id, status: "rejected" })} className="rounded-lg border border-border px-3 py-1.5 text-xs">{tr("رفض", "Reject")}</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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
          <h3 className="font-bold">{tr("مركز توثيق الهوية", "KYC center")}</h3>
          <div className="mt-4 grid gap-3">
            {(kyc.data ?? []).length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {tr("لا توجد طلبات توثيق معلّقة.", "No pending verification requests.")}
              </p>
            )}
            {(kyc.data ?? []).map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4 text-sm">
                <div className="min-w-44">
                  <p className="font-semibold">{u.display_name || u.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">{u.kyc_tier}</p>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
                <div className="ms-auto flex flex-wrap gap-2">
                  <button onClick={() => verifyUser.mutate({ id: u.id, verified: true })} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">{tr("قبول", "Accept")}</button>
                  <button onClick={() => verifyUser.mutate({ id: u.id, verified: false })} className="rounded-lg border border-destructive/50 px-3 py-1.5 text-xs text-destructive">{tr("رفض", "Reject")}</button>
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
    </Section>
  );
}
