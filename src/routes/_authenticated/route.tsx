import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Preserve the full deep link (path + query params) so login can return the user here.
      throw redirect({ to: "/auth", search: { redirectTo: location.href } });
    }
    return { user: data.user };
  },
  // Keep a minimal loader on screen while the session is restored instead of
  // flashing a blank/black screen or bouncing to the auth page.
  pendingComponent: () => (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  ),
  component: () => <Outlet />,
});
