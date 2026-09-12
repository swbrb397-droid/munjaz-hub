import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/** Deterministic code derived from the user id, used when the profile has none yet. */
export function derivedReferralCode(userId: string) {
  return `MJ-${userId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/**
 * Persists a referral code on the profile when it is still null, so the
 * referral link is real data instead of a client-side placeholder.
 */
export function useEnsureReferralCode(storedCode: string | null | undefined, ready: boolean) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const done = useRef(false);

  useEffect(() => {
    if (!ready || !user || storedCode || done.current) return;
    done.current = true;
    void (async () => {
      const code = derivedReferralCode(user.id);
      const { error } = await supabase.from("profiles").update({ referral_code: code }).eq("id", user.id);
      if (!error) {
        void qc.invalidateQueries({ queryKey: ["profile"] });
        void qc.invalidateQueries({ queryKey: ["user-profile"] });
      }
    })();
  }, [ready, user, storedCode, qc]);

  return user ? (storedCode || derivedReferralCode(user.id)) : "";
}
