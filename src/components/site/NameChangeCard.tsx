import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type ProfileLike = { display_name?: string | null; is_verified?: boolean | null; name_changes_count?: number | null } | null;

/**
 * One-time account name change. Locked permanently once used or once the
 * account is KYC-verified.
 */
export function NameChangeControl({ profile }: { profile: ProfileLike }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile?.display_name ?? "");

  const changes = Number(profile?.name_changes_count ?? 0);
  const locked = changes >= 1 || profile?.is_verified === true;

  const save = useMutation({
    mutationFn: async (value: string) => {
      if (!user) throw new Error("NOT_AUTHENTICATED");
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: value, name_changes_count: 1 } as never)
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setOpen(false);
      toast.success("تم تحديث اسم الحساب نهائياً");
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["user-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (locked)
    return (
      <span
        title="الاسم مثبت نهائياً ولا يمكن تغييره"
        className="inline-flex select-none items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-bold text-muted-foreground"
      >
        <Lock className="size-3.5" /> الاسم مثبت نهائياً
      </span>
    );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setName(profile?.display_name ?? "");
          setOpen(true);
        }}
        className="inline-flex select-none items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary"
      >
        <Pencil className="size-3.5" /> تعديل الاسم
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-background/80 p-4 backdrop-blur" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="min-w-0 truncate text-lg font-black">تعديل اسم الحساب</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="grid size-8 shrink-0 place-items-center rounded-lg border border-border">
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-3 rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs font-bold leading-relaxed text-accent">
              ⚠️ تنبيه: يُسمح بتعديل اسم الحساب مرة واحدة فقط؛ لن تتمكن من تغييره لاحقاً
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الاسم الجديد"
              className="mt-4 w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={save.isPending || name.trim().length < 3}
              onClick={() => save.mutate(name.trim())}
              className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              {save.isPending ? "جارٍ الحفظ…" : "تأكيد التعديل النهائي"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
