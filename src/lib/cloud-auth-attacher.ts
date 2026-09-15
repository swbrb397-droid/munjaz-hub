import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/lib/cloud-client";

/** Attach the access token issued by this project's Lovable Cloud instance. */
export const attachCloudAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data, error } = await supabase.auth.getSession();
  if (error) console.error("[server-function-auth] Could not read session", error.message);
  const token = data.session?.access_token;
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});