import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/cloud-client";
import type { Tables } from "@/integrations/supabase/types";
import { logAuditEvent } from "@/lib/audit";

export type DisputeCase = Tables<"dispute_cases">;
export type Order = Tables<"orders">;

export type DisputeParty = { id: string; display_name: string };

export type AdminDispute = DisputeCase & {
  order: Order | null;
  buyer: DisputeParty | null;
  seller: DisputeParty | null;
};

/** All dispute cases joined with their escrow order (admin only). */
export function useAdminDisputes(enabled: boolean, onlyOpen = true) {
  return useQuery({
    queryKey: ["admin-disputes", onlyOpen],
    enabled,
    queryFn: async (): Promise<AdminDispute[]> => {
      let q = supabase.from("dispute_cases").select("*").order("created_at", { ascending: false }).limit(100);
      if (onlyOpen) q = q.in("status", ["open", "ai_reviewed"]);
      const { data, error } = await q;
      if (error) throw error;
      const cases = (data ?? []) as DisputeCase[];
      const ids = cases.map((c) => c.order_id).filter((v): v is string => !!v);
      let orders: Order[] = [];
      if (ids.length) {
        const res = await supabase.from("orders").select("*").in("id", ids);
        if (res.error) throw res.error;
        orders = (res.data ?? []) as Order[];
      }
      const byId = new Map(orders.map((o) => [o.id, o]));

      // Buyer / seller display names for the resolution desk.
      const partyIds = Array.from(
        new Set(orders.flatMap((o) => [o.buyer_id, o.seller_id]).filter(Boolean)),
      );
      let parties: DisputeParty[] = [];
      if (partyIds.length) {
        const pres = await supabase.from("profiles").select("id, display_name").in("id", partyIds);
        if (pres.error) throw pres.error;
        parties = (pres.data ?? []) as DisputeParty[];
      }
      const byParty = new Map(parties.map((p) => [p.id, p]));

      return cases.map((c) => {
        const order = c.order_id ? (byId.get(c.order_id) ?? null) : null;
        return {
          ...c,
          order,
          buyer: order ? (byParty.get(order.buyer_id) ?? null) : null,
          seller: order ? (byParty.get(order.seller_id) ?? null) : null,
        };
      });
    },
  });
}

export function useCaseMessages(orderId: string | null) {
  return useQuery({
    queryKey: ["admin-case-messages", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_messages")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tables<"order_messages">[];
    },
  });
}

export function useCaseDeliverables(orderId: string | null) {
  return useQuery({
    queryKey: ["admin-case-deliverables", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_deliverables")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Tables<"order_deliverables">[];
    },
  });
}

/** Signed URL for a file kept in the private digital-vault bucket. */
export async function vaultUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("digital-vault").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

/** Release escrow to the seller or refund the buyer, then close the case. */
export function useResolveDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; action: "release" | "refund"; ruling?: string }) => {
      const { error } = await supabase.rpc("admin_resolve_dispute", {
        _case_id: input.id,
        _action: input.action,
        ...(input.ruling ? { _ruling: input.ruling } : {}),
      });
      if (error) throw error;
      logAuditEvent({
        type: "DISPUTE_FLAG",
        userId: null,
        target: input.id,
        meta: { action: input.action },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-disputes"] });
      void qc.invalidateQueries({ queryKey: ["disputes"] });
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}
