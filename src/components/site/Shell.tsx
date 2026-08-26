import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell, Globe, LogIn, LogOut, Menu, Repeat2, Wallet2, X,
  Home, Store, Trophy, PlusCircle, LayoutDashboard, ClipboardList, Users, UserCog, CreditCard, ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLang, type TranslationKey } from "@/lib/lang";
import { useNotify, type NotifyChannel } from "@/lib/notify";
import { useAuth } from "@/hooks/use-auth";
import { useViewMode } from "@/lib/view-mode";
import { ErrorBoundary } from "@/components/site/ErrorBoundary";
import { useRoles, useWallet } from "@/lib/queries";
import { SupportWidget } from "@/components/site/SupportWidget";
import { supabase } from "@/integrations/supabase/client";

type NavItem = { to: string; key: TranslationKey; icon: LucideIcon };
type NavGroup = { title: [string, string]; items: ReadonlyArray<NavItem> };

const navGroups: ReadonlyArray<NavGroup> = [
  {
    title: ["الرئيسية والسوق", "Home & marketplace"],
    items: [
      { to: "/", key: "home", icon: Home },
      { to: "/store", key: "store", icon: Store },
      { to: "/leaderboard", key: "leaderboard", icon: Trophy },
      { to: "/create-listing", key: "createListing", icon: PlusCircle },
    ],
  },
  {
    title: ["النشاط والمالية", "Activity & finance"],
    items: [
      { to: "/dashboard", key: "dashboard", icon: LayoutDashboard },
      { to: "/wallet", key: "wallet", icon: Wallet2 },
      { to: "/orders", key: "orders", icon: ClipboardList },
      { to: "/workspace", key: "workspace", icon: ClipboardList },
      { to: "/referrals", key: "referrals", icon: Users },
    ],
  },
  {
    title: ["الحساب والأمان", "Account & security"],
    items: [
      { to: "/profile", key: "profile", icon: UserCog },
      { to: "/pricing", key: "pricing", icon: CreditCard },
    ],
  },
];

const flatNav = navGroups.flatMap((g) => g.items);



function AuthButton() {
  const { tr } = useLang();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  if (!isAuthenticated) {
    return (
      <Link
        to="/auth"
        search={{
          redirectTo:
            typeof window !== "undefined" && window.location.pathname !== "/auth"
              ? window.location.pathname + window.location.search
              : undefined,
        }}
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


function ViewSwitch() {
  const { tr } = useLang();
  const { view, toggleView } = useViewMode();
  const label =
    view === "buyer"
      ? tr("التحويل للوحة البائع", "Switch to Seller Dashboard")
      : tr("التحويل للوحة المشتري", "Switch to Buyer Dashboard");

  return (
    <button
      type="button"
      onClick={toggleView}
      title={label}
      aria-label={label}
      className="hidden h-9 shrink-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 text-xs font-bold text-accent transition-colors hover:bg-accent/20 md:flex"
    >
      <Repeat2 className="size-4" />
      <span className="hidden lg:inline">{label}</span>
      <span className="lg:hidden">
        {view === "buyer" ? tr("بائع", "Seller") : tr("مشتري", "Buyer")}
      </span>
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

  const { events, prefs } = useNotify();

  // Static feed respects the same granular preferences as live toasts.
  const baseline: { channel: NotifyChannel; text: string }[] = [
    { channel: "escrow", text: tr("تم تحرير 250 USDT من الضمان.", "250 USDT released from escrow.") },
    { channel: "delivery", text: tr("رسالة جديدة في مساحة الطلب #4821.", "New message in workspace #4821.") },
    { channel: "sales", text: tr("اكتمل توثيق حسابك (KYC 2).", "Your account verification is complete (KYC 2).") },
  ];

  const items = [
    ...events.map((e) => ({ id: e.id, text: e.message })),
    ...baseline.filter((b) => prefs[b.channel]).map((b) => ({ id: b.text, text: b.text })),
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
        {items.length > 0 && <span className="absolute -top-1 -start-1 size-2 rounded-full bg-primary" />}
      </button>
      {open && (
        <div className="absolute end-0 top-11 z-50 max-h-72 w-64 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-xl">
          {items.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">{tr("لا توجد تنبيهات مفعّلة.", "No active notifications.")}</p>
          )}
          {items.map((n) => (
            <p key={n.id} className="rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary">
              {n.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}


export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { t, lang } = useLang();
  const { isAuthenticated } = useAuth();
  const wallet = useWallet();
  const roles = useRoles();
  const isAdmin = (roles.data ?? []).includes("admin");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 glass">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary glow font-bold">م</span>
            <span className="text-lg font-extrabold tracking-tight neon-text">{t("brand")}</span>
          </Link>

          <nav className="mx-auto hidden items-center gap-1 lg:flex">
            {flatNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-lg px-2.5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "rounded-lg px-2.5 py-2.5 text-sm bg-secondary text-primary" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>

          <div className="ms-auto flex shrink-0 items-center gap-2 lg:ms-0">
            {isAuthenticated && <ViewSwitch />}
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
          <nav className="max-h-[75vh] overflow-y-auto border-t border-border px-4 py-3 lg:hidden">
            {navGroups.map((group, gi) => (
              <div key={group.title[0]} className={gi > 0 ? "mt-3 border-t border-border pt-3" : ""}>
                <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">
                  {lang === "ar" ? group.title[0] : group.title[1]}
                </p>
                <div className="grid gap-0.5">
                  {group.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary"
                      activeProps={{ className: "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm bg-secondary text-primary" }}
                      activeOptions={{ exact: item.to === "/" }}
                    >
                      <item.icon size={18} strokeWidth={1.8} className="shrink-0" />
                      {t(item.key)}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            {isAdmin && (
              <div className="mt-3 border-t border-border pt-3">
                <Link
                  to="/admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-muted-foreground hover:bg-secondary"
                >
                  <ShieldCheck size={18} strokeWidth={1.8} className="shrink-0" />
                  {t("admin")}
                </Link>
              </div>
            )}
          </nav>
        )}
      </header>


      <main>
        <ErrorBoundary label="page">{children}</ErrorBoundary>
      </main>


      <footer className="mt-24 border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer")}</p>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/terms" className="hover:text-foreground transition-colors">
              {t("terms")}
            </Link>
            {isAdmin && (
              <Link to="/admin" className="flex items-center gap-1.5 text-muted-foreground/70 hover:text-foreground">
                <ShieldCheck size={18} strokeWidth={1.8} /> {t("admin")}
              </Link>
            )}
            <span className="hidden sm:inline">·</span>
            <p className="hidden sm:block">{t("footerSub")}</p>
          </div>
        </div>
      </footer>
      <SupportWidget />
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
