import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  // The gate runs inside the component (never in beforeLoad) so the first
  // client render always matches the server output — redirecting mid-hydration
  // made React throw a hydration error that collapsed the whole app.
  component: AuthGate,
});

function Spinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function AuthGate() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });

  useEffect(() => {
    if (loading || isAuthenticated) return;
    // Preserve the full deep link (path + query) so login can return the user here.
    void navigate({ to: "/auth", search: { redirectTo: href }, replace: true });
  }, [loading, isAuthenticated, href, navigate]);

  if (loading || !isAuthenticated) return <Spinner />;
  return <Outlet />;
}
