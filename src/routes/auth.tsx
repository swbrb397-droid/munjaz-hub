import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
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


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | مُنجَز" },
      { name: "description", content: "سجّل الدخول أو أنشئ حساباً في مُنجَز لإدارة محفظة USDT والطلبات والإحالات." },
      { property: "og:title", content: "تسجيل الدخول | مُنجَز" },
      { property: "og:description", content: "حساب مُنجَز: محفظة USDT، ضمان الطلبات، ونظام الإحالات." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { tr } = useLang();
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
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


  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: "/dashboard", replace: true });
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code) {
      setReferral(code.toUpperCase());
      setMode("signup");
    }
  }, []);

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
            emailRedirectTo: window.location.origin,
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
          setMsg(tr("تم إنشاء الحساب — تحقق من بريدك لتأكيد التسجيل.", "Account created — check your email to confirm."));
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
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
