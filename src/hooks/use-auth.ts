import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Restore the persisted session first; only after this resolves may the
    // app treat the user as unauthenticated.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      // Ignore the initial-mount event; getSession() above owns first paint.
      if (event === "INITIAL_SESSION") return;
      // Only clear the session on an explicit sign-out; never on empty/unknown events.
      if (event === "SIGNED_OUT") {
        setSession(null);
        setLoading(false);
        return;
      }
      if (s) {
        setSession(s);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const user: User | null = session?.user ?? null;
  return { session, user, loading, isAuthenticated: !!user };
}
