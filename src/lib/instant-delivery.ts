import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/cloud-client";
import type { ListingCategory } from "@/lib/catalog";

export const INSTANT_BUCKET = "digital-deliverables";

/** Freelance runs the full escrow workspace; every other category is fulfilled instantly. */
export function isInstantCategory(category: string | null | undefined): boolean {
  return !!category && category !== "freelance";
}

export type InstantDelivery = {
  listing_id: string;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
};

/** Seller-side or buyer-side read of the protected instant-delivery payload. */
export function useInstantDelivery(listingId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["instant-delivery", listingId],
    enabled: !!listingId && enabled,
    queryFn: async (): Promise<InstantDelivery | null> => {
      const { data, error } = await supabase
        .from("listing_instant_delivery")
        .select("listing_id,content,file_path,file_name")
        .eq("listing_id", listingId!)
        .maybeSingle();
      if (error) throw error;
      return (data as InstantDelivery | null) ?? null;
    },
  });
}

/** Short-lived signed URL for the purchased deliverable file. */
export async function signInstantFile(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(INSTANT_BUCKET).createSignedUrl(path, 60 * 30);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Uploads the seller's deliverable file into their own folder. */
export async function uploadInstantFile(userId: string, file: File): Promise<{ path: string; name: string }> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `${userId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(INSTANT_BUCKET).upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  return { path, name: safeName };
}

/** Creates or replaces the instant payload attached to a listing. */
export async function saveInstantDelivery(input: {
  listingId: string;
  ownerId: string;
  content: string | null;
  filePath: string | null;
  fileName: string | null;
}) {
  const { error } = await supabase.from("listing_instant_delivery").upsert(
    {
      listing_id: input.listingId,
      owner_id: input.ownerId,
      content: input.content,
      file_path: input.filePath,
      file_name: input.fileName,
    },
    { onConflict: "listing_id" },
  );
  if (error) throw new Error(error.message);
}

export type { ListingCategory };
