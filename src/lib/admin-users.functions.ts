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

    const [profiles, wallets, roles, kyc, refs] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,display_name,avatar_url,referral_code,created_at,is_frozen,frozen_reason,is_deactivated,kyc_status,is_verified,account_tier")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabaseAdmin.from("wallets").select("user_id,available_usdt,locked_usdt,lifetime_earned"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin.from("kyc_submissions").select("user_id,status,created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("referrals").select("referrer_id,total_earned_usdt"),
    ]);
    for (const r of [profiles, wallets, roles, kyc, refs]) if (r.error) throw new Error(r.error.message);

    const emails = new Map<string, { email: string | null; last: string | null }>();
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      for (const u of data.users) emails.set(u.id, { email: u.email ?? null, last: u.last_sign_in_at ?? null });
      if (data.users.length < 1000) break;
    }

    const w = new Map((wallets.data ?? []).map((x) => [x.user_id, x]));
    const rl = new Map<string, string[]>();
    for (const r of roles.data ?? []) rl.set(r.user_id, [...(rl.get(r.user_id) ?? []), String(r.role)]);
    const kl = new Map<string, string>();
    for (const k of kyc.data ?? []) if (!kl.has(k.user_id)) kl.set(k.user_id, k.status);
    const rf = new Map<string, { n: number; e: number }>();
    for (const r of refs.data ?? []) {
      const cur = rf.get(r.referrer_id) ?? { n: 0, e: 0 };
      rf.set(r.referrer_id, { n: cur.n + 1, e: cur.e + Number(r.total_earned_usdt ?? 0) });
    }

    return (profiles.data ?? []).map((p) => ({
      ...p,
      email: emails.get(p.id)?.email ?? null,
      last_sign_in_at: emails.get(p.id)?.last ?? null,
      roles: rl.get(p.id) ?? [],
      available_usdt: Number(w.get(p.id)?.available_usdt ?? 0),
      locked_usdt: Number(w.get(p.id)?.locked_usdt ?? 0),
      lifetime_earned: Number(w.get(p.id)?.lifetime_earned ?? 0),
      invited_count: rf.get(p.id)?.n ?? 0,
      referral_earned: rf.get(p.id)?.e ?? 0,
      latest_kyc: kl.get(p.id) ?? null,
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
