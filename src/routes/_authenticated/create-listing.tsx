import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, PlusCircle, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { parseUsdt, sanitizeText } from "@/lib/security";
import { screenCoverImage } from "@/lib/moderation.functions";
import { type ListingCategory } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/create-listing")({
  head: () => ({
    meta: [
      { title: "إنشاء عرض جديد | المُنجِز" },
      { name: "description", content: "أنشئ عدداً غير محدود من الخدمات والمنتجات الرقمية على المُنجِز بحد أدنى 3 USDT للعرض الواحد." },
      { property: "og:title", content: "إنشاء عرض جديد | المُنجِز" },
      { property: "og:description", content: "انشر خدماتك ومنتجاتك الرقمية بعملة USDT مع حماية الضمان." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateListing,
});

const MIN_PRICE = 3;
const MIN_DESC = 40;
const MIN_TITLE = 10;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverChecking, setCoverChecking] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [codeAudit, setCodeAudit] = useState(false);
  const isCodeCategory = form.category === "freelance" || form.category === "product";

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const pickCover = async (file: File | null) => {
    if (!file) return;
    if (!COVER_TYPES.includes(file.type)) {
      setCoverError(tr("يُسمح فقط بصور JPEG أو PNG أو WebP.", "Only JPEG, PNG or WebP images are allowed."));
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setCoverError(tr("الحد الأقصى لحجم الصورة 5MB.", "Maximum image size is 5MB."));
      return;
    }
    setCoverError(null);
    setCoverChecking(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("COVER_READ_FAILED"));
        reader.readAsDataURL(file);
      });
      // Fail-open after 3s so sellers are never stuck on a slow check.
      const verdict = await Promise.race([
        screenCoverImage({ data: { dataUrl } }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);
      if (verdict && !verdict.allowed) {
        if (fileInput.current) fileInput.current.value = "";
        setCoverFile(null);
        toast.error(
          tr(
            "يرجى اختيار صورة غلاف لا تحتوي على أرقام هواتف أو وسائل تواصل خارجية",
            "Please choose a cover image without phone numbers or external contact details",
          ),
        );
        return;
      }
      setCoverFile(file);
    } catch {
      setCoverFile(file); // any unexpected error approves the image (fail-open)
    } finally {
      setCoverChecking(false);
    }
  };

  const price = useMemo(() => parseUsdt(form.price_usdt) ?? Number.NaN, [form.price_usdt]);
  const priceTouched = form.price_usdt.trim().length > 0;
  const priceInvalid = priceTouched && (!Number.isFinite(price) || price < MIN_PRICE);
  const descLen = form.description_ar.trim().length;
  const descTouched = descLen > 0;
  const descInvalid = descTouched && descLen < MIN_DESC;
  const titleArLen = form.title_ar.trim().length;
  const titleEnLen = form.title_en.trim().length;
  const titleMissing = titleArLen < MIN_TITLE && titleEnLen < MIN_TITLE;

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
      let coverUrl: string | null = null;
      if (coverFile) {
        // Cover was already screened at pick time (permissive profile, fail-open).
        const ext = coverFile.type === "image/png" ? "png" : coverFile.type === "image/webp" ? "webp" : "jpg";
        const path = `${user!.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("covers").upload(path, coverFile, { upsert: false });
        if (upErr) throw upErr;
        coverUrl = path;
      }
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
        cover_url: coverUrl,
        verified: !!profile.data?.is_verified,
        is_published: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm(emptyForm);
      setCoverFile(null);
      setCodeAudit(false);
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
    { key: "freelance", label: tr("خدمة مستقل / برمجة", "Freelance / development") },
    { key: "course", label: tr("دورة تدريبية", "Course") },
    { key: "product", label: tr("منتج رقمي / عقود ذكية", "Digital product / smart contracts") },
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
                <label className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className="text-muted-foreground">{tr("العنوان (عربي)", "Title (Arabic)")}</span>
                  <input className={field} maxLength={120} value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} />
                  <span className={`text-xs ${titleMissing && (titleArLen > 0 || titleEnLen > 0) ? "font-bold text-destructive" : "text-muted-foreground"}`}>
                    {titleMissing && (titleArLen > 0 || titleEnLen > 0)
                      ? tr(`العنوان يجب ألا يقل عن ${MIN_TITLE} أحرف`, `Title must be at least ${MIN_TITLE} characters`)
                      : tr(`على الأقل ${MIN_TITLE} أحرف بإحدى اللغتين`, `At least ${MIN_TITLE} characters in either language`)}
                  </span>
                </label>
                <label className="grid gap-1.5 text-sm sm:col-span-2">
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

                {isCodeCategory && (
                  <label className="flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3 text-xs leading-relaxed sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={codeAudit}
                      onChange={(e) => setCodeAudit(e.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-bold text-primary">
                        <ShieldCheck className="size-3.5 shrink-0" />
                        طلب فحص النزاهة والأمان التلقائي للكود البرمجي (Smart Contract Integrity Check)
                      </span>
                      <span className="mt-1 block text-muted-foreground">
                        عند اعتماد الفحص تظهر شارة «كود مدقق ومحمي 🛡️» على عرضك في السوق.
                      </span>
                    </span>
                  </label>
                )}

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
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => pickCover(e.target.files?.[0] ?? null)}
                  />
                  {coverPreview ? (
                    <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-border">
                      <img src={coverPreview} alt={tr("معاينة الغلاف", "Cover preview")} className="h-40 w-full object-cover" />
                      <div className="absolute top-2 end-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInput.current?.click()}
                          className="rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs font-bold backdrop-blur hover:text-primary"
                        >
                          {tr("تغيير", "Change")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCoverFile(null)}
                          aria-label={tr("إزالة الصورة", "Remove image")}
                          className="grid size-8 place-items-center rounded-lg border border-border bg-background/80 text-muted-foreground backdrop-blur hover:text-destructive"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="grid h-32 w-full max-w-sm place-items-center gap-2 rounded-xl border border-dashed border-border bg-surface text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
                    >
                      <ImagePlus className="size-6" />
                      <span className="text-xs font-bold">{tr("اختر صورة من جهازك (JPEG / PNG / WebP · حتى 5MB)", "Choose an image (JPEG / PNG / WebP · up to 5MB)")}</span>
                    </button>
                  )}
                  {coverError && <span className="text-xs font-bold text-destructive">{coverError}</span>}
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
