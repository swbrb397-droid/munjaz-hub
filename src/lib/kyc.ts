import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@/integrations/supabase/types";

export type KycSubmission = Tables<"kyc_submissions">;

const BUCKET = "kyc-documents";

async function uploadDoc(userId: string, side: "front" | "back", file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${side}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

/** Signed preview URL for a stored KYC document (valid 5 minutes). */
export async function kycDocUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

export function useMyKyc() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["kyc-mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kyc_submissions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as KycSubmission[];
    },
  });
}

export function useSubmitKyc() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { docType: string; front: File; back?: File | null }) => {
      if (!user) throw new Error("NOT_AUTHENTICATED");
      const frontPath = await uploadDoc(user.id, "front", input.front);
      const backPath = input.back ? await uploadDoc(user.id, "back", input.back) : undefined;
      const { data, error } = await supabase.rpc("submit_kyc", {
        _doc_type: input.docType,
        _front_path: frontPath,
        ...(backPath ? { _back_path: backPath } : {}),
      });
      if (error) throw error;
      return data as unknown as KycSubmission;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["kyc-mine"] });
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}

/* ------------------------------------------------------------------ admin */

export type KycRow = KycSubmission & { profile: { display_name: string; kyc_status: string } | null };

export function useKycSubmissions(enabled: boolean, status: "pending" | "approved" | "rejected" | "all" = "pending") {
  return useQuery({
    queryKey: ["kyc-submissions", status],
    enabled,
    queryFn: async (): Promise<KycRow[]> => {
      let q = supabase.from("kyc_submissions").select("*").order("created_at", { ascending: false }).limit(100);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as KycSubmission[];
      if (rows.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, kyc_status")
        .in("id", rows.map((r) => r.user_id));

      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({
        ...r,
        profile: (byId.get(r.user_id) as { display_name: string; kyc_status: string } | undefined) ?? null,
      }));
    },
  });
}

export function useReviewKyc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; approve: boolean; note?: string }) => {
      const { error } = await supabase.rpc("admin_review_kyc", {
        _submission_id: input.id,
        _approve: input.approve,
        ...(input.note ? { _note: input.note } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["kyc-submissions"] });
      void qc.invalidateQueries({ queryKey: ["kyc-queue"] });
    },
  });
}
