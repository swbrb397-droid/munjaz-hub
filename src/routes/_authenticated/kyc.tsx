import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Clock, ShieldCheck, Upload, XCircle } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useMyKyc, useSubmitKyc } from "@/lib/kyc";
import { useUserProfile } from "@/hooks/use-user-profile";

export const Route = createFileRoute("/_authenticated/kyc")({
  head: () => ({
    meta: [
      { title: "توثيق الهوية KYC | الـمُـنْـجِـز" },
      { name: "description", content: "ارفع صورة الهوية أو جواز السفر (الوجهين) بشكل مشفّر لرفع مستوى التوثيق وتفعيل السحب الفوري بعملة USDT." },
      { property: "og:title", content: "توثيق الهوية KYC | الـمُـنْـجِـز" },
      { property: "og:description", content: "رفع آمن لمستندات الهوية ومتابعة حالة المراجعة." },
    ],
  }),
  component: KycPage,
});

const MAX_MB = 8;

function statusBadge(status: string, tr: (a: string, e: string) => string) {
  if (status === "approved") return { icon: BadgeCheck, label: tr("موثّق ✅", "Verified ✅"), cls: "border-primary/50 bg-primary/10 text-primary" };
  if (status === "pending") return { icon: Clock, label: tr("قيد المراجعة", "Under review"), cls: "border-accent/50 bg-accent/10 text-accent" };
  if (status === "rejected") return { icon: XCircle, label: tr("مرفوض — أعد الرفع", "Rejected — resubmit"), cls: "border-destructive/50 bg-destructive/10 text-destructive" };
  return { icon: ShieldCheck, label: tr("غير موثّق", "Unverified"), cls: "border-border text-muted-foreground" };
}

function KycPage() {
  const { tr } = useLang();
  const { profile } = useUserProfile();
  const mine = useMyKyc();
  const submit = useSubmitKyc();

  const [docType, setDocType] = useState("id");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);

  const status = (profile?.kyc_status as string | undefined) ?? "unverified";
  const badge = statusBadge(status, tr);

  const pick = (file: File | null, set: (f: File | null) => void) => {
    if (file && file.size > MAX_MB * 1024 * 1024) {
      toast.error(tr(`الحجم الأقصى ${MAX_MB} ميغابايت.`, `Maximum size is ${MAX_MB} MB.`));
      return;
    }
    set(file);
  };

  const send = () => {
    if (!front) {
      toast.error(tr("صورة الوجه الأمامي مطلوبة.", "The front image is required."));
      return;
    }
    submit.mutate(
      { docType, front, back },
      {
        onSuccess: () => {
          toast.success(tr("تم إرسال المستندات — قيد المراجعة.", "Documents submitted — under review."));
          setFront(null);
          setBack(null);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  return (
    <Section title={tr("توثيق الهوية (KYC)", "Identity verification (KYC)")} subtitle={tr("رفع مشفّر لمستنداتك داخل خزنة آمنة", "Encrypted upload into a secure vault")}>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <span className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold ${badge.cls}`}>
            <badge.icon className="size-4" /> {badge.label}
          </span>

          <label className="mt-5 grid gap-1.5 text-sm">
            <span className="text-xs text-muted-foreground">{tr("نوع المستند", "Document type")}</span>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="rounded-lg border border-input bg-surface px-3 py-2 outline-none focus:border-primary">
              <option value="id">{tr("بطاقة هوية", "National ID")}</option>
              <option value="passport">{tr("جواز سفر", "Passport")}</option>
            </select>
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {([
              ["front", tr("الوجه الأمامي *", "Front side *"), front, setFront] as const,
              ["back", tr("الوجه الخلفي", "Back side"), back, setBack] as const,
            ]).map(([key, label, file, set]) => (
              <label key={key} className="grid cursor-pointer gap-2 rounded-xl border border-dashed border-border p-4 text-center text-xs hover:border-primary">
                <Upload className="mx-auto size-5 text-primary" />
                <span className="font-bold">{label}</span>
                <span className="truncate text-muted-foreground">{file ? file.name : tr("PNG / JPG حتى 8MB", "PNG / JPG up to 8MB")}</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => pick(e.target.files?.[0] ?? null, set)}
                />
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={send}
            disabled={submit.isPending || !front}
            className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {submit.isPending ? tr("جارٍ الرفع…", "Uploading…") : tr("إرسال للمراجعة", "Submit for review")}
          </button>

          <p className="mt-3 text-xs text-muted-foreground">
            {tr(
              "تُحفظ المستندات في خزنة خاصة لا يصل إليها سوى فريق الامتثال، وتُستخدم فقط للتحقق من الهوية.",
              "Documents are stored in a private vault accessible only to the compliance team, used solely for identity verification.",
            )}
          </p>
        </Card>

        <Card>
          <h3 className="font-bold">{tr("سجل الطلبات", "Submission history")}</h3>
          <div className="mt-3 grid gap-2">
            {(mine.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">{tr("لم ترسل أي مستندات بعد.", "No documents submitted yet.")}</p>
            )}
            {(mine.data ?? []).map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-3 text-xs">
                <p className="font-bold uppercase">{s.status}</p>
                <p className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</p>
                {s.admin_note && <p className="mt-1 text-muted-foreground">{s.admin_note}</p>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Section>
  );
}
