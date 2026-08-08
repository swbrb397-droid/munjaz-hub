import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Globe, LogIn, LogOut, Menu, Wallet2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLang, type TranslationKey } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { useWallet } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/", key: "home" },
  { to: "/store", key: "store" },
  { to: "/dashboard", key: "dashboard" },
  { to: "/wallet", key: "wallet" },
  { to: "/workspace", key: "workspace" },
  { to: "/admin", key: "admin" },
] as const satisfies ReadonlyArray<{ to: string; key: TranslationKey }>;

function AuthButton() {
  const { tr } = useLang();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  if (!isAuthenticated) {
    return (
      <Link
        to="/auth"
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground"
      >
        <LogIn className="size-4" /> {tr("دخول", "Sign in")}
      </Link>
    );
  }

  return (
    <button
      type="button"
      title={tr("تسجيل الخروج", "Sign out")}
      aria-label={tr("تسجيل الخروج", "Sign out")}
      onClick={async () => {
        await qc.cancelQueries();
        qc.clear();
        await supabase.auth.signOut();
        navigate({ to: "/auth", replace: true });
      }}
      className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
    >
      <LogOut className="size-4" />
    </button>
  );
}


function LangSwitch() {
  const { lang, setLang, tr } = useLang();
  const next = lang === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      title={tr("تغيير اللغة", "Change language")}
      aria-label={tr("تغيير اللغة", "Change language")}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 text-xs font-bold uppercase text-primary transition-colors hover:bg-primary/20"
    >
      <Globe className="size-4" />
      {next}
    </button>
  );
}

function Notifications() {
  const { tr } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const items = [
    tr("تم تحرير 250 USDT من الضمان.", "250 USDT released from escrow."),
    tr("رسالة جديدة في مساحة الطلب #4821.", "New message in workspace #4821."),
    tr("اكتمل توثيق حسابك (KYC 2).", "Your account verification is complete (KYC 2)."),
  ];

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="relative grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
        aria-label={tr("التنبيهات", "Notifications")}
      >
        <Bell className="size-4" />
        <span className="absolute -top-1 -start-1 size-2 rounded-full bg-primary" />
      </button>
      {open && (
        <div className="absolute end-0 top-11 z-50 w-64 rounded-xl border border-border bg-card p-2 shadow-xl">
          {items.map((n) => (
            <p key={n} className="rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary">
              {n}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}


export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { t } = useLang();
  const { isAuthenticated } = useAuth();
  const wallet = useWallet();


  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 glass">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary glow font-bold">م</span>
            <span className="text-lg font-extrabold tracking-tight neon-text">{t("brand")}</span>
          </Link>

          <nav className="mx-auto hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "rounded-lg px-3 py-2 text-sm bg-secondary text-primary" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>

          <div className="ms-auto flex shrink-0 items-center gap-2 lg:ms-0">
            <Notifications />
            {isAuthenticated && (
              <Link
                to="/wallet"
                className="hidden items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary md:flex"
              >
                <Wallet2 className="size-4" />
                {Number(wallet.data?.available_usdt ?? 0).toLocaleString()} USDT
              </Link>
            )}
            <AuthButton />
            <LangSwitch />

            <button type="button" className="grid size-9 shrink-0 place-items-center rounded-lg border border-border lg:hidden" onClick={() => setOpen(!open)} aria-label={t("menu")}>
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>

          </div>
        </div>

        {open && (
          <nav className="grid gap-1 border-t border-border px-4 py-3 lg:hidden">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
                activeProps={{ className: "rounded-lg px-3 py-2 text-sm bg-secondary text-primary" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main>{children}</main>

      <footer className="mt-24 border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer")}</p>
          <p className="text-xs">{t("footerSub")}</p>
        </div>
      </footer>
    </div>
  );
}

export function Section({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold sm:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card/70 p-5 backdrop-blur ${className}`}>{children}</div>;
}
