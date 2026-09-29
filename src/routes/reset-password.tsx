import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { supabase } from "@/lib/cloud-client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة | المنجز" },
      { name: "description", content: "عيّن كلمة مرور جديدة لحسابك على المنجز، مع تأكيد المصادقة الثنائية عند تفعيلها." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة | المنجز" },
      { property: "og:description", content: "استعادة آمنة لكلمة المرور مع حماية المصادقة الثنائية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { tr } = useLang();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setHasSession(!!data.session);
      if (data.session) {
        const { data: f } = await supabase.auth.mfa.listFactors();
        const totp = (f?.totp ?? []).find((x) => x.status === "verified");
        if (alive) setFactorId(totp?.id ?? null);
      }
      if (alive) setReady(true);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") void check();
    });
    void check();
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit() {
    if (password.length < 8) return toast.error(tr("كلمة المرور 8 أحرف على الأقل", "Password must be at least 8 characters"));
    if (password !== confirm) return toast.error(tr("كلمتا المرور غير متطابقتين", "Passwords do not match"));
    setBusy(true);
    try {
      if (factorId) {
        if (!/^\d{6}$/.test(code)) throw new Error(tr("أدخل رمز المصادقة المكوّن من 6 أرقام", "Enter the 6-digit authenticator code"));
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
        if (error) throw new Error(tr("رمز المصادقة غير صحيح", "Invalid authenticator code"));
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(tr("تم تحديث كلمة المرور", "Password updated"));
      void navigate({ to: "/dashboard", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-10 sm:py-16">
      <Card>
        <h1 className="text-2xl font-black">{tr("تعيين كلمة مرور جديدة", "Set a new password")}</h1>
        {!ready ? (
          <div className="grid place-items-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>
        ) : !hasSession ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {tr("رابط الاستعادة غير صالح أو منتهي. اطلب رابطاً جديداً من صفحة الدخول.", "This reset link is invalid or expired. Request a new one from the sign-in page.")}
          </p>
        ) : (
          <div className="mt-5 grid gap-3 text-sm">
            <input type="password" dir="ltr" autoComplete="new-password" placeholder={tr("كلمة المرور الجديدة", "New password")} value={password} onChange={(e) => setPassword(e.target.value)} className="min-h-12 rounded-lg border border-input bg-surface px-3 outline-none focus:border-primary" />
            <input type="password" dir="ltr" autoComplete="new-password" placeholder={tr("تأكيد كلمة المرور", "Confirm password")} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="min-h-12 rounded-lg border border-input bg-surface px-3 outline-none focus:border-primary" />
            {factorId && (
              <label className="grid gap-1.5 rounded-xl border border-primary/40 bg-primary/10 p-3">
                <span className="flex items-center gap-2 text-xs font-bold text-primary"><ShieldCheck className="size-4" />{tr("حسابك محمي بالمصادقة الثنائية — أدخل الرمز", "Your account uses 2FA — enter the code")}</span>
                <input inputMode="numeric" dir="ltr" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="min-h-12 rounded-lg border border-input bg-surface px-3 text-center tracking-[0.4em] outline-none focus:border-primary" />
              </label>
            )}
            <button type="button" disabled={busy} onClick={submit} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-60">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {tr("حفظ كلمة المرور", "Save password")}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
