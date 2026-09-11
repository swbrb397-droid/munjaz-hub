import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@/integrations/supabase/types";

export type Governance = Tables<"governance_settings">;
export type SubscriptionPass = Tables<"subscription_codes">;
export type AccountTier = SubscriptionPass["plan"];

/* ------------------------------------------------- governance settings */

export function useGovernance(enabled = true) {
  return useQuery({
    queryKey: ["governance"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governance_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateGovernance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Governance>) => {
      const { error } = await supabase
        .from("governance_settings")
        .update({ ...patch, updated_by: user?.id ?? null })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["governance"] }),
  });
}

/* ------------------------------------------------- subscription passes */

export function usePasses(enabled = true) {
  return useQuery({
    queryKey: ["subscription-passes"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_codes")
        .select("*")
        .eq("is_redeemed", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const raw = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `MJ-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export function useCreatePass() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tier: AccountTier; durationDays: number; validDays: number; note?: string }) => {
      const code = randomCode();
      const { error } = await supabase.from("subscription_codes").insert({
        code,
        plan: input.tier === "free" ? "pro" : input.tier,
        duration_days: input.durationDays,
        is_redeemed: false,
        expires_at: new Date(Date.now() + input.validDays * 86_400_000).toISOString(),
        note: input.note?.slice(0, 200) ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      return code;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscription-passes"] }),
  });
}

/** One-time redemption performed by the security-definer RPC. */
export function useRedeemPass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc("redeem_subscription_code", { p_code: code.trim().toUpperCase() });
      if (error) throw error;
      const result = data as { success?: boolean; message?: string } | null;
      if (!result?.success) throw new Error(result?.message ?? "REDEMPTION_FAILED");
      return result;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["subscription-passes"] });
    },
  });
}
