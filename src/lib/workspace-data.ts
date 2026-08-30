import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { sanitizeText } from "@/lib/security";
import type { Tables } from "@/integrations/supabase/types";

export type OrderMessage = Tables<"order_messages">;
export type OrderMilestone = Tables<"order_milestones">;
export type OrderDeliverable = Tables<"order_deliverables">;

/* ------------------------------------------------------------------ chat */

export function useOrderMessages(orderId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["order_messages", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_messages")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime delivery for both parties.
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-messages-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        () => void qc.invalidateQueries({ queryKey: ["order_messages", orderId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, qc]);

  return query;
}

export function useSendMessage(orderId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, lang }: { body: string; lang: string }) => {
      if (!orderId) throw new Error("NO_ORDER");
      const { error } = await supabase.from("order_messages").insert({
        order_id: orderId,
        sender_id: user!.id,
        body: sanitizeText(body, 2000),
        lang,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order_messages", orderId] }),
  });
}

export function useEditMessage(orderId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body, version }: { id: string; body: string; version: number }) => {
      const { error } = await supabase
        .from("order_messages")
        .update({
          body: sanitizeText(body, 2000),
          edited_at: new Date().toISOString(),
          version: version + 1,
          translations: {},
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order_messages", orderId] }),
  });
}

/** Persists a machine translation so the pair is billed once per message version. */
export function useCacheTranslation(orderId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, translations }: { id: string; translations: Record<string, string> }) => {
      const { error } = await supabase.from("order_messages").update({ translations }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order_messages", orderId] }),
  });
}

/* ------------------------------------------------------------ milestones */

export function useOrderMilestones(orderId: string | null) {
  return useQuery({
    queryKey: ["order_milestones", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_milestones")
        .select("*")
        .eq("order_id", orderId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateMilestones(orderId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { title: string; pct: number; amount_usdt: number; position: number }[]) => {
      if (!orderId) throw new Error("NO_ORDER");
      const { error } = await supabase
        .from("order_milestones")
        .insert(rows.map((r) => ({ ...r, order_id: orderId })));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order_milestones", orderId] }),
  });
}

export function useReleaseMilestone(orderId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("order_milestones")
        .update({ status: "released", released_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order_milestones", orderId] }),
  });
}

/* ---------------------------------------------------------- deliverables */

export const VAULT_BUCKET = "digital-vault";

export function useOrderDeliverables(orderId: string | null) {
  return useQuery({
    queryKey: ["order_deliverables", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_deliverables")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function useUploadDeliverable(orderId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, isFinal }: { file: File; isFinal: boolean }) => {
      if (!orderId) throw new Error("NO_ORDER");
      const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const path = `${orderId}/${Date.now()}-${safeName}`;
      const buffer = await file.arrayBuffer();
      const checksum = await sha256Hex(buffer);

      const up = await supabase.storage.from(VAULT_BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (up.error) throw up.error;

      const { error } = await supabase.from("order_deliverables").insert({
        order_id: orderId,
        uploader_id: user!.id,
        file_name: file.name.slice(0, 160),
        storage_path: path,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        checksum,
        is_final: isFinal,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order_deliverables", orderId] }),
  });
}

/** Registers an external link (Drive/Figma/…) as a deliverable entry. */
export function useLinkDeliverable(orderId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ link, isFinal }: { link: string; isFinal: boolean }) => {
      if (!orderId) throw new Error("NO_ORDER");
      const value = sanitizeText(link, 500);
      const { error } = await supabase.from("order_deliverables").insert({
        order_id: orderId,
        uploader_id: user!.id,
        file_name: value,
        storage_path: value,
        mime_type: "link/url",
        size_bytes: 0,
        is_final: isFinal,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order_deliverables", orderId] }),
  });
}

export function useSetDeliverableApproval(orderId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, state }: { id: string; state: "pending" | "revision" | "approved" }) => {
      const { error } = await supabase.from("order_deliverables").update({ approval_state: state }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order_deliverables", orderId] }),
  });
}

/** Time-limited signed URL for a private vault object (links pass through unchanged). */
export async function vaultUrl(storagePath: string, seconds = 900) {
  if (/^https?:\/\//.test(storagePath)) return storagePath;
  const { data, error } = await supabase.storage.from(VAULT_BUCKET).createSignedUrl(storagePath, seconds);
  if (error) throw error;
  return data.signedUrl;
}
