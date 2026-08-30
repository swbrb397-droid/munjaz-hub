import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@/integrations/supabase/types";

export type UserProfile = Tables<"profiles"> & { role?: string | null };

/** Hard-coded platform owner fallback (kept only as an emergency escape hatch). */

/**
 * Reactive profile + role hook.
 *
 * Re-runs on every auth state change (the session comes from `useAuth`, which
 * subscribes to `supabase.auth.onAuthStateChange`), so the sidebar reflects
 * admin rights immediately after sign-in / sign-out.
 */
export function useUserProfile() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["user-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
      ]);
      if (profileRes.error) throw profileRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const roles = (rolesRes.data ?? []).map((r) => String(r.role));
      const profile = profileRes.data as Tables<"profiles"> | null;
      return {
        profile: profile ? ({ ...profile, role: roles.includes("admin") ? "admin" : (roles[0] ?? null) } as UserProfile) : null,
        roles,
      };
    },
  });

  const roles = query.data?.roles ?? [];
  const isAdmin = roles.includes("admin");

  return {
    user,
    profile: query.data?.profile ?? null,
    roles,
    isAdmin,
    loading: authLoading || (!!user && query.isLoading),
    settled: !authLoading && (!user || (!query.isLoading && query.data !== undefined)),
    refetch: query.refetch,
  };
}
