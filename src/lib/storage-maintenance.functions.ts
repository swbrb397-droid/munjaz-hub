import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only: removes unreferenced vault files of completed orders older than 180 days. */
export const purgeOrphanedVaultFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("orphaned_vault_objects", { p_limit: 500 });
    if (error) throw new Error(error.message);
    const names = (data ?? []).map((r: { name: string }) => r.name);
    if (names.length) {
      const { error: rmErr } = await supabaseAdmin.storage.from("digital-vault").remove(names);
      if (rmErr) throw new Error(rmErr.message);
    }
    await context.supabase.from("audit_logs").insert({
      admin_id: context.userId,
      action_type: "storage_orphan_purge",
      target_table: "storage.objects",
      meta: { removed: names.length },
    });
    return { removed: names.length };
  });
