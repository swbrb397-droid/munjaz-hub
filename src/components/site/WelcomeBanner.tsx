import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { UserRound, X } from "lucide-react";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** One-time welcome for new Google sign-ups; dismissal stored per user. */
export function WelcomeBanner() {
  const { tr } = useLang();
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const key = user ? `mj_welcome_seen_${user.id}` : "";

  useEffect(() => {
    if (!user) return;
    const provider = (user.app_metadata as { provider?: string } | undefined)?.provider;
    const isNew = user.created_at ? Date.now() - new Date(user.created_at).getTime() < WEEK_MS : false;
    if (provider === "google" && isNew && !localStorage.getItem(key)) setShow(true);
  }, [user, key]);

  if (!show) return null;
  const dismiss = () => {
    localStorage.setItem(key, "1");
    setShow(false);
  };

  return (
    <div className="mb-6 flex items-start gap-4 rounded-2xl border border-primary/30 bg-card p-5">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <UserRound className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-bold">{tr("مرحباً بك في المُنْجِز", "Welcome to Al Munjiz")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr(
            "أُنشئ حسابك عبر Google. يمكنك تعيين اسم مستخدم فريد وإضافة نبذتك المهنية من صفحة الملف الشخصي.",
            "Your account was created with Google. You can set a unique username and add your professional bio from your profile.",
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/profile" onClick={dismiss} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
            {tr("تخصيص الملف الشخصي", "Customize profile")}
          </Link>
          <button onClick={dismiss} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground">
            {tr("لاحقاً", "Later")}
          </button>
        </div>
      </div>
      <button onClick={dismiss} aria-label={tr("إغلاق", "Close")} className="text-muted-foreground">
        <X className="size-4" />
      </button>
    </div>
  );
}
