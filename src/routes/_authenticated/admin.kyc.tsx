import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, Loader2, ShieldCheck } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useUserProfile } from "@/hooks/use-user-profile";
import { kycDocUrl, useKycDocPreview, useKycSubmissions, useReviewKyc } from "@/lib/kyc";

export const Route = createFileRoute("/_authenticated/admin/kyc")({
  head: () => ({
    meta: [
      { title: "مراجعة توثيق الهوية KYC | المنجز" },
      { name: "description", content: "مراجعة مستندات الهوية المرفوعة، معاينة الصور الآمنة، وقبول أو رفض طلبات التوثيق بضغطة واحدة." },
      { property: "og:title", content: "مراجعة توثيق الهوية KYC | المنجز" },
      { property: "og:description", content: "طابور مراجعة التوثيق مع معاينة آمنة للمستندات." },
    ],
  }),
  component: AdminKyc,
});

type StatusFilter = "pending" | "approved" | "rejected" | "all";

function DocPreviews({ front, back }: { front: string | null; back: string | null }) {
  const urls = useKycDocPreview([front, back]);
  const items = [front, back].filter(Boolean) as string[];
  if (items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((p) => {
        const url = urls.data?.[p];
        return url ? (
          <a key={p} href={url} target="_blank" rel="noopener noreferrer" className="block">
            <img src={url} alt="KYC document" loading="lazy" className="h-28 w-40 rounded-lg border border-border object-cover" />
          </a>
        ) : (
          <div key={p} className="grid h-28 w-40 place-items-center rounded-lg border border-dashed border-border">
            <Loader2 className="size-4 animate-spin text-primary" />
          </div>
        );
      })}
    </div>
  );
}

function AdminKyc() {
  const { tr } = useLang();
  const { isAdmin } = useUserProfile();
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const rows = useKycSubmissions(isAdmin, status);
  const review = useReviewKyc();

  const open = async (path: string | null) => {
    if (!path) return;
    const url = await kycDocUrl(path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error(tr("تعذّر فتح المستند.", "Could not open the document."));
  };

  const act = (id: string, approve: boolean, note?: string) => {
    review.mutate(
      { id, approve, ...(note ? { note } : {}) },
      {
        onSuccess: () => {
          setRejecting(null);
          setReason("");
          toast.success(approve ? tr("تم قبول التوثيق ✅", "Verification approved ✅") : tr("تم رفض الطلب", "Request rejected"));
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  const filters: [StatusFilter, string][] = [
    ["pending", tr("قيد المراجعة", "Pending")],
    ["approved", tr("مقبول", "Approved")],
    ["rejected", tr("مرفوض", "Rejected")],
    ["all", tr("الكل", "All")],
  ];

  return (
    <Section
      title={tr("مراجعة توثيق الهوية (KYC)", "Identity verification review")}
      subtitle={tr("معاينة المستندات واتخاذ القرار مباشرة", "Preview documents and decide instantly")}
    >
      <Card className="mb-6 flex flex-wrap items-center gap-2">
        <ShieldCheck className="size-4 text-primary" />
        {filters.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setStatus(k)}
            className={`rounded-lg px-3 py-1.5 text-sm ${status === k ? "bg-primary font-bold text-primary-foreground" : "border border-border text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </Card>

      <Card>
        {rows.isLoading ? (
          <div className="grid place-items-center py-10"><Loader2 className="size-5 animate-spin text-primary" /></div>
        ) : (rows.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {tr("لا توجد طلبات توثيق.", "No verification requests.")}
          </p>
        ) : (
          <div className="grid gap-3">
            {(rows.data ?? []).map((r) => (
              <div key={r.id} className="grid gap-3 rounded-xl border border-border p-4 text-sm md:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {(r as { full_name?: string | null }).full_name ?? r.profile?.display_name ?? r.user_id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.doc_type} · {new Date(r.created_at).toLocaleString()} · <span className="uppercase">{r.status}</span>
                  </p>
                  {r.admin_note && <p className="mt-1 text-xs text-destructive">{r.admin_note}</p>}
                  <DocPreviews front={r.front_path} back={r.back_path} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void open(r.front_path)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] hover:border-primary hover:text-primary">
                      <Eye className="size-3.5" /> {tr("الوجه الأمامي", "Front")}
                    </button>
                    {r.back_path && (
                      <button type="button" onClick={() => void open(r.back_path)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] hover:border-primary hover:text-primary">
                        <Eye className="size-3.5" /> {tr("الوجه الخلفي", "Back")}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <button
                    type="button"
                    disabled={review.isPending || r.status === "approved"}
                    onClick={() => act(r.id, true)}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {tr("قبول", "Approve")}
                  </button>
                  <button
                    type="button"
                    disabled={review.isPending || r.status === "rejected"}
                    onClick={() => {
                      setReason("");
                      setRejecting(r.id);
                    }}
                    className="min-h-[44px] rounded-lg border border-destructive/60 px-3 py-1.5 text-xs font-bold text-destructive disabled:opacity-50"
                  >
                    {tr("رفض", "Reject")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {rejecting && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-background/85 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-800 bg-[#0F172A] p-6">
            <h2 className="text-lg font-black">{tr("سبب رفض طلب التوثيق", "KYC rejection reason")}</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {tr(
                "يُحفظ السبب في سجل الطلب ويظهر للمستخدم داخل صفحة التوثيق.",
                "The reason is stored on the submission and shown to the user on their verification page.",
              )}
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder={tr("مثال: صورة الوثيقة غير واضحة", "e.g. the document image is unreadable")}
              className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={review.isPending || reason.trim().length < 5}
                onClick={() => act(rejecting, false, reason.trim())}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-destructive/60 bg-destructive/10 px-4 py-2.5 text-sm font-bold text-destructive disabled:opacity-40"
              >
                {review.isPending ? tr("جارٍ الحفظ…", "Saving…") : tr("تأكيد الرفض", "Confirm rejection")}
              </button>
              <button
                type="button"
                onClick={() => setRejecting(null)}
                className="min-h-[44px] rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold"
              >
                {tr("إلغاء", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
