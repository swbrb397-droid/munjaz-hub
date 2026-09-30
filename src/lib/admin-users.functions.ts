import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertAdmin({ supabase, userId }: Ctx) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("FORBIDDEN");
}

export type AdminUserRow = {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  referral_code: string;
  created_at: string;
  is_frozen: boolean;
  frozen_reason: string | null;
  is_deactivated: boolean;
  kyc_status: string;
  is_verified: boolean;
  account_tier: string;
  last_sign_in_at: string | null;
  roles: string[];
  available_usdt: number;
  locked_usdt: number;
  lifetime_earned: number;
  invited_count: number;
  referral_earned: number;
  latest_kyc: string | null;
};

/** Live admin directory: profiles joined with wallets, roles, KYC, referrals and auth emails. */
export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserRow[]> => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Single round-trip aggregate (admin-checked inside the SQL function).
    const dir = await (context as Ctx).supabase.rpc("admin_get_users_directory");
    if (dir.error) throw new Error(dir.error.message);

    const emails = new Map<string, { email: string | null; last: string | null }>();
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      for (const u of data.users) emails.set(u.id, { email: u.email ?? null, last: u.last_sign_in_at ?? null });
      if (data.users.length < 1000) break;
    }

    return ((dir.data ?? []) as any[]).map((p) => ({
      ...p,
      email: emails.get(p.id)?.email ?? null,
      last_sign_in_at: emails.get(p.id)?.last ?? null,
      roles: p.roles ?? [],
      available_usdt: Number(p.available_usdt ?? 0),
      locked_usdt: Number(p.locked_usdt ?? 0),
      lifetime_earned: Number(p.lifetime_earned ?? 0),
      invited_count: Number(p.invited_count ?? 0),
      referral_earned: Number(p.referral_earned ?? 0),
      latest_kyc: p.latest_kyc ?? null,
    })) as AdminUserRow[];
  });

/** Revokes or restores sign-in access at the auth layer (after the DB RPC flagged the profile). */
export const adminSetAuthAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; blocked: boolean }) => {
    const userId = String(input?.userId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("INVALID_USER");
    return { userId, blocked: !!input?.blocked };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    if (data.userId === (context as Ctx).userId) throw new Error("CANNOT_TARGET_SELF");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.blocked ? "876000h" : "none",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin alert email: sends the matching notification by email; never throws on delivery failure. */
export const adminEmailNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; title: string; message: string }) => {
    const userId = String(input?.userId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("INVALID_USER");
    const title = String(input?.title ?? "").trim().slice(0, 150);
    const message = String(input?.message ?? "").trim().slice(0, 2000);
    if (!title || !message) throw new Error("INVALID_INPUT");
    return { userId, title, message };
  })
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPlatformEmail, notificationEmailHtml } = await import("./resend.server");
    const log = async (action: string, meta: Record<string, unknown>) => {
      await supabaseAdmin.from("audit_logs").insert({
        admin_id: ctx.userId, action_type: action, target_table: "notifications", target_id: data.userId, meta: meta as never,
      });
    };
    try {
      const { data: u, error } = await supabaseAdmin.auth.admin.getUserById(data.userId);
      const email = u?.user?.email;
      if (error || !email) {
        await log("admin_email_skipped", { reason: "no_email" });
        return { emailed: false };
      }
      const res = await sendPlatformEmail({
        to: email,
        subject: data.title,
        html: notificationEmailHtml(data.title, data.message, "/dashboard"),
        text: `${data.title}\n\n${data.message}`,
        actorId: ctx.userId,
      });
      await log(res.delivered ? "admin_email_sent" : "admin_email_failed", { via: res.via, subject: data.title.slice(0, 120) });
      return { emailed: res.delivered };
    } catch (e) {
      await log("admin_email_failed", { error: (e instanceof Error ? e.message : String(e)).slice(0, 200) }).catch(() => {});
      return { emailed: false };
    }
  });
