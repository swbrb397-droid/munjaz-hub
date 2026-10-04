import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/cloud-client";
import { useLang } from "@/lib/lang";

/** Seller-side inventory of single-use license keys for one instant listing. */
export function LicenseKeysManager({ listingId }: { listingId: string }) {
  const { tr } = useLang();
  const qc = useQueryClient();
  const [bulk, setBulk] = useState("");
  const keys = useQuery({
    queryKey: ["license-keys", listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_license_keys")
        .select("id,key_text,is_redeemed,created_at")
        .eq("listing_id", listingId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const rows = Array.from(new Set(bulk.split("\n").map((s) => s.trim()).filter(Boolean)))
        .slice(0, 500)
        .map((key_text) => ({ listing_id: listingId, key_text: key_text.slice(0, 500) }));
      if (!rows.length) return 0;
      const { error } = await supabase.from("listing_license_keys").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      setBulk("");
      if (n) toast.success(tr(`أُضيف ${n} مفتاح`, `${n} keys added`));
      void qc.invalidateQueries({ queryKey: ["license-keys", listingId] });
    },
    onError: () => toast.error(tr("تعذّر حفظ المفاتيح", "Could not save keys")),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("listing_license_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["license-keys", listingId] }),
  });

  const list = keys.data ?? [];
  const unused = list.filter((k) => !k.is_redeemed).length;

  return (
    <div className="mt-6 grid gap-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="inline-flex items-center gap-2 text-sm font-black">
          <KeyRound className="size-4 text-primary" /> {tr("مفاتيح الترخيص (استخدام واحد)", "Single-use license keys")}
        </h4>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${unused ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
          {tr("المتاح:", "Available:")} <bdi>{unused}</bdi> / <bdi>{list.length}</bdi>
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {tr(
          "عند إضافة مفاتيح، يحصل كل مشترٍ على مفتاح واحد فقط، ويصبح العرض «نفد المخزون» عند انتهائها.",
          "Once keys are added, each buyer gets exactly one key and the listing shows “Out of stock” when they run out.",
        )}
      </p>
      <textarea
        dir="ltr"
        value={bulk}
        onChange={(e) => setBulk(e.target.value)}
        rows={4}
        placeholder={tr("مفتاح في كل سطر", "One key per line")}
        className="rounded-xl border border-border bg-background p-3 font-mono text-xs"
      />
      <button
        type="button"
        onClick={() => add.mutate()}
        disabled={add.isPending || !bulk.trim()}
        className="inline-flex h-10 w-fit items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {add.isPending && <Loader2 className="size-4 animate-spin" />} {tr("إضافة المفاتيح", "Add keys")}
      </button>
      {list.length > 0 && (
        <ul className="grid max-h-60 gap-1 overflow-auto">
          {list.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5 text-xs">
              <span dir="ltr" className={`truncate font-mono ${k.is_redeemed ? "text-muted-foreground line-through" : ""}`}>
                {k.key_text}
              </span>
              {k.is_redeemed ? (
                <span className="shrink-0 text-[10px] font-bold text-muted-foreground">{tr("مُباع", "Sold")}</span>
              ) : (
                <button type="button" aria-label={tr("حذف", "Delete")} onClick={() => remove.mutate(k.id)} className="shrink-0 text-destructive">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
