import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { brokeredPreviewStorage } from "@/integrations/supabase/previewAuthStorage";

function isOpaqueApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createCloudFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isOpaqueApiKey(apiKey) && headers.get("Authorization") === `Bearer ${apiKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

function createCloudClient() {
  const url = import.meta.env["VITE_SUPABASE_URL"];
  const publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  if (!url || !publishableKey) {
    throw new Error("Lovable Cloud connection is unavailable");
  }

  return createClient<Database>(url, publishableKey, {
    global: { fetch: createCloudFetch(publishableKey) },
    auth: {
      storage: brokeredPreviewStorage(),
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let cloudClient: ReturnType<typeof createCloudClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createCloudClient>, {
  get(_, property, receiver) {
    if (!cloudClient) cloudClient = createCloudClient();
    return Reflect.get(cloudClient, property, receiver);
  },
});