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

function rpcError(e: unknown) {
  const m = (e as Error)?.message ?? "";
  if (m.includes("FORBIDDEN")) return "صلاحيات غير كافية";
  if (m.includes("CANNOT_TARGET_SELF")) return "لا يمكنك تنفيذ هذا الإجراء على حسابك";
  if (m.includes("REASON_REQUIRED")) return "اكتب سبباً واضحاً (5 أحرف على الأقل)";
  if (m.includes("MFA_REQUIRED")) return "هذا الإجراء يتطلب التحقق بالمصادقة الثنائية أولاً";
  if (m.includes("INVALID_INPUT")) return "أكمل العنوان والرسالة";
  return m || "حدث خطأ";
}

function AdminUsers() {
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
      <Section title="إدارة المستخدمين" subtitle="بيانات حية من الحسابات والمحافظ والأدوار والتوثيق.">
        <Card>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute right-3 top-2.5 size-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="الاسم، المعرّف، كود الإحالة، البريد" className={`${inputCls} pr-9`} />
            </label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
              <option value="all">كل الأدوار</option><option value="admin">مشرف عام</option>
              <option value="moderator">مراقب</option><option value="user">مستخدم</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="all">كل الحالات</option><option value="active">نشط</option>
              <option value="banned">محظور</option><option value="deactivated">معطّل</option>
            </select>
            <select value={kyc} onChange={(e) => setKyc(e.target.value)} className={inputCls}>
              <option value="all">كل حالات التوثيق</option><option value="approved">موثّق</option>
              <option value="pending">قيد المراجعة</option><option value="rejected">مرفوض</option>
              <option value="unverified">غير موثّق</option>
            </select>
          </div>
        </Card>

        <div className="mt-3 text-xs text-muted-foreground">
          {users.isLoading ? "جارٍ التحميل…" : <>عدد النتائج: <bdi>{rows.length}</bdi></>}
        </div>
        {users.error && <Card className="mt-3 text-sm text-destructive">{rpcError(users.error)}</Card>}

        <div className="mt-3 grid gap-2">
          {rows.map((u) => (
            <button key={u.id} type="button" onClick={() => setOpenId(u.id)} className="w-full min-w-0 rounded-xl border border-border bg-card p-3 text-right transition hover:border-primary">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-sm font-black">
                  {u.avatar_url ? <img src={u.avatar_url} alt="" className="size-full object-cover" /> : u.display_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{u.display_name}</div>
                  <div className="truncate text-xs text-muted-foreground"><bdi>{u.email ?? u.id}</bdi></div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-[11px]">
                  {u.is_deactivated ? <span className="rounded bg-muted px-2 py-0.5">معطّل</span>
                    : u.is_frozen ? <span className="rounded bg-destructive/15 px-2 py-0.5 text-destructive">محظور</span>
                    : <span className="rounded bg-primary/15 px-2 py-0.5 text-primary">نشط</span>}
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
      toast.error("يجب تفعيل المصادقة الثنائية (2FA) في صفحة ملفك الشخصي قبل تنفيذ الإجراءات الحساسة.");
      return;
    }
    setChallenge({ factorId: factor.id, action });
  };

  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); await refresh(); } catch (e) { toast.error(rpcError(e)); } finally { setBusy(null); }
  };

  const toggleBan = (banned: boolean) => void gated(() => run("ban", async () => {
    const { error } = await supabase.rpc("admin_toggle_user_ban" as never, { p_user_id: u.id, p_banned: banned, p_reason: reason } as never);
    if (error) throw error;
    await setAccess({ data: { userId: u.id, blocked: banned || u.is_deactivated } });
    setReason("");
  }, banned ? "تم حظر المستخدم" : "تم رفع الحظر"));

  const toggleRole = (r: string, has: boolean) => void gated(() => run(`role-${r}`, async () => {
    const { error } = await supabase.rpc("admin_adjust_user_role" as never, { p_user_id: u.id, p_role: r, p_action: has ? "remove" : "add" } as never);
    if (error) throw error;
  }, "تم تحديث الأدوار"));

  const notify = () => run("notify", async () => {
    const { error } = await supabase.rpc("admin_send_user_notification" as never, { p_user_id: u.id, p_title: title, p_message: msg, p_type: type } as never);
    if (error) throw error;
    // Email copy is best-effort: a delivery failure never fails the in-app alert.
    void emailUser({ data: { userId: u.id, title, message: msg } })
      .then((r) => { if (!r.emailed) toast.warning("وصل التنبيه داخل المنصة، لكن تعذّر إرساله بالبريد"); })
      .catch(() => toast.warning("وصل التنبيه داخل المنصة، لكن تعذّر إرساله بالبريد"));
    setTitle(""); setMsg("");
  }, "تم إرسال الإشعار");

  const deactivate = () => void gated(() => run("deactivate", async () => {
    const { error } = await supabase.rpc("admin_deactivate_user" as never, { p_user_id: u.id } as never);
    if (error) throw error;
    await setAccess({ data: { userId: u.id, blocked: true } });
    setConfirm(0);
  }, "تم تعطيل الحساب"));

  const stat = (l: string, v: string) => (
    <div className="rounded-lg border border-border p-2"><div className="text-[11px] text-muted-foreground">{l}</div><bdi className="font-mono text-sm font-bold">{v}</bdi></div>
  );

  return (
    <div dir="rtl" className="space-y-4">
      {challenge && (
        <MfaChallengeDialog
          factorId={challenge.factorId}
          title="تأكيد أمني مطلوب - أدخل رمز المصادقة الثنائية (2FA)"
          onVerified={challenge.action}
          onClose={() => setChallenge(null)}
        />
      )}
      <SheetHeader><SheetTitle className="text-right">{u.display_name}</SheetTitle></SheetHeader>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div>البريد: <bdi>{u.email ?? "—"}</bdi></div>
        <div className="break-all">المعرّف: <bdi>{u.id}</bdi></div>
        <div>كود الإحالة: <bdi>{u.referral_code}</bdi></div>
        <div>تاريخ التسجيل: <bdi>{new Date(u.created_at).toLocaleString("ar")}</bdi></div>
        <div>التوثيق: {u.is_verified ? "موثّق" : u.kyc_status} · الباقة: {u.account_tier}</div>
        <div>الأدوار: <bdi>{u.roles.join("، ") || "—"}</bdi></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {stat("الرصيد المتاح", fmt(u.available_usdt))}
        {stat("محجوز بالضمان", fmt(u.locked_usdt))}
        {stat("إجمالي الأرباح", fmt(u.lifetime_earned))}
        {stat("المدعوون / أرباح الإحالة", `${u.invited_count} / ${fmt(u.referral_earned)}`)}
      </div>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-bold"><Ban className="size-4" />حظر الحساب</span>
          <Switch checked={u.is_frozen} disabled={busy === "ban" || (!u.is_frozen && reason.trim().length < 5)} onCheckedChange={toggleBan} />
        </div>
        {u.is_frozen && u.frozen_reason && <p className="mt-2 text-xs text-destructive">السبب: {u.frozen_reason}</p>}
        {!u.is_frozen && <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الحظر (إلزامي)" rows={2} className={`${inputCls} mt-2`} />}
      </Card>

      <Card>
        <div className="mb-2 flex items-center gap-2 text-sm font-bold"><ShieldCheck className="size-4" />الأدوار</div>
        <div className="flex flex-wrap gap-2">
          {[["admin", "مشرف عام"], ["moderator", "مراقب"]].map(([r, l]) => {
            const has = u.roles.includes(r!);
            return (
              <button key={r} type="button" disabled={busy === `role-${r}`} onClick={() => toggleRole(r!, has)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${has ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                {has ? `إزالة ${l}` : `ترقية إلى ${l}`}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Bell className="size-4" />إرسال إشعار مباشر</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="العنوان" maxLength={120} className={inputCls} />
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="الرسالة" rows={3} maxLength={2000} className={`${inputCls} mt-2`} />
        <div className="mt-2 flex gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            <option value="info">معلومة</option><option value="warning">تحذير</option><option value="system">نظام</option>
          </select>
          <button type="button" onClick={notify} disabled={busy === "notify" || title.trim().length < 2 || msg.trim().length < 2}
            className="shrink-0 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {busy === "notify" ? <Loader2 className="size-4 animate-spin" /> : "إرسال"}
          </button>
        </div>
      </Card>

      <Card>
        <button type="button" disabled={u.is_deactivated || busy === "deactivate"} onClick={() => setConfirm(1)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive px-3 py-2 text-sm font-bold text-destructive disabled:opacity-50">
          <UserX className="size-4" />{u.is_deactivated ? "الحساب معطّل" : "تعطيل الحساب نهائياً"}
        </button>
        <p className="mt-2 text-[11px] text-muted-foreground">يُحفظ سجل الطلبات والمحفظة والضمان كما هو، ويُمنع الدخول وتُخفى الخدمات.</p>
      </Card>

      <AlertDialog open={confirm > 0} onOpenChange={(o) => !o && setConfirm(0)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 1 ? "تعطيل الحساب؟" : "تأكيد نهائي"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 1 ? `سيتم تعطيل حساب ${u.display_name} ومنعه من الدخول.` : "هذا الإجراء لا يُتراجع عنه من هذه الشاشة. هل أنت متأكد تماماً؟"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); if (confirm === 1) setConfirm(2); else void deactivate(); }}
              className="bg-destructive text-destructive-foreground">
              {confirm === 1 ? "متابعة" : "نعم، عطّل الحساب"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
