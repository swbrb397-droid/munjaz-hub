import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell, Globe, LogIn, LogOut, Menu, Repeat2, Wallet2, X,
  Home, Store, Trophy, PlusCircle, LayoutDashboard, ClipboardList, Briefcase, Users, UserCog, CreditCard, ShieldCheck,
  Gavel, BadgeCheck, Settings2, ScrollText,
  type LucideIcon,
  Bot,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLang, type TranslationKey } from "@/lib/lang";
import { useLiveNotifications, useMarkNotificationRead } from "@/lib/notifications";
import { useAuth } from "@/hooks/use-auth";
import { useViewMode } from "@/lib/view-mode";
import { ErrorBoundary } from "@/components/site/ErrorBoundary";
import { useWallet } from "@/lib/queries";
import { useUserProfile } from "@/hooks/use-user-profile";
import { SupportWidget } from "@/components/site/SupportWidget";
import { DmcaTrigger } from "@/components/site/DmcaModal";
import { ManifestoModal, useManifestoFirstRun } from "@/components/site/ManifestoModal";
import { supabase } from "@/lib/cloud-client";

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
      { to: "/workspace", key: "workspace", icon: Briefcase },
      { to: "/referrals", key: "referrals", icon: Users },
    ],
  },
  {
    title: ["الحساب والأمان", "Account & security"],
    items: [
      { to: "/profile", key: "profile", icon: UserCog },
      { to: "/pricing", key: "pricing", icon: CreditCard },
      { to: "/kyc", key: "kyc", icon: BadgeCheck },
    ],
  },
];

const headerNav = navGroups[0]?.items ?? [];

const adminGroup: { title: [string, string]; items: { to: string; label: [string, string]; icon: LucideIcon }[] } = {
  title: ["الإدارة والحوكمة", "Admin Governance"],
  items: [
    { to: "/admin", label: ["لوحة الإدارة العامة", "Admin overview"], icon: ShieldCheck },
    { to: "/admin/disputes", label: ["مركز تسوية النزاعات والضمان", "Disputes & escrow"], icon: Gavel },
    { to: "/admin/kyc", label: ["مراجعة توثيق الهوية KYC", "KYC review"], icon: BadgeCheck },
    { to: "/admin/services", label: ["إدارة العروض والخدمات", "Services moderation"], icon: Store },
    { to: "/admin/users", label: ["إدارة المستخدمين", "User management"], icon: Users },
    { to: "/admin/ai", label: ["مساعد الذكاء الاصطناعي", "AI co-pilot"], icon: Bot },
    { to: "/admin/governance", label: ["مولد الاشتراكات وحوكمة الرسوم", "Passes & governance"], icon: Settings2 },
  ],
};



function AuthButton() {
  const { tr } = useLang();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  if (!isAuthenticated) {
    return (
      <Link
        to="/auth"
        search={() =>
          location.pathname !== "/auth"
            ? { redirectTo: location.pathname + location.searchStr }
            : {}
        }
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-bold text-primary-foreground sm:px-3"
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


function UserMenu({ isAdmin }: { isAdmin: boolean }) {
  const { tr } = useLang();
  const { user } = useAuth();
  const { view, toggleView } = useViewMode();
  const navigate = useNavigate();
  const qc = useQueryClient();
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

  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();
  const avatar = (user?.user_metadata?.["avatar_url"] as string | undefined) ?? null;
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-secondary";
  const links: { to: string; label: string; icon: LucideIcon }[] = [
    { to: "/workspace", label: tr("مساحة العمل والطلبات", "Workspace & orders"), icon: Briefcase },
    { to: "/wallet", label: tr("المحفظة والسجل المالي", "My wallet & ledger"), icon: Wallet2 },
    { to: "/kyc", label: tr("توثيق الهوية", "Identity verification"), icon: BadgeCheck },
    { to: "/referrals", label: tr("برنامج الإحالة والعمولات", "Referral program"), icon: Users },
  ];

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={tr("قائمة الحساب", "Account menu")}
        className="grid size-9 place-items-center overflow-hidden rounded-full border border-primary/40 bg-secondary text-xs font-black text-primary"
      >
        {avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : initials}
      </button>
      {open && (
        <div className="absolute end-0 top-11 z-50 w-64 rounded-xl border border-border bg-card p-1.5 shadow-xl" onClick={() => setOpen(false)}>
          <p className="truncate px-3 py-2 text-xs text-muted-foreground" dir="ltr">{user?.email}</p>
          {links.map((l) => (
            <Link key={l.to} to={l.to} className={item}>
              <l.icon className="size-4 shrink-0 text-muted-foreground" /> {l.label}
            </Link>
          ))}
          <button type="button" onClick={toggleView} className={item}>
            <Repeat2 className="size-4 shrink-0 text-accent" />
            {view === "buyer" ? tr("التحويل لوضع البائع", "Switch to seller mode") : tr("التحويل لوضع المشتري", "Switch to buyer mode")}
          </button>
          {isAdmin && (
            <Link to="/admin" className={`${item} text-primary`}>
              <ShieldCheck className="size-4 shrink-0" /> {tr("لوحة الإدارة", "Admin panel")}
            </Link>
          )}
          <div className="my-1 border-t border-border" />
          <Link to="/profile" className={item}>
            <UserCog className="size-4 shrink-0 text-muted-foreground" /> {tr("إعدادات الحساب", "Account settings")}
          </Link>
          <button
            type="button"
            className={`${item} text-destructive hover:bg-destructive/10`}
            onClick={async () => {
              await qc.cancelQueries();
              qc.clear();
              await supabase.auth.signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut className="size-4 shrink-0" /> {tr("تسجيل الخروج", "Sign out")}
          </button>
        </div>
      )}
    </div>
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
  const { tr, lang } = useLang();
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

  // Live feed straight from the database (realtime INSERT subscription).
  const notifications = useLiveNotifications(5);
  const markRead = useMarkNotificationRead();
  const items = notifications.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

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
        {unread > 0 && (
          <span className="absolute -top-1.5 -start-1.5 grid min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 top-11 z-50 max-h-80 w-72 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-xl">
          {items.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {tr("لا توجد إشعارات جديدة", "No new notifications")}
            </p>
          )}
          {items.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg px-3 py-2 text-xs hover:bg-secondary ${n.read_at ? "text-muted-foreground" : "text-foreground"}`}
            >
              <p className="font-bold">{n.title}</p>
              {n.body && <p className="mt-0.5 text-muted-foreground">{n.body}</p>}
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground" dir="ltr">
                  {new Date(n.created_at).toLocaleString(lang === "ar" ? "ar" : "en")}
                </span>
                {!n.read_at && (
                  <button
                    type="button"
                    onClick={() => markRead.mutate(n.id)}
                    className="text-[10px] font-bold text-primary"
                  >
                    {tr("تعليم كمقروء", "Mark as read")}
                  </button>
                )}
              </div>
            </div>
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
  const { isAdmin } = useUserProfile();
  const [manifesto, setManifesto] = useManifestoFirstRun(isAuthenticated);

  // Lock page scroll behind the mobile drawer so scrolling never leaks to the page.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-50 glass">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-4 lg:gap-6 xl:gap-8">
          <Link to="/" className="flex min-w-0 shrink items-center gap-1.5 sm:gap-2 lg:shrink-0" aria-label={t("brand")}>
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-sm font-bold text-primary glow sm:size-9 sm:text-base">م</span>
            <span className="whitespace-nowrap text-sm font-extrabold leading-none neon-text sm:text-base lg:text-lg">
              المنجز
            </span>

          </Link>

          <nav className="mx-auto hidden min-w-0 items-center gap-0.5 overflow-hidden lg:flex xl:gap-1">
            {headerNav.filter((i) => isAuthenticated || i.to !== "/create-listing").map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="shrink-0 whitespace-nowrap rounded-lg px-2 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground xl:px-2.5"
                activeProps={{ className: "shrink-0 whitespace-nowrap rounded-lg px-2 py-2.5 text-sm bg-secondary text-primary xl:px-2.5" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>

          <div className="ms-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:ms-0">
            {isAuthenticated && <Notifications />}
            {isAuthenticated && (

              <Link
                to="/wallet"
                className="hidden items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary md:flex"
              >
                <Wallet2 className="size-4" />
                <bdi>{Number(wallet.data?.available_usdt ?? 0).toFixed(2)}</bdi> USDT
              </Link>
            )}
            {isAuthenticated ? <UserMenu isAdmin={isAdmin} /> : <AuthButton />}
            <LangSwitch />

            <button type="button" className="grid size-9 shrink-0 place-items-center rounded-lg border border-border lg:hidden" onClick={() => setOpen(!open)} aria-label={t("menu")}>
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>

          </div>
        </div>

        {open && (
          <nav className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border px-3 py-3 sm:px-4 lg:hidden">
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
              <div className="mt-3 border-t border-primary/30 pt-3">
                <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                  {lang === "ar" ? adminGroup.title[0] : adminGroup.title[1]} (Admin Governance)
                </p>
                <div className="grid gap-0.5">
                  {adminGroup.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary"
                      activeProps={{ className: "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm bg-secondary text-primary" }}
                    >
                      <item.icon size={18} strokeWidth={1.8} className="shrink-0" />
                      {lang === "ar" ? item.label[0] : item.label[1]}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => { setOpen(false); setManifesto(true); }}
              className="mt-3 flex w-full items-center gap-2.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm font-bold text-primary"
            >
              <ScrollText size={18} strokeWidth={1.8} className="shrink-0" />
              {lang === "ar" ? "ميثاق المنصة" : "Platform manifesto"}
            </button>
          </nav>
        )}
      </header>


      <main className="pb-28 sm:pb-12">
        <ErrorBoundary label="page">{children}</ErrorBoundary>
      </main>


      <footer className="mt-24 border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 pb-28 pt-9 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:py-8 sm:text-start">
          <p className="leading-relaxed">{t("footer")}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-xs sm:justify-end">
            <Link to="/terms" className="hover:text-foreground transition-colors">
              {t("terms")}
            </Link>
            <DmcaTrigger />
            <button type="button" onClick={() => setManifesto(true)} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <ScrollText size={16} strokeWidth={1.8} /> {lang === "ar" ? "ميثاق المنصة" : "Platform charter"}
            </button>
            {isAdmin && (
              <Link to="/admin" className="flex items-center gap-1.5 text-muted-foreground/70 hover:text-foreground">
                <ShieldCheck size={18} strokeWidth={1.8} /> {t("admin")}
              </Link>
            )}
            <span className="hidden sm:inline" aria-hidden="true">·</span>
            <p className="w-full leading-relaxed sm:w-auto">{t("footerSub")}</p>
          </div>
        </div>
      </footer>
      <SupportWidget />
      <ManifestoModal open={manifesto} onClose={() => setManifesto(false)} />
    </div>
  );
}


export function Section({
  title,
  subtitle,
  children,
  action,
  level = 1,
}: {
  level?: 1 | 2;
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-9 sm:py-12">
      {(title || subtitle || action) && (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            {title && (level === 1 ? (
              <h1 className="select-none text-xl font-extrabold sm:text-3xl">{title}</h1>
            ) : (
              <h2 className="select-none text-xl font-extrabold sm:text-3xl">{title}</h2>
            ))}
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return <div id={id} className={`select-none rounded-lg border border-border bg-card/70 p-4 backdrop-blur sm:p-5 ${className}`}>{children}</div>;
}
