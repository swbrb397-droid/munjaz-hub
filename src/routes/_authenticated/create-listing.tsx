import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlusCircle, Trash2 } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { parseUsdt, sanitizeText } from "@/lib/security";
import { COVERS, type ListingCategory } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/create-listing")({
  head: () => ({
    meta: [
      { title: "إنشاء عرض جديد | مُنجَز" },
      { name: "description", content: "أنشئ عدداً غير محدود من الخدمات والمنتجات الرقمية على مُنجَز بحد أدنى 3 USDT للعرض الواحد." },
      { property: "og:title", content: "إنشاء عرض جديد | مُنجَز" },
      { property: "og:description", content: "انشر خدماتك ومنتجاتك الرقمية بعملة USDT مع حماية الضمان." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateListing,
});

const MIN_PRICE = 3;

const emptyForm = {
  title_ar: "",
  title_en: "",
  category: "freelance" as ListingCategory,
  price_usdt: "",
  tag_ar: "",
  tag_en: "",
  cover_key: "product",
};

function CreateListing() {
  const { tr, lang } = useLang();
  const { user } = useAuth();
  const profile = useProfile();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const mine = useQuery({
    queryKey: ["my-listings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id,title_ar,title_en,category,price_usdt,is_published,created_at")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const price = parseUsdt(form.price_usdt) ?? 0;
      const sellerName = profile.data?.display_name || tr("بائع", "Seller");
      const { error } = await supabase.from("listings").insert({
        owner_id: user!.id,
        title_ar: sanitizeText(form.title_ar, 120) || sanitizeText(form.title_en, 120),
        title_en: sanitizeText(form.title_en, 120) || sanitizeText(form.title_ar, 120),
        seller_ar: sanitizeText(sellerName, 80),
        seller_en: sanitizeText(sellerName, 80),
        category: form.category,
        price_usdt: price,
        tag_ar: sanitizeText(form.tag_ar, 40),
        tag_en: sanitizeText(form.tag_en, 40) || sanitizeText(form.tag_ar, 40),
        cover_key: form.cover_key,
        verified: !!profile.data?.is_verified,
        is_published: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm(emptyForm);
      setDone(true);
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      qc.invalidateQueries({ queryKey: ["listings"] });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("listings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      qc.invalidateQueries({ queryKey: ["listings"] });
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDone(false);
    const price = parseUsdt(form.price_usdt) ?? 0;
    if (!form.title_ar.trim() && !form.title_en.trim()) {
      setError(tr("العنوان مطلوب.", "A title is required."));
      return;
    }
    if (!Number.isFinite(price) || price < MIN_PRICE) {
      setError(tr(`الحد الأدنى لسعر العرض هو ${MIN_PRICE} USDT.`, `Minimum listing price is ${MIN_PRICE} USDT.`));
      return;
    }
    create.mutate();
  };

  const categories: { key: ListingCategory; label: string }[] = [
    { key: "freelance", label: tr("خدمة مستقل", "Freelance service") },
    { key: "course", label: tr("دورة تدريبية", "Course") },
    { key: "product", label: tr("منتج رقمي", "Digital product") },
    { key: "gaming", label: tr("قيمنق", "Gaming") },
  ];

  const field = "w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <>
      <Section
        title={tr("إنشاء عرض جديد", "Create a new listing")}
        subtitle={tr(
          `عدد غير محدود من العروض · الحد الأدنى ${MIN_PRICE} USDT للعرض الواحد`,
          `Unlimited listings · minimum ${MIN_PRICE} USDT per listing`,
        )}
      >
        <Card>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">{tr("العنوان (عربي)", "Title (Arabic)")}</span>
              <input className={field} value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">{tr("العنوان (إنجليزي)", "Title (English)")}</span>
              <input className={field} value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">{tr("التصنيف", "Category")}</span>
              <select
                className={field}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as ListingCategory })}
              >
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">{tr("السعر (USDT)", "Price (USDT)")}</span>
              <input
                className={field}
                type="number"
                min={MIN_PRICE}
                step="0.01"
                inputMode="decimal"
                value={form.price_usdt}
                onChange={(e) => setForm({ ...form, price_usdt: e.target.value })}
                placeholder={String(MIN_PRICE)}
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">{tr("وسم قصير (عربي)", "Short tag (Arabic)")}</span>
              <input className={field} value={form.tag_ar} onChange={(e) => setForm({ ...form, tag_ar: e.target.value })} />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">{tr("وسم قصير (إنجليزي)", "Short tag (English)")}</span>
              <input className={field} value={form.tag_en} onChange={(e) => setForm({ ...form, tag_en: e.target.value })} />
            </label>

            <div className="sm:col-span-2 grid gap-1.5 text-sm">
              <span className="text-muted-foreground">{tr("صورة الغلاف", "Cover image")}</span>
              <div className="flex flex-wrap gap-3">
                {Object.entries(COVERS).map(([key, src]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setForm({ ...form, cover_key: key })}
                    className={`overflow-hidden rounded-lg border-2 transition-colors ${
                      form.cover_key === key ? "border-primary" : "border-border"
                    }`}
                    aria-label={key}
                  >
                    <img src={src} alt={key} className="h-16 w-24 object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="sm:col-span-2 text-sm text-destructive">{error}</p>}
            {done && (
              <p className="sm:col-span-2 text-sm text-primary">
                {tr("تم نشر العرض بنجاح.", "Listing published successfully.")}
              </p>
            )}

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={create.isPending}
                className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <PlusCircle className="size-4" />}
                {tr("نشر العرض", "Publish listing")}
              </button>
            </div>
          </form>
        </Card>
      </Section>

      <Section title={tr("عروضي", "My listings")} subtitle={tr("إدارة كل ما نشرته", "Manage everything you published")}>
        {mine.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-primary" /></div>
        ) : (mine.data ?? []).length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">{tr("لم تنشر أي عرض بعد.", "You have not published any listing yet.")}</p>
        ) : (
          <div className="grid gap-3">
            {(mine.data ?? []).map((l) => (
              <Card key={l.id} className="flex flex-wrap items-center gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{lang === "ar" ? l.title_ar : l.title_en}</p>
                  <p className="text-xs text-muted-foreground">{l.category}</p>
                </div>
                <span className="ms-auto text-sm font-bold text-primary">{Number(l.price_usdt).toLocaleString()} USDT</span>
                <button
                  type="button"
                  onClick={() => remove.mutate(l.id)}
                  className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={tr("حذف", "Delete")}
                >
                  <Trash2 className="size-4" />
                </button>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
