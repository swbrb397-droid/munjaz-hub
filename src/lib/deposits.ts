import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@/integrations/supabase/types";

export type WalletTx = Tables<"wallet_transactions">;
export type DepositNetwork = "trc20" | "bep20" | "polygon";

/** Records a pending incoming USDT transfer in the ledger. */
export function useCreateDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { amount: number; network: DepositNetwork; address?: string }) => {
      const { data, error } = await supabase.rpc("create_deposit", {
        _amount: input.amount,
        _network: input.network,
        _address: input.address ?? undefined,
      });
      if (error) throw error;
      return data as unknown as WalletTx;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

/**
 * Webhook-trigger simulator: flips a pending deposit to `confirmed`, which
 * credits `wallets.available_usdt` and writes the ledger record atomically.
 */
export function useConfirmDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; txHash?: string }) => {
      const { data, error } = await supabase.rpc("confirm_deposit", {
        _tx_id: input.id,
        _tx_hash: input.txHash ?? undefined,
      });
      if (error) throw error;
      return data as unknown as WalletTx;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

/** Live wallet + ledger stream so confirmed deposits land without a refresh. */
export function useWalletRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`wallet-stream-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, () => {
        void qc.invalidateQueries({ queryKey: ["wallet"] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${user.id}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["transactions"] });
          void qc.invalidateQueries({ queryKey: ["wallet"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, qc]);
}
