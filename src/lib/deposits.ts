import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/cloud-client";
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
        ...(input.address ? { _address: input.address } : {}),
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
        ...(input.txHash ? { _tx_hash: input.txHash } : {}),
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

/**
 * Fires when the authenticated user's available balance increases (realtime
 * UPDATE on public.wallets). Used to auto-dismiss the "awaiting payment" state.
 */
export function useWalletCredit(onCredit: (delta: number, available: number) => void) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const cb = useRef(onCredit);
  cb.current = onCredit;

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`wallet-credit-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const next = Number((payload.new as { available_usdt?: number } | null)?.available_usdt ?? 0);
          const prev = Number((payload.old as { available_usdt?: number } | null)?.available_usdt ?? next);
          // Optimistic: push the fresh balance into the cache immediately.
          qc.setQueryData(["wallet"], (old: unknown) =>
            old && typeof old === "object" ? { ...(old as object), ...(payload.new as object) } : old,
          );
          void qc.invalidateQueries({ queryKey: ["wallet"] });
          void qc.invalidateQueries({ queryKey: ["transactions"] });
          if (next > prev) cb.current(next - prev, next);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, qc]);
}
