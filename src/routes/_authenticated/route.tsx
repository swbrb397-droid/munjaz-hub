import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // The gate runs inside the component (never in beforeLoad) so the first
  // client render always matches the server output — redirecting mid-hydration
  // made React throw a hydration error that collapsed the whole app.
  pendingComponent: Spinner,
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
  const sentRef = useRef(false);

  useEffect(() => {
    if (loading || isAuthenticated || sentRef.current) return;
    sentRef.current = true;
    // Preserve the full deep link (path + query) so login can return the user here.
    const href =
      typeof window === "undefined"
        ? "/"
        : `${window.location.pathname}${window.location.search}`;
    void navigate({ to: "/auth", search: { redirectTo: href }, replace: true });
  }, [loading, isAuthenticated, navigate]);

  if (loading || !isAuthenticated) return <Spinner />;
  return <Outlet />;
}
