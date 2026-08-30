import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
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
  return <Outlet />;
}
