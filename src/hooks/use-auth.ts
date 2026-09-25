import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/cloud-client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Restore the persisted session first; only after this resolves may the
    // app treat the user as unauthenticated.
    let subscription: { unsubscribe: () => void } | null = null;
    try {
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!mounted) return;
          setSession(data?.session ?? null);
          setLoading(false);
        })
        .catch(() => {
          if (!mounted) return;
          setSession(null);
          setLoading(false);
        });

      subscription = supabase.auth.onAuthStateChange((event, s) => {
        if (!mounted) return;
        if (event === "INITIAL_SESSION") return;
        if (event === "SIGNED_OUT") {
          setSession(null);
          setLoading(false);
          return;
        }
        if (s) {
          setSession(s);
          setLoading(false);
        }
      }).data.subscription;
    } catch {
      setSession(null);
      setLoading(false);
    }

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const user: User | null = session?.user ?? null;
  return { session, user, loading, isAuthenticated: !!user };
}
