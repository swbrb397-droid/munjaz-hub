import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ExtensionRequest = {
  id: string;
  order_id: string;
  requested_by: string;
  hours: number;
  reason: string;
  status: string;
  resolved_at: string | null;
  created_at: string;
};

/** Pending delivery-extension requests for the given orders. */
export function usePendingExtensions(orderIds: string[]) {
  const key = [...orderIds].sort().join(",");
  return useQuery({
    queryKey: ["extension-requests", key],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extension_requests")
        .select("*")
        .in("order_id", orderIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const out: Record<string, ExtensionRequest> = {};
      for (const row of (data ?? []) as ExtensionRequest[]) {
        if (!out[row.order_id]) out[row.order_id] = row;
      }
      return out;
    },
  });
}

/** Seller asks the buyer for +24h or +48h. */
export function useRequestExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      orderId: string;
      hours: 24 | 48;
      reason: string;
      sellerId: string;
    }) => {
      const { error } = await supabase.from("extension_requests").insert({
        order_id: input.orderId,
        requested_by: input.sellerId,
        hours: input.hours,
        reason: input.reason.slice(0, 500),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["extension-requests"] });
    },
  });
}

/** Buyer accepts or rejects; accepting pushes the order deadline server-side. */
export function useResolveExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; accept: boolean }) => {
      const { error } = await supabase.rpc("resolve_extension_request", {
        _id: input.id,
        _accept: input.accept,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["extension-requests"] });
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

/** True once the delivery deadline has been missed by more than 24 hours. */
export function isAbandoned(dueAt: string | null | undefined, status: string): boolean {
  if (status !== "in_progress") return false;
  if (!dueAt) return false;
  return Date.now() - new Date(dueAt).getTime() > 24 * 3600_000;
}
