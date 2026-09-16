import { supabase } from "@/lib/cloud-client";

/** Writes an admin action into the live audit_logs table. */
export async function logAdminAction(
  actionType: string,
  targetTable: string,
  targetId: string | null,
  meta: Record<string, unknown> = {},
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const adminId = auth.user?.id;
  if (!adminId) return;
  await supabase.from("audit_logs").insert({
    admin_id: adminId,
    action_type: actionType,
    target_table: targetTable,
    target_id: targetId,
    meta: meta as never,
  });
}
