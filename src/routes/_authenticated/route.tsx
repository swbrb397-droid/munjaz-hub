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
  component: () => <Outlet />,
});
