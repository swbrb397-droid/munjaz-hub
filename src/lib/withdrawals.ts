import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { isValidAddress, parseUsdt, sanitizeAddress, sanitizeText, throttle } from "@/lib/security";

export type WithdrawalNetwork = "trc20" | "bep20" | "polygon";
export type WithdrawalStatus =
  | "queued"
  | "auto_approved"
  | "manual_review"
  | "processing"
  | "paid"
  | "rejected";

export const WITHDRAWAL_FEE = 0.8;
export const MIN_WITHDRAWAL = 10;

export function slaHoursForTier(tier: string | null | undefined): number {
  return tier === "pro" || tier === "corporate" ? 12 : 48;
}

/** Human message for the error codes raised by the database routines. */
export function withdrawalErrorMessage(raw: string, ar: boolean): string {
  const map: Record<string, [string, string]> = {
    RATE_LIMITED: ["تجاوزت عدد المحاولات المسموح بها. حاول لاحقاً.", "Too many attempts. Please try again later."],
    INVALID_AMOUNT: ["أدخل مبلغاً صحيحاً.", "Enter a valid amount."],
    MIN_WITHDRAWAL_10: ["الحد الأدنى للسحب 10 USDT.", "Minimum withdrawal is 10 USDT."],
    INVALID_ADDRESS: ["عنوان المحفظة غير صالح.", "Invalid wallet address."],
    INSUFFICIENT_FUNDS: ["الرصيد غير كافٍ (شامل الرسوم).", "Insufficient balance (including fees)."],
    ACCOUNT_FROZEN: ["الحساب مجمّد أمنياً — تواصل مع الدعم.", "Account frozen for security — contact support."],
    NOT_AUTHENTICATED: ["يجب تسجيل الدخول.", "You must be signed in."],
    FORBIDDEN: ["صلاحيات غير كافية.", "Insufficient permissions."],
  };
  const key = Object.keys(map).find((k) => raw.includes(k));
  if (!key) return raw;
  const entry = map[key]!;
  return ar ? entry[0] : entry[1];
}

export function useMyWithdrawals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["withdrawals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRequestWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { amount: string; network: WithdrawalNetwork; address: string }) => {
      if (!throttle("withdrawal", 3, 60_000)) throw new Error("RATE_LIMITED");
      const amount = parseUsdt(input.amount);
      if (amount === null) throw new Error("INVALID_AMOUNT");
      if (amount < MIN_WITHDRAWAL) throw new Error("MIN_WITHDRAWAL_10");
      const address = sanitizeAddress(input.address);
      if (!isValidAddress(address)) throw new Error("INVALID_ADDRESS");

      const { data, error } = await supabase.rpc("request_withdrawal", {
        _amount: amount,
        _network: input.network,
        _address: address,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useWithdrawalQueue(enabled: boolean) {
  return useQuery({
    queryKey: ["withdrawal-queue"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useResolveWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; action: "approve" | "pay" | "reject"; note?: string; txHash?: string }) => {
      const { error } = await supabase.rpc("resolve_withdrawal", {
        _id: input.id,
        _action: input.action,
        ...(input.note ? { _note: sanitizeText(input.note, 300) } : {}),
        ...(input.txHash ? { _tx_hash: sanitizeText(input.txHash, 120) } : {}),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["withdrawal-queue"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

export function useSecurityIncidents(enabled: boolean) {
  return useQuery({
    queryKey: ["security-incidents"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_incidents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSetAccountFrozen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; frozen: boolean; reason?: string }) => {
      const { error } = await supabase.rpc("set_account_frozen", {
        _user_id: input.userId,
        _frozen: input.frozen,
        ...(input.reason ? { _reason: sanitizeText(input.reason, 300) } : {}),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["security-incidents"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/** Security sentinel: record unauthorized admin-area access attempts. */
export async function logSecurityEvent(kind: "admin_access_attempt", detail: string) {
  await supabase.rpc("log_security_event", {
    _kind: kind,
    _detail: sanitizeText(detail, 300),
    _meta: { path: typeof window !== "undefined" ? window.location.pathname : "" },
  });
}
