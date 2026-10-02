import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/lib/queries";
import { useLang } from "@/lib/lang";
import { logSecurityEvent } from "@/lib/withdrawals";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminGate,
});

function AdminGate() {
  const navigate = useNavigate();
  const { tr } = useLang();
  const { user, loading: authLoading } = useAuth();
  const roles = useRoles();
  const handled = useRef(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isSub = pathname.replace(/\/$/, "") !== "/admin";

  const isAdmin = (roles.data ?? []).includes("admin");
  const settled = !authLoading && !!user && !roles.isLoading && roles.data !== undefined;

  useEffect(() => {
    if (!settled || isAdmin || handled.current) return;
    handled.current = true;
    void logSecurityEvent("admin_access_attempt", "Non-admin user blocked from /admin route");
    toast.error(tr("غير مصرّح: هذه المنطقة مخصّصة للمشرفين فقط", "Unauthorized: this area is restricted to administrators"));
    navigate({ to: "/", replace: true });
  }, [settled, isAdmin, navigate, tr]);

  if (!settled) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        {tr("جارٍ التحقق من الصلاحيات…", "Verifying permissions…")}
      </div>
    );
  }

  if (!isAdmin) return null;
  return (
    <>
      {isSub && (
        <div className="sticky top-16 z-30 mx-auto max-w-7xl px-4 pt-4">
          <Link to="/admin" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-primary/40 bg-card px-4 py-2 text-sm font-bold text-primary shadow">
            <ArrowRight className="size-4 ltr:rotate-180" /> {tr("العودة إلى لوحة الإدارة الرئيسية", "Back to main admin dashboard")}
          </Link>
        </div>
      )}
      <Outlet />
    </>
  );
}
