import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/cloud-client";

export type AdminService = {
  id: string;
  title_ar: string;
  title_en: string;
  category: string;
  price_usdt: number;
  is_published: boolean;
  cover_url: string;
  created_at: string;
  owner_id: string | null;
  sellerName: string;
};

/** Live services (listings) for the admin moderation desk — admin RLS returns every row. */
export function useAdminServices(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-services"],
    enabled,
    queryFn: async (): Promise<AdminService[]> => {
      const { data, error } = await supabase
        .from("listings")
        .select("id,title_ar,title_en,category,price_usdt,is_published,cover_url,created_at,owner_id,seller_ar,seller_en")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];

      const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter((v): v is string => !!v))];
      const names = new Map<string, string>();
      if (ownerIds.length) {
        const { data: profiles, error: pErr } = await supabase
          .from("profiles")
          .select("id,display_name")
          .in("id", ownerIds);
        if (pErr) throw pErr;
        for (const p of profiles ?? []) names.set(p.id, (p.display_name ?? "").replace(/^@+/, "").trim());
      }

      return rows.map((r) => ({
        id: r.id,
        title_ar: r.title_ar,
        title_en: r.title_en,
        category: String(r.category),
        price_usdt: Number(r.price_usdt ?? 0),
        is_published: !!r.is_published,
        cover_url: (r.cover_url ?? "").trim(),
        created_at: r.created_at,
        owner_id: r.owner_id,
        sellerName:
          (r.owner_id ? names.get(r.owner_id) : "") ||
          (r.seller_ar ?? "").trim() ||
          (r.seller_en ?? "").trim() ||
          "—",
      }));
    },
  });
}

async function writeAuditLog(actionType: string, targetId: string, meta: Record<string, unknown>) {
  const { data: auth } = await supabase.auth.getUser();
  const adminId = auth.user?.id;
  if (!adminId) return;
  await supabase.from("audit_logs").insert({
    admin_id: adminId,
    action_type: actionType,
    target_table: "listings",
    target_id: targetId,
    meta: meta as never,
  });
}

/** Suspend / re-activate a service without deleting it. */
export function useToggleService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const { error } = await supabase.from("listings").update({ is_published: next }).eq("id", id);
      if (error) throw error;
      await writeAuditLog(next ? "SERVICE_ACTIVATED" : "SERVICE_SUSPENDED", id, { is_published: next });
      return next;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-services"] });
      void qc.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}

/** Permanent removal of a service record. */
export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await writeAuditLog("SERVICE_DELETED", id, {});
      const { error } = await supabase.from("listings").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-services"] });
      void qc.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}
