import { lovable } from "@/integrations/lovable";
import { supabase } from "@/lib/cloud-client";
import { clearStoredReferralCode, storedReferralCode } from "@/lib/referral-capture";

const PENDING_KEY = "munjaz_oauth_pending";

/** Starts Google sign-in via the managed broker; returns to the public origin. */
export async function signInWithGoogle(): Promise<{ error?: Error; done: boolean }> {
  try {
    window.sessionStorage.setItem(PENDING_KEY, "1");
  } catch {
    /* ignore */
  }
  const result = (await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
  })) as { redirected?: boolean; error?: Error | null; tokens?: { access_token: string; refresh_token: string } };
  if (result.redirected) return { done: false };
  if (result.error) {
    window.sessionStorage.removeItem(PENDING_KEY);
    return { error: result.error, done: false };
  }
  // Mirror the session into the app's live client.
  if (result.tokens) await supabase.auth.setSession(result.tokens);
  return { done: true };
}

/** After OAuth returns: attach any stored referral once, then report whether to go to the dashboard. */
export async function finishGoogleSignIn(): Promise<boolean> {
  let pending = false;
  try {
    pending = window.sessionStorage.getItem(PENDING_KEY) === "1";
    window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
  if (!pending) return false;
  const code = storedReferralCode();
  if (code) {
    try {
      await supabase.rpc("attach_referral_after_oauth", { p_code: code });
    } catch {
      /* best effort */
    }
    clearStoredReferralCode();
  }
  return true;
}
