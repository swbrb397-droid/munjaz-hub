import { Link } from "@tanstack/react-router";
import { Bell, Menu, Wallet2, X } from "lucide-react";
import { useState, type ReactNode } from "react";

const nav = [
  { to: "/", label: "الرئيسية" },
  { to: "/store", label: "المتجر و NFT" },
  { to: "/dashboard", label: "لوحة التحكم" },
  { to: "/wallet", label: "المحفظة" },
  { to: "/workspace", label: "مساحة الطلب" },
  { to: "/admin", label: "الإدارة" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 glass">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary glow font-bold">م</span>
            <span className="text-lg font-extrabold tracking-tight neon-text">مُنجَز</span>
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
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-2 lg:ms-0">
            <button className="relative grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground" aria-label="التنبيهات">
              <Bell className="size-4" />
              <span className="absolute -top-1 -start-1 size-2 rounded-full bg-primary" />
            </button>
            <Link
              to="/wallet"
              className="hidden items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary sm:flex"
            >
              <Wallet2 className="size-4" />
              4,182.50 USDT
            </Link>
            <button className="grid size-9 place-items-center rounded-lg border border-border lg:hidden" onClick={() => setOpen(!open)} aria-label="القائمة">
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
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main>{children}</main>

      <footer className="mt-24 border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>مُنجَز — سوق الخدمات الرقمية بعملة USDT.</p>
          <p className="text-xs">TRC-20 · BEP-20 · Polygon · بيانات تجريبية</p>
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
