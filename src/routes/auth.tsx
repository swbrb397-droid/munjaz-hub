import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn, RefreshCw, UserPlus } from "lucide-react";
import { Card } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

type SignupRole = "buyer" | "seller" | "hybrid" | "corporate";

const ROLES: ReadonlyArray<{ value: SignupRole; ar: string; en: string }> = [
  { value: "buyer", ar: "مشتري", en: "Buyer" },
  { value: "seller", ar: "بائع", en: "Seller" },
  { value: "hybrid", ar: "مشتري وبائع", en: "Hybrid" },
  { value: "corporate", ar: "شركة", en: "Corporate" },
];


const REDIRECT_KEY = "munjaz-redirect-to";
const CTX_KEY = "munjaz-auth-context";
const CTX_PARAMS = ["listingId", "lang", "ref"] as const;

/** Only same-origin relative paths are accepted, to avoid open-redirects. */
function safeRedirect(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/auth")) return null;
  return value;
}

/** Re-attach persisted deep-link params (listingId, lang, ref) to the post-auth target. */
function withContext(target: string): string {
  let stored: Record<string, string> = {};
  try {
    stored = JSON.parse(window.sessionStorage.getItem(CTX_KEY) ?? "{}") as Record<string, string>;
  } catch {
    stored = {};
  }
  const [path, query = ""] = target.split("?");
  const params = new URLSearchParams(query);
  for (const key of CTX_PARAMS) {
    const v = stored[key];
    if (v && !params.has(key)) params.set(key, v);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : (path ?? target);
}


/** Maps raw Supabase auth errors to clean localized messages. */
function authErrorMessage(raw: string, ar: boolean): string {
  const m = raw.toLowerCase();
  if (/invalid login credentials|invalid credentials/.test(m))
    return ar ? "بيانات الدخول غير صحيحة" : "Invalid email or password";
  if (/email not confirmed|confirm/.test(m))
    return ar ? "يرجى تأكيد البريد الإلكتروني أولاً" : "Please confirm your email first";
  if (/user already registered|already registered/.test(m))
    return ar ? "هذا البريد مسجّل مسبقاً — سجّل الدخول بدلاً من ذلك" : "This email is already registered — sign in instead";
  if (/password should be at least|weak password/.test(m))
    return ar ? "كلمة المرور قصيرة جداً (6 أحرف على الأقل)" : "Password is too short (min 6 characters)";
  if (/rate limit|too many requests|over_email_send_rate/.test(m))
    return ar ? "عدد المحاولات كبير — حاول مجدداً بعد قليل" : "Too many attempts — please try again shortly";
  if (/invalid email|unable to validate email/.test(m))
    return ar ? "صيغة البريد الإلكتروني غير صحيحة" : "Invalid email address";
  if (/network|fetch/.test(m))
    return ar ? "تعذّر الاتصال بالخادم — تحقق من الإنترنت" : "Network error — check your connection";
  return raw;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirectTo?: string } => {
    const to = safeRedirect(search["redirectTo"]);
    return to ? { redirectTo: to } : {};
  },
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | الـمُـنْـجِـز" },
      { name: "description", content: "سجّل الدخول أو أنشئ حساباً في الـمُـنْـجِـز لإدارة محفظة USDT والطلبات والإحالات." },
      { property: "og:title", content: "تسجيل الدخول | الـمُـنْـجِـز" },
      { property: "og:description", content: "حساب الـمُـنْـجِـز: محفظة USDT، ضمان الطلبات، ونظام الإحالات." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { tr } = useLang();
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const { redirectTo } = Route.useSearch();

  // Persist the deep link (path + query) so it survives the signup/confirmation round-trip.
  useEffect(() => {
    if (redirectTo) window.sessionStorage.setItem(REDIRECT_KEY, redirectTo);
  }, [redirectTo]);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<SignupRole | "">("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [referral, setReferral] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resends, setResends] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  async function resendConfirmation() {
    if (!pendingEmail || cooldown > 0) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setResends((n) => n + 1);
      setCooldown(60);
      setMsg(tr("أُرسلت رسالة تحقق جديدة إلى ", "A new confirmation email was sent to ") + pendingEmail);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    const stored = safeRedirect(window.sessionStorage.getItem(REDIRECT_KEY));
    const target = redirectTo ?? stored;
    if (target) {
      const full = withContext(target);
      window.sessionStorage.removeItem(REDIRECT_KEY);
      window.sessionStorage.removeItem(CTX_KEY);
      navigate({ href: full, replace: true });
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }, [loading, isAuthenticated, navigate, redirectTo]);

  // Persist deep-link context (listingId, lang, ref) across failed logins, signup and session timeouts.
  useEffect(() => {
    const url = new URLSearchParams(window.location.search);
    let stored: Record<string, string> = {};
    try {
      stored = JSON.parse(window.sessionStorage.getItem(CTX_KEY) ?? "{}") as Record<string, string>;
    } catch {
      stored = {};
    }
    const target = new URLSearchParams((redirectTo ?? "").split("?")[1] ?? "");
    for (const key of CTX_PARAMS) {
      const v = url.get(key) ?? target.get(key);
      if (v) stored[key] = v;
    }
    window.sessionStorage.setItem(CTX_KEY, JSON.stringify(stored));

    const code = stored["ref"];
    if (code) {
      setReferral(code.toUpperCase());
      setMode("signup");
    }
  }, [redirectTo]);


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (mode === "signup") {
        if (!role) {
          throw new Error(tr("يجب اختيار نوع الحساب.", "You must select an account type."));
        }
        if (!acceptedTerms) {
          throw new Error(
            tr(
              "يجب الموافقة على الشروط والأحكام وسياسة الخصوصية.",
              "You must agree to the Terms of Service and Privacy Policy.",
            ),
          );
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + withContext(redirectTo ?? "/dashboard"),
            data: {
              display_name: displayName,
              role,
              terms_accepted: "true",
              referral_code: referral || undefined,
            },
          },
        });

        if (error) throw error;
        if (!data.session) {
          setPendingEmail(email);
          setCooldown(60);
          setResends(0);
          setMsg(tr("تم إنشاء الحساب — تحقق من بريدك لتأكيد التسجيل.", "Account created — check your email to confirm."));
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (/confirm/i.test(error.message)) {
            setPendingEmail(email);
            setCooldown(0);
          }
          throw error;
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="glow">
        <h1 className="text-2xl font-black">
          {mode === "signin" ? tr("تسجيل الدخول", "Sign in") : tr("إنشاء حساب", "Create account")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr("محفظة USDT، ضمان الطلبات، وعمولات الإحالة.", "USDT wallet, order escrow, and referral commissions.")}
        </p>

        <form onSubmit={submit} className="mt-6 grid gap-3 text-sm">
          {mode === "signup" && (
            <label className="grid gap-1.5">
              <span className="text-muted-foreground">{tr("الاسم الظاهر", "Display name")}</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary" />
            </label>
          )}
          {mode === "signup" && (
            <div className="grid gap-1.5">
              <span className="text-muted-foreground">{tr("نوع الحساب *", "Account type *")}</span>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    aria-pressed={role === r.value}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                      role === r.value
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-input bg-surface text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tr(r.ar, r.en)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="grid gap-1.5">
            <span className="text-muted-foreground">{tr("البريد الإلكتروني", "Email")}</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-muted-foreground">{tr("كلمة المرور", "Password")}</span>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary" />
          </label>
          {mode === "signup" && (
            <label className="grid gap-1.5">
              <span className="text-muted-foreground">{tr("كود الإحالة (اختياري)", "Referral code (optional)")}</span>
              <input value={referral} onChange={(e) => setReferral(e.target.value.toUpperCase())} className="rounded-lg border border-input bg-surface px-3 py-2 uppercase outline-none focus:border-primary" />
            </label>
          )}
          {mode === "signup" && (
            <label className="mt-1 flex items-start gap-2.5 rounded-lg border border-border bg-surface/50 p-3">
              <input
                type="checkbox"
                required
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[hsl(var(--primary))]"
              />
              <span className="text-xs leading-relaxed text-muted-foreground">
                {tr("أوافق على ", "I agree to the ")}
                <Link to="/terms" className="font-bold text-primary underline-offset-4 hover:underline">
                  {tr("الشروط والأحكام وسياسة الخصوصية", "Terms of Service and Privacy Policy")}
                </Link>
                {tr(
                  " — بما في ذلك أن اشتراكات Pro و Corporate غير قابلة للاسترداد نهائياً.",
                  " — including that Pro & Corporate subscriptions are strictly non-refundable.",
                )}
              </span>
            </label>
          )}


          {err && <p className="rounded-lg bg-destructive/15 px-3 py-2 text-xs text-destructive">{err}</p>}
          {msg && <p className="rounded-lg bg-primary/15 px-3 py-2 text-xs text-primary">{msg}</p>}

          {pendingEmail && (
            <div className="rounded-lg border border-border bg-surface/50 p-3 text-xs">
              <p className="text-muted-foreground">
                {tr("لم تصلك رسالة التحقق؟ تحقق من مجلد الرسائل غير المرغوب فيها أو أعد الإرسال.", "Didn't get the confirmation email? Check your spam folder or resend it.")}
              </p>
              <button
                type="button"
                disabled={busy || cooldown > 0}
                onClick={resendConfirmation}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-primary/50 px-3 py-1.5 font-bold text-primary disabled:opacity-50"
              >
                <RefreshCw className="size-3.5" />
                {cooldown > 0
                  ? tr(`إعادة الإرسال بعد ${cooldown} ثانية`, `Resend in ${cooldown}s`)
                  : tr("إعادة إرسال رسالة التحقق", "Resend confirmation email")}
              </button>
              {resends > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {tr(`عدد مرات الإرسال: ${resends}`, `Times resent: ${resends}`)}
                </p>
              )}
            </div>
          )}

          <button disabled={busy} type="submit" className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground glow disabled:opacity-60">
            {mode === "signin" ? <LogIn className="size-4" /> : <UserPlus className="size-4" />}
            {mode === "signin" ? tr("دخول", "Sign in") : tr("تسجيل", "Sign up")}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(null); setMsg(null); }}
          className="mt-4 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          {mode === "signin" ? tr("ليس لديك حساب؟ أنشئ حساباً", "No account? Create one") : tr("لديك حساب؟ سجّل الدخول", "Already have an account? Sign in")}
        </button>
      </Card>
    </div>
  );
}
