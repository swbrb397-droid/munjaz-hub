import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ban, Bell, Loader2, Search, ShieldCheck, UserX } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/cloud-client";
import { useLang } from "@/lib/lang";
import { translateAuthError } from "@/lib/auth-errors";
import { MfaChallengeDialog } from "@/components/site/MfaChallengeDialog";
import { adminListUsers, adminSetAuthAccess, adminEmailNotification, type AdminUserRow } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "إدارة المستخدمين | المنجز" },
      { name: "description", content: "إدارة حسابات المستخدمين: الحظر، التعطيل، الأدوار، الإشعارات، وأرصدة المحافظ." },
      { property: "og:title", content: "إدارة المستخدمين | المنجز" },
      { property: "og:description", content: "لوحة إدارة المستخدمين ببيانات حية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminUsers,
});

const fmt = (n: number) => n.toFixed(2);
const inputCls = "w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm";

function rpcError(e: unknown, ar = true) {
  const m = (e as Error)?.message ?? "";
  if (m.includes("CANNOT_TARGET_SELF")) return ar ? "لا يمكنك تنفيذ هذا الإجراء على حسابك" : "You can’t perform this action on your own account";
  if (m.includes("INVALID_INPUT")) return ar ? "أكمل العنوان والرسالة" : "Fill in the title and message";
  return translateAuthError(e, ar);
}

function AdminUsers() {
  const { tr, lang } = useLang();
  const ar = lang === "ar";
  const list = useServerFn(adminListUsers);
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => list() });
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [kyc, setKyc] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (users.data ?? []).filter((u) => {
      if (s && ![u.display_name, u.id, u.referral_code, u.email ?? ""].some((v) => v.toLowerCase().includes(s))) return false;
      if (role === "user" && (u.roles.includes("admin") || u.roles.includes("moderator"))) return false;
      if (role !== "all" && role !== "user" && !u.roles.includes(role)) return false;
      if (status === "active" && (u.is_frozen || u.is_deactivated)) return false;
      if (status === "banned" && !u.is_frozen) return false;
      if (status === "deactivated" && !u.is_deactivated) return false;
      if (kyc !== "all" && (u.is_verified ? "approved" : u.kyc_status) !== kyc) return false;
      return true;
    });
  }, [users.data, q, role, status, kyc]);

  const selected = (users.data ?? []).find((u) => u.id === openId) ?? null;

  return (
    <div className="overflow-x-hidden">
      <Section title={tr("إدارة المستخدمين", "User management")} subtitle={tr("بيانات حية من الحسابات والمحافظ والأدوار والتوثيق.", "Live data from accounts, wallets, roles and verification.")}>
        <Card>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute end-3 top-2.5 size-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("الاسم، المعرّف، كود الإحالة، البريد", "Name, ID, referral code, email")} className={`${inputCls} pe-9`} />
            </label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
              <option value="all">{tr("كل الأدوار", "All roles")}</option><option value="admin">{tr("مشرف عام", "Super admin")}</option>
              <option value="moderator">{tr("مراقب", "Moderator")}</option><option value="user">{tr("مستخدم", "User")}</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="all">{tr("كل الحالات", "All statuses")}</option><option value="active">{tr("نشط", "Active")}</option>
              <option value="banned">{tr("محظور", "Banned")}</option><option value="deactivated">{tr("معطّل", "Deactivated")}</option>
            </select>
            <select value={kyc} onChange={(e) => setKyc(e.target.value)} className={inputCls}>
              <option value="all">{tr("كل حالات التوثيق", "All KYC statuses")}</option><option value="approved">{tr("موثّق", "Verified")}</option>
              <option value="pending">{tr("قيد المراجعة", "Pending review")}</option><option value="rejected">{tr("مرفوض", "Rejected")}</option>
              <option value="unverified">{tr("غير موثّق", "Unverified")}</option>
            </select>
          </div>
        </Card>

        <div className="mt-3 text-xs text-muted-foreground">
          {users.isLoading ? tr("جارٍ التحميل…", "Loading…") : <>{tr("عدد النتائج:", "Results:")} <bdi>{rows.length}</bdi></>}
        </div>
        {users.error && <Card className="mt-3 text-sm text-destructive">{rpcError(users.error, ar)}</Card>}

        <div className="mt-3 grid gap-2">
          {rows.map((u) => (
            <button key={u.id} type="button" onClick={() => setOpenId(u.id)} className="w-full min-w-0 rounded-xl border border-border bg-card p-3 text-start transition hover:border-primary">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-sm font-black">
                  {u.avatar_url ? <img src={u.avatar_url} alt="" className="size-full object-cover" /> : u.display_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{u.display_name}</div>
                  <div className="truncate text-xs text-muted-foreground"><bdi>{u.email ?? u.id}</bdi></div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-[11px]">
                  {u.is_deactivated ? <span className="rounded bg-muted px-2 py-0.5">{tr("معطّل", "Deactivated")}</span>
                    : u.is_frozen ? <span className="rounded bg-destructive/15 px-2 py-0.5 text-destructive">{tr("محظور", "Banned")}</span>
                    : <span className="rounded bg-primary/15 px-2 py-0.5 text-primary">{tr("نشط", "Active")}</span>}
                  <bdi className="font-mono">{fmt(u.available_usdt)} USDT</bdi>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Section>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-md">
          {selected && <UserPanel u={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function UserPanel({ u }: { u: AdminUserRow }) {
  const { tr, lang } = useLang();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const setAccess = useServerFn(adminSetAuthAccess);
  const emailUser = useServerFn(adminEmailNotification);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");
  const [type, setType] = useState("info");
  const [confirm, setConfirm] = useState(0);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });
  const [challenge, setChallenge] = useState<{ factorId: string; action: () => Promise<void> } | null>(null);

  /** 2FA step-up: privileged mutations run only after a fresh TOTP verification. */
  const gated = async (action: () => Promise<void>) => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    const factor = error ? null : (data?.totp ?? []).find((f) => f.status === "verified");
    if (!factor) {
      toast.error(tr("يجب تفعيل المصادقة الثنائية (2FA) في صفحة ملفك الشخصي قبل تنفيذ الإجراءات الحساسة.", "Enable two-factor authentication (2FA) on your profile page before performing sensitive actions."));
      return;
    }
    setChallenge({ factorId: factor.id, action });
  };

  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); await refresh(); } catch (e) { toast.error(rpcError(e, ar)); } finally { setBusy(null); }
  };

  const toggleBan = (banned: boolean) => void gated(() => run("ban", async () => {
    const { error } = await supabase.rpc("admin_toggle_user_ban" as never, { p_user_id: u.id, p_banned: banned, p_reason: reason } as never);
    if (error) throw error;
    await setAccess({ data: { userId: u.id, blocked: banned || u.is_deactivated } });
    setReason("");
  }, banned ? tr("تم حظر المستخدم", "User banned") : tr("تم رفع الحظر", "Ban lifted")));

  const toggleRole = (r: string, has: boolean) => void gated(() => run(`role-${r}`, async () => {
    const { error } = await supabase.rpc("admin_adjust_user_role" as never, { p_user_id: u.id, p_role: r, p_action: has ? "remove" : "add" } as never);
    if (error) throw error;
  }, tr("تم تحديث الأدوار", "Roles updated")));

  const notify = () => run("notify", async () => {
    const { error } = await supabase.rpc("admin_send_user_notification" as never, { p_user_id: u.id, p_title: title, p_message: msg, p_type: type } as never);
    if (error) throw error;
    // Email copy is best-effort: a delivery failure never fails the in-app alert.
    void emailUser({ data: { userId: u.id, title, message: msg } })
      .then((r) => { if (!r.emailed) toast.warning(tr("وصل التنبيه داخل المنصة، لكن تعذّر إرساله بالبريد", "The in-app alert was delivered, but the email could not be sent")); })
      .catch(() => toast.warning(tr("وصل التنبيه داخل المنصة، لكن تعذّر إرساله بالبريد", "The in-app alert was delivered, but the email could not be sent")));
    setTitle(""); setMsg("");
  }, tr("تم إرسال الإشعار", "Notification sent"));

  const deactivate = () => void gated(() => run("deactivate", async () => {
    const { error } = await supabase.rpc("admin_deactivate_user" as never, { p_user_id: u.id } as never);
    if (error) throw error;
    await setAccess({ data: { userId: u.id, blocked: true } });
    setConfirm(0);
  }, tr("تم تعطيل الحساب", "Account deactivated")));

  const stat = (l: string, v: string) => (
    <div className="rounded-lg border border-border p-2"><div className="text-[11px] text-muted-foreground">{l}</div><bdi className="font-mono text-sm font-bold">{v}</bdi></div>
  );

  return (
    <div dir={ar ? "rtl" : "ltr"} className="space-y-4">
      {challenge && (
        <MfaChallengeDialog
          factorId={challenge.factorId}
          title={tr("تأكيد أمني مطلوب - أدخل رمز المصادقة الثنائية (2FA)", "Security confirmation required — enter your 2FA code")}
          onVerified={challenge.action}
          onClose={() => setChallenge(null)}
        />
      )}
      <SheetHeader><SheetTitle className="text-start">{u.display_name}</SheetTitle></SheetHeader>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div>{tr("البريد:", "Email:")} <bdi>{u.email ?? "—"}</bdi></div>
        <div className="break-all">{tr("المعرّف:", "ID:")} <bdi>{u.id}</bdi></div>
        <div>{tr("كود الإحالة:", "Referral code:")} <bdi>{u.referral_code}</bdi></div>
        <div>{tr("تاريخ التسجيل:", "Joined:")} <bdi>{new Date(u.created_at).toLocaleString(ar ? "ar" : "en")}</bdi></div>
        <div>{tr("التوثيق:", "KYC:")} {u.is_verified ? tr("موثّق", "Verified") : u.kyc_status} · {tr("الباقة:", "Plan:")} {u.account_tier}</div>
        <div>{tr("الأدوار:", "Roles:")} <bdi>{u.roles.join(ar ? "، " : ", ") || "—"}</bdi></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {stat(tr("الرصيد المتاح", "Available balance"), fmt(u.available_usdt))}
        {stat(tr("محجوز بالضمان", "Locked in escrow"), fmt(u.locked_usdt))}
        {stat(tr("إجمالي الأرباح", "Lifetime earnings"), fmt(u.lifetime_earned))}
        {stat(tr("المدعوون / أرباح الإحالة", "Invited / referral earnings"), `${u.invited_count} / ${fmt(u.referral_earned)}`)}
      </div>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-bold"><Ban className="size-4" />{tr("حظر الحساب", "Ban account")}</span>
          <Switch checked={u.is_frozen} disabled={busy === "ban" || (!u.is_frozen && reason.trim().length < 5)} onCheckedChange={toggleBan} />
        </div>
        {u.is_frozen && u.frozen_reason && <p className="mt-2 text-xs text-destructive">{tr("السبب:", "Reason:")} {u.frozen_reason}</p>}
        {!u.is_frozen && <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr("سبب الحظر (إلزامي)", "Ban reason (required)")} rows={2} className={`${inputCls} mt-2`} />}
      </Card>

      <Card>
        <div className="mb-2 flex items-center gap-2 text-sm font-bold"><ShieldCheck className="size-4" />{tr("الأدوار", "Roles")}</div>
        <div className="flex flex-wrap gap-2">
          {[["admin", tr("مشرف عام", "super admin")], ["moderator", tr("مراقب", "moderator")]].map(([r, l]) => {
            const has = u.roles.includes(r!);
            return (
              <button key={r} type="button" disabled={busy === `role-${r}`} onClick={() => toggleRole(r!, has)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${has ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                {has ? tr(`إزالة ${l}`, `Remove ${l}`) : tr(`ترقية إلى ${l}`, `Promote to ${l}`)}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Bell className="size-4" />{tr("إرسال إشعار مباشر", "Send direct notification")}</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr("العنوان", "Title")} maxLength={120} className={inputCls} />
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={tr("الرسالة", "Message")} rows={3} maxLength={2000} className={`${inputCls} mt-2`} />
        <div className="mt-2 flex gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            <option value="info">{tr("معلومة", "Info")}</option><option value="warning">{tr("تحذير", "Warning")}</option><option value="system">{tr("نظام", "System")}</option>
          </select>
          <button type="button" onClick={notify} disabled={busy === "notify" || title.trim().length < 2 || msg.trim().length < 2}
            className="shrink-0 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {busy === "notify" ? <Loader2 className="size-4 animate-spin" /> : tr("إرسال", "Send")}
          </button>
        </div>
      </Card>

      <Card>
        <button type="button" disabled={u.is_deactivated || busy === "deactivate"} onClick={() => setConfirm(1)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive px-3 py-2 text-sm font-bold text-destructive disabled:opacity-50">
          <UserX className="size-4" />{u.is_deactivated ? tr("الحساب معطّل", "Account deactivated") : tr("تعطيل الحساب نهائياً", "Permanently deactivate account")}
        </button>
        <p className="mt-2 text-[11px] text-muted-foreground">{tr("يُحفظ سجل الطلبات والمحفظة والضمان كما هو، ويُمنع الدخول وتُخفى الخدمات.", "Order, wallet and escrow history is kept; sign-in is blocked and listings are hidden.")}</p>
      </Card>

      <AlertDialog open={confirm > 0} onOpenChange={(o) => !o && setConfirm(0)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 1 ? tr("تعطيل الحساب؟", "Deactivate account?") : tr("تأكيد نهائي", "Final confirmation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 1 ? tr(`سيتم تعطيل حساب ${u.display_name} ومنعه من الدخول.`, `${u.display_name}’s account will be deactivated and blocked from signing in.`) : tr("هذا الإجراء لا يُتراجع عنه من هذه الشاشة. هل أنت متأكد تماماً؟", "This can’t be undone from this screen. Are you absolutely sure?")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("إلغاء", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); if (confirm === 1) setConfirm(2); else void deactivate(); }}
              className="bg-destructive text-destructive-foreground">
              {confirm === 1 ? tr("متابعة", "Continue") : tr("نعم، عطّل الحساب", "Yes, deactivate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
