import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, Lock, ShieldCheck, ShieldAlert, X } from "lucide-react";
import { Card } from "@/components/site/Shell";
import { QrCode } from "@/components/site/QrCode";
import { supabase } from "@/lib/cloud-client";
import { useAuth } from "@/hooks/use-auth";

const PW_RATE_KEY = "munjaz.pw-change-at";
const PW_RATE_WINDOW_MS = 15 * 60 * 1000;

type Enrollment = { factorId: string; secret: string; uri: string };

/** Real TOTP MFA enrollment + password rotation wired to Supabase Auth. */
export function SecurityPanel({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [activeFactorId, setActiveFactorId] = useState<string | null>(null);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const refreshFactors = useCallback(async () => {
    setChecking(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setActiveFactorId(null);
    } else {
      const verified = (data?.totp ?? []).find((f) => f.status === "verified");
      setActiveFactorId(verified?.id ?? null);
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    void refreshFactors();
  }, [refreshFactors]);

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      // Clean up any abandoned unverified factor so enroll never collides.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.totp ?? []) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Al-Munjaz",
        friendlyName: `almunjaz-${Date.now()}`,
      });
      if (error) throw error;
      setEnrollment({
        factorId: data.id,
        secret: data.totp.secret,
        uri: data.totp.uri,
      });
      setCode("");
      setEnrollOpen(true);
    } catch (e) {
      toast.error((e as Error).message || "تعذّر بدء تفعيل المصادقة الثنائية");
    } finally {
      setEnrolling(false);
    }
  };

  const confirmEnroll = async () => {
    if (!enrollment) return;
    if (!/^\d{6}$/.test(code)) {
      toast.error("أدخل رمز تحقق مكوّن من 6 أرقام");
      return;
    }
    setVerifying(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment.factorId,
        code,
      });
      if (error) throw error;
      toast.success("تم تفعيل المصادقة الثنائية بنجاح");
      setEnrollOpen(false);
      setEnrollment(null);
      setCode("");
      await refreshFactors();
    } catch (e) {
      toast.error((e as Error).message || "رمز التحقق غير صحيح");
    } finally {
      setVerifying(false);
    }
  };

  const disableMfa = async () => {
    if (!activeFactorId) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: activeFactorId });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تعطيل المصادقة الثنائية");
    await refreshFactors();
  };

  const changePassword = async () => {
    if (!user?.email) {
      toast.error("يجب تسجيل الدخول");
      return;
    }
    const last = Number(window.localStorage.getItem(PW_RATE_KEY) ?? "0");
    if (last && Date.now() - last < PW_RATE_WINDOW_MS) {
      const mins = Math.ceil((PW_RATE_WINDOW_MS - (Date.now() - last)) / 60000);
      toast.error(`تم تغيير كلمة المرور مؤخراً — حاول مجدداً بعد ${mins} دقيقة`);
      return;
    }
    if (newPw.length < 8) {
      toast.error("كلمة المرور الجديدة يجب ألا تقل عن 8 خانات");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("كلمة المرور الجديدة وتأكيدها غير متطابقين");
      return;
    }
    setSavingPw(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPw,
      });
      if (reauthError) throw new Error("كلمة المرور الحالية غير صحيحة");

      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;

      const stamp = new Date().toISOString();
      await supabase.from("profiles").update({ password_last_changed_at: stamp }).eq("id", user.id);
      window.localStorage.setItem(PW_RATE_KEY, String(Date.now()));

      setPwOpen(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      toast.success("تم تغيير كلمة المرور بنجاح");
      toast.warning("السحب مجمد مؤقتاً لمدة 24 ساعة لحماية أصولك بعد إجراء تعديل أمني على حسابك");
    } catch (e) {
      toast.error((e as Error).message || "تعذّر تحديث كلمة المرور");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <Card className={className}>
      <h3 className="text-sm font-black">كلمة المرور والمصادقة الثنائية</h3>

      <div className="mt-3">
        {checking ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[11px] font-bold text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> جارٍ فحص حالة المصادقة الثنائية…
          </span>
        ) : activeFactorId ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-400">
            <ShieldCheck className="size-3.5" /> <bdi>2FA مفعّل ومحمي</bdi>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-500">
            <ShieldAlert className="size-3.5" /> <bdi>2FA غير مفعل</bdi>
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPwOpen(true)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold"
        >
          <KeyRound className="size-4" /> تغيير كلمة المرور
        </button>
        {activeFactorId ? (
          <button
            type="button"
            onClick={() => void disableMfa()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-destructive/50 px-4 py-2.5 text-sm font-bold text-destructive"
          >
            <Lock className="size-4" /> <bdi>تعطيل 2FA</bdi>
          </button>
        ) : (
          <button
            type="button"
            disabled={enrolling || checking}
            onClick={() => void startEnroll()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {enrolling ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}{" "}
            <bdi>تفعيل 2FA</bdi>
          </button>
        )}
      </div>

      {enrollOpen && enrollment && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-background/85 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="min-w-0 truncate text-lg font-black">تفعيل المصادقة الثنائية</h2>
              <button
                type="button"
                onClick={() => setEnrollOpen(false)}
                aria-label="إغلاق"
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-border"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              امسح رمز QR بتطبيق المصادقة (Google Authenticator / Authy) أو أدخل المفتاح السري
              يدوياً، ثم أدخل الرمز المكوّن من 6 أرقام لتأكيد التفعيل.
            </p>

            <div className="mt-4 grid place-items-center">
              <QrCode value={enrollment.uri} size={176} />
            </div>

            <div className="mt-4 grid gap-2">
              <span className="text-[11px] font-bold text-muted-foreground">المفتاح السري</span>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <code
                  dir="ltr"
                  className="min-w-0 overflow-x-auto rounded-xl border border-border bg-surface px-3 py-2.5 font-mono text-xs"
                >
                  {enrollment.secret}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(enrollment.secret);
                      toast.success("تم نسخ المفتاح السري");
                    } catch {
                      toast.error("تعذّر النسخ");
                    }
                  }}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-primary/50 px-3 text-primary"
                  aria-label="نسخ المفتاح السري"
                >
                  <Copy className="size-4" />
                </button>
              </div>
            </div>

            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              dir="ltr"
              placeholder="000000"
              className="mt-4 w-full rounded-xl border border-input bg-surface px-3 py-3 text-center font-mono text-lg tracking-[0.4em] outline-none focus:border-primary"
            />

            <button
              type="button"
              disabled={verifying || code.length !== 6}
              onClick={() => void confirmEnroll()}
              className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              {verifying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}{" "}
              تأكيد التفعيل
            </button>
          </div>
        </div>
      )}

      {pwOpen && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-background/85 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="min-w-0 truncate text-lg font-black">تغيير كلمة المرور</h2>
              <button
                type="button"
                onClick={() => setPwOpen(false)}
                aria-label="إغلاق"
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-border"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="كلمة المرور الحالية"
                autoComplete="current-password"
                className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="كلمة المرور الجديدة"
                autoComplete="new-password"
                className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="تأكيد كلمة المرور الجديدة"
                autoComplete="new-password"
                className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <p className="text-[11px] leading-relaxed text-amber-500">
                تنبيه: تغيير كلمة المرور يفرض تجميد السحب لمدة 24 ساعة لحماية أصولك.
              </p>
              <button
                type="button"
                disabled={savingPw || !currentPw || !newPw || !confirmPw}
                onClick={() => void changePassword()}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
              >
                {savingPw && <Loader2 className="size-4 animate-spin" />} حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
