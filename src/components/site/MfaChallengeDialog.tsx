import { useState } from "react";
import { KeyRound, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/cloud-client";
import { useLang } from "@/lib/lang";

const INVALID_TOTP_AR =
  "رمز التحقق غير صحيح أو انتهت صلاحيته. يرجى إدخال الرمز اللحظي من تطبيق المصادقة.";

export function MfaChallengeDialog({
  factorId,
  title,
  onVerified,
  onClose,
}: {
  factorId: string;
  title: string;
  onVerified: () => Promise<void> | void;
  onClose: () => void;
}) {
  const { tr } = useLang();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) {
      toast.error(tr("أدخل رمزاً مكوّناً من 6 أرقام.", "Enter a 6-digit code."));
      return;
    }
    setVerifying(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) throw error;
      await onVerified();
      onClose();
    } catch {
      toast.error(
        tr(
          INVALID_TOTP_AR,
          "The verification code is invalid or expired. Enter the current code from your authenticator app.",
        ),
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-background/85 p-4 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mfa-challenge-title"
    >
      <div className="max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-2xl border border-border bg-card px-4 py-3 pb-8 sm:p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 id="mfa-challenge-title" className="min-w-0 text-lg font-black">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr("إغلاق", "Close")}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-border"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {tr(
            "أدخل الرمز اللحظي المكوّن من 6 أرقام من تطبيق المصادقة لإتمام هذا الإجراء المالي.",
            "Enter the current 6-digit code from your authenticator app to complete this financial action.",
          )}
        </p>
        <input
          autoFocus
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(event) => {
            if (event.key === "Enter") void verify();
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          placeholder="000000"
          aria-label={tr("رمز المصادقة الثنائية", "Two-factor authentication code")}
          className="mt-5 w-full rounded-xl border border-input bg-surface px-3 py-3 text-center font-mono text-lg tracking-[0.4em] outline-none focus:border-primary"
        />
        <button
          type="button"
          disabled={verifying || code.length !== 6}
          onClick={() => void verify()}
          className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {verifying ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {tr("تحقق ومتابعة", "Verify and continue")}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <KeyRound className="size-3.5" /> {tr("الرمز لا يُحفظ أو يُسجل.", "The code is never stored or logged.")}
        </p>
      </div>
    </div>
  );
}