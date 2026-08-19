import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, Section } from "@/components/site/Shell";
import { UnsplashPicker, type StockPhoto } from "@/components/site/UnsplashPicker";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { parseUsdt, sanitizeText } from "@/lib/security";
import { type ListingCategory } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/create-listing")({
  head: () => ({
    meta: [
      { title: "إنشاء عرض جديد | الـمُـنْـجِـز" },
      { name: "description", content: "أنشئ عدداً غير محدود من الخدمات والمنتجات الرقمية على الـمُـنْـجِـز بحد أدنى 3 USDT للعرض الواحد." },
      { property: "og:title", content: "إنشاء عرض جديد | الـمُـنْـجِـز" },
      { property: "og:description", content: "انشر خدماتك ومنتجاتك الرقمية بعملة USDT مع حماية الضمان." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateListing,
});

const MIN_PRICE = 3;
const MIN_DESC = 50;

type FormState = {
  title_ar: string;
  title_en: string;
  category: ListingCategory;
  price_usdt: string;
  tag_ar: string;
  tag_en: string;
  description_ar: string;
};

const emptyForm: FormState = {
  title_ar: "",
  title_en: "",
  category: "freelance",
  price_usdt: "",
  tag_ar: "",
  tag_en: "",
  description_ar: "",
};

function CreateListing() {
  const { tr, lang } = useLang();
  const { user } = useAuth();
  const profile = useProfile();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [cover, setCover] = useState<StockPhoto | null>(null);
  const [step, setStep] = useState<1 | 2>(1);


  const price = useMemo(() => parseUsdt(form.price_usdt) ?? Number.NaN, [form.price_usdt]);
  const priceTouched = form.price_usdt.trim().length > 0;
  const priceInvalid = priceTouched && (!Number.isFinite(price) || price < MIN_PRICE);
  const descLen = form.description_ar.trim().length;
  const descTouched = descLen > 0;
  const descInvalid = descTouched && descLen < MIN_DESC;
  const titleMissing = !form.title_ar.trim() && !form.title_en.trim();

  const canSubmit =
    !titleMissing && Number.isFinite(price) && price >= MIN_PRICE && descLen >= MIN_DESC;

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
        cover_key: "product",
        verified: !!profile.data?.is_verified,
        is_published: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm(emptyForm);
      setCover(null);
      setStep(1);

      qc.invalidateQueries({ queryKey: ["my-listings"] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      toast.success(
        tr(
          "تم تجهيز بيانات العرض بنجاح - بانتظار تفعيل الربط السحابي",
          "Listing data prepared successfully — awaiting cloud integration",
        ),
      );
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
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
    if (!canSubmit || create.isPending) return;
    create.mutate();
  };

  const categories: { key: ListingCategory; label: string }[] = [
    { key: "freelance", label: tr("خدمة مستقل", "Freelance service") },
    { key: "course", label: tr("دورة تدريبية", "Course") },
    { key: "product", label: tr("منتج رقمي", "Digital product") },
    { key: "gaming", label: tr("قيمنق", "Gaming") },
  ];

  const field = "w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

  const step1Valid = !titleMissing && Number.isFinite(price) && price >= MIN_PRICE;

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
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-border p-1">
            {([1, 2] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStep(s)}
                disabled={s === 2 && !step1Valid}
                className={`rounded-lg px-3 py-2.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  step === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {s === 1
                  ? tr("الخطوة 1: التفاصيل الأساسية", "Step 1: Basic details")
                  : tr("الخطوة 2: المحتوى والغلاف", "Step 2: Content & cover")}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            {step === 1 && (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-muted-foreground">{tr("العنوان (عربي)", "Title (Arabic)")}</span>
                  <input className={field} maxLength={120} value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-muted-foreground">{tr("العنوان (إنجليزي)", "Title (English)")}</span>
                  <input className={field} maxLength={120} value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} />
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
                    className={`${field} ${priceInvalid ? "border-destructive focus:border-destructive" : ""}`}
                    type="number"
                    min={MIN_PRICE}
                    step="0.01"
                    inputMode="decimal"
                    value={form.price_usdt}
                    onChange={(e) => setForm({ ...form, price_usdt: e.target.value })}
                    placeholder={String(MIN_PRICE)}
                    aria-invalid={priceInvalid}
                  />
                  {priceInvalid && (
                    <span className="text-xs font-bold text-destructive">
                      {tr(`الحد الأدنى لقيمة العرض هو ${MIN_PRICE} USDT`, `Minimum listing value is ${MIN_PRICE} USDT`)}
                    </span>
                  )}
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="text-muted-foreground">{tr("وسم قصير (عربي)", "Short tag (Arabic)")}</span>
                  <input className={field} maxLength={40} value={form.tag_ar} onChange={(e) => setForm({ ...form, tag_ar: e.target.value })} />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-muted-foreground">{tr("وسم قصير (إنجليزي)", "Short tag (English)")}</span>
                  <input className={field} maxLength={40} value={form.tag_en} onChange={(e) => setForm({ ...form, tag_en: e.target.value })} />
                </label>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!step1Valid}
                    className="h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {tr("التالي: المحتوى والغلاف", "Next: content & cover")}
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <label className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className="text-muted-foreground">{tr("وصف الخدمة (عربي)", "Service description (Arabic)")}</span>
                  <textarea
                    className={`${field} min-h-32 resize-y ${descInvalid ? "border-destructive focus:border-destructive" : ""}`}
                    maxLength={2000}
                    value={form.description_ar}
                    onChange={(e) => setForm({ ...form, description_ar: e.target.value })}
                    placeholder={tr("اشرح تفاصيل خدمتك ومخرجاتها ومدة التسليم...", "Describe your service, deliverables and delivery time...")}
                    aria-invalid={descInvalid}
                  />
                  <span className={`text-xs ${descInvalid ? "font-bold text-destructive" : "text-muted-foreground"}`}>
                    {descInvalid
                      ? tr(`الوصف يجب ألا يقل عن ${MIN_DESC} حرفاً (${descLen}/${MIN_DESC})`, `Description must be at least ${MIN_DESC} characters (${descLen}/${MIN_DESC})`)
                      : `${descLen}/${MIN_DESC}`}
                  </span>
                </label>

                <div className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className="text-muted-foreground">{tr("صورة الغلاف", "Cover image")}</span>
                  <UnsplashPicker selected={cover} onSelect={setCover} />
                </div>

                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="h-11 rounded-xl border border-border px-5 text-sm font-bold text-muted-foreground hover:bg-secondary"
                  >
                    {tr("رجوع", "Back")}
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit || create.isPending}
                    className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <PlusCircle className="size-4" />}
                    {tr("نشر العرض", "Publish listing")}
                  </button>
                </div>
              </>
            )}
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
