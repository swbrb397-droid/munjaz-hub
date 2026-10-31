import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { supabase } from "@/lib/cloud-client";
import { moderateFields } from "@/lib/chat-moderation";

type Axis = "quality" | "communication" | "punctuality";

function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${n <= Math.round(value) ? "fill-accent text-accent" : "text-muted-foreground"}`} />
      ))}
    </span>
  );
}

/** Inline buyer review form for completed orders (used on instant-delivery orders). */
export function OrderReviewCard({ orderId, buyerId, sellerId, userId }: { orderId: string; buyerId: string; sellerId: string; userId: string }) {
  const { tr } = useLang();
  const qc = useQueryClient();
  const [stars, setStars] = useState<Record<Axis, number>>({ quality: 5, communication: 5, punctuality: 5 });
  const [text, setText] = useState("");

  const mine = useQuery({
    queryKey: ["my-review", orderId, userId],
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("rating").eq("order_id", orderId).eq("reviewer_id", userId).maybeSingle();
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const bad = moderateFields(text);
      if (bad) throw new Error(bad);
      const rating = Math.min(5, Math.max(1, Math.round((stars.quality + stars.communication + stars.punctuality) / 3)));
      const { error } = await supabase.from("reviews").insert({
        order_id: orderId, reviewer_id: userId, reviewee_id: sellerId, rating,
        quality: stars.quality, communication: stars.communication, punctuality: stars.punctuality,
        comment: text.trim().slice(0, 500) || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(tr("شكراً، تم نشر تقييمك.", "Thanks, your review is published."));
      void qc.invalidateQueries({ queryKey: ["my-review"] });
      void qc.invalidateQueries({ queryKey: ["seller-reviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (buyerId !== userId || mine.isLoading) return null;
  if (mine.data) {
    return (
      <p className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold">
        {tr("تقييمك:", "Your review:")} <Stars value={mine.data.rating} />
      </p>
    );
  }

  const axes: [Axis, string][] = [
    ["quality", tr("مطابقة المنتج للوصف والمعاينة", "Matches description & preview")],
    ["communication", tr("جودة الملفات وسلامتها", "File quality & integrity")],
    ["punctuality", tr("وضوح الشرح والتعليمات", "Clear docs & instructions")],
  ];

  return (
    <div className="grid gap-3 rounded-2xl border border-border p-4">
      <h3 className="text-sm font-black">{tr("قيّم تجربتك مع البائع", "Rate your experience")}</h3>
      {axes.map(([k, label]) => (
        <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <span className="min-w-0 text-xs font-bold">{label}</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`${label} ${n}`} onClick={() => setStars({ ...stars, [k]: n })} className="p-0.5">
                <Star className={`size-5 ${n <= stars[k] ? "fill-accent text-accent" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
        </div>
      ))}
      <textarea
        value={text}
        maxLength={500}
        onChange={(e) => setText(e.target.value.slice(0, 500))}
        rows={3}
        placeholder={tr("صف تجربتك لمساعدة المشترين الآخرين (اختياري)", "Describe your experience (optional)")}
        className="w-full rounded-xl border border-input bg-surface p-3 text-sm outline-none focus:border-primary"
      />
      <button
        type="button"
        disabled={submit.isPending}
        onClick={() => submit.mutate()}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {submit.isPending && <Loader2 className="size-4 animate-spin" />}
        {tr("نشر التقييم", "Publish review")}
      </button>
    </div>
  );
}

/** Public reviews section on the seller profile with per-axis averages. */
export function SellerReviews({ sellerId }: { sellerId: string }) {
  const { tr, lang } = useLang();
  const q = useQuery({
    queryKey: ["seller-reviews", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_seller_reviews", { p_seller_id: sellerId });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = q.data ?? [];
  const avg = (f: (r: (typeof rows)[number]) => number | null) => {
    const v = rows.map(f).filter((x): x is number => typeof x === "number");
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  };

  return (
    <>
      <h2 className="mb-4 mt-8 text-lg font-extrabold">
        {tr("آراء المشترين", "Buyer reviews")} {rows.length > 0 && <span className="text-sm text-muted-foreground">(<bdi>{rows.length}</bdi>)</span>}
      </h2>
      {q.isLoading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-secondary/70" />
      ) : rows.length === 0 ? (
        <Card className="py-8 text-center text-sm text-muted-foreground">{tr("لا توجد تقييمات بعد.", "No reviews yet.")}</Card>
      ) : (
        <>
          <Card className="grid gap-3 sm:grid-cols-4">
            {[
              [tr("التقييم العام", "Overall"), avg((r) => r.rating)],
              [tr("الجودة", "Quality"), avg((r) => r.quality)],
              [tr("التواصل", "Communication"), avg((r) => r.communication)],
              [tr("الالتزام بالموعد", "On time"), avg((r) => r.punctuality)],
            ].map(([label, v]) => (
              <div key={label as string}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 flex items-center gap-2 text-lg font-black"><bdi>{(v as number).toFixed(2)}</bdi> <Stars value={v as number} size="size-3.5" /></p>
              </div>
            ))}
          </Card>
          <div className="mt-3 grid gap-3">
            {rows.map((r) => (
              <Card key={r.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-bold">{r.reviewer_name || tr("مشترٍ", "Buyer")}</span>
                  <Stars value={r.rating} />
                </div>
                {r.order_title && <p className="mt-1 truncate text-xs text-muted-foreground"><bdi>{r.order_title}</bdi></p>}
                {r.comment && <p className="mt-2 whitespace-pre-line break-words text-sm leading-7">{r.comment}</p>}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString(lang === "ar" ? "ar" : "en", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
