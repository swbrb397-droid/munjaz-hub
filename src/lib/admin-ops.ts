import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/cloud-client";

export type PlatformOverview = {
  totalUsers: number;
  pendingKyc: number;
  escrowLocked: number;
  depositsTotal: number;
  depositsCount: number;
  openDisputes: number;
  pendingWithdrawals: number;
  frozenAccounts: number;
};

/** Live super-admin counters from a single SECURITY DEFINER RPC (bypasses RLS safely). */
export function useAdminOverview(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-overview"],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<PlatformOverview> => {
      const { data, error } = await supabase.rpc("get_admin_dashboard_metrics");
      if (error) throw error;
      const row = (data ?? {}) as Record<string, unknown>;
      return {
        totalUsers: Number(row["total_users"] ?? 0),
        pendingKyc: Number(row["pending_kyc"] ?? 0),
        escrowLocked: Number(row["locked_escrow"] ?? 0),
        depositsTotal: Number(row["deposits_total"] ?? 0),
        depositsCount: Number(row["completed_deposits"] ?? 0),
        openDisputes: Number(row["open_disputes"] ?? 0),
        pendingWithdrawals: Number(row["pending_withdrawals"] ?? 0),
        frozenAccounts: Number(row["frozen_accounts"] ?? 0),
      };
    },
  });
}

export type SandboxKind = "deposit" | "kyc" | "dispute";

/** Super-admin test bench: simulate a deposit IPN, a KYC request, or a disputed order. */
export function useSandboxAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (kind: SandboxKind) => {
      const { data, error } = await supabase.rpc("admin_sandbox_action", { _kind: kind });
      if (error) throw error;
      return data as Record<string, unknown>;
    },
    onSuccess: () => {
      for (const key of [
        ["admin-overview"],
        ["wallet"],
        ["transactions"],
        ["kyc-submissions"],
        ["kyc-queue"],
        ["admin-disputes"],
        ["disputes"],
        ["orders"],
      ]) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
