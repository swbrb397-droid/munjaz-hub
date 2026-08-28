import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, FileSearch, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { lookupDocument, type StampedDoc } from "@/lib/doc-registry";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "التحقق من المستندات | الـمُـنْـجِـز" },
      { name: "description", content: "تحقّق من أصالة إيصالات وسجلات الـمُـنْـجِـز عبر بصمة التحقق المطبوعة على ملف PDF." },
      { property: "og:title", content: "التحقق من المستندات | الـمُـنْـجِـز" },
      { property: "og:description", content: "أدخل بصمة التحقق لعرض حالة الأصالة ونوع المستند وتاريخ الإصدار." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Verify,
});

function Verify() {
  const { tr } = useLang();
  const [hash, setHash] = useState("");
  const [result, setResult] = useState<{ doc: StampedDoc | null; queried: string } | null>(null);

  const check = () => {
    const q = hash.trim().toUpperCase();
    if (!q) return;
    setResult({ doc: lookupDocument(q), queried: q });
  };

  return (
    <Section
      title={tr("التحقق من أصالة المستندات", "Document authenticity verification")}
      subtitle={tr("الصق بصمة التحقق الموجودة أسفل ملف الـ PDF", "Paste the verification hash printed at the bottom of the PDF")}
    >
      <Card className="mx-auto max-w-2xl">
        <label className="text-sm font-bold" htmlFor="hash-input">
          {tr("بصمة التحقق (Verification Hash)", "Verification hash")}
        </label>
        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            id="hash-input"
            value={hash}
            dir="ltr"
            onChange={(e) => setHash(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && check()}
            placeholder="E5A91C3D7F20B8A4"
            className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 font-mono text-sm uppercase outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={check}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <FileSearch className="size-4" /> {tr("تحقّق", "Verify")}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {tr(
            "تُحفظ بصمات المستندات محلياً على جهازك عند إصدار ملفات PDF من المنصة.",
            "Document fingerprints are stored on your device when platform PDFs are issued.",
          )}
        </p>
      </Card>

      {result && (
        <Card className="relative mx-auto mt-6 max-w-2xl overflow-hidden">
          {/* Platform seal watermark */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 grid place-items-center text-3xl font-black tracking-widest text-primary/5 sm:text-5xl"
            style={{ transform: "rotate(-24deg)" }}
          >
            AL-MUNJAZ VERIFIED
          </span>

          {result.doc ? (
            <div className="relative grid gap-4">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                <BadgeCheck className="size-4" /> {tr("مستند أصلي وموثّق ✅", "Authentic verified document ✅")}
              </p>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  [tr("نوع المستند", "Document type"), result.doc.docType],
                  [tr("المرجع", "Reference"), result.doc.reference || "—"],
                  [tr("اسم الملف", "File name"), result.doc.target],
                  [tr("تاريخ الإصدار", "Issued at"), new Date(result.doc.issuedAt).toLocaleString()],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-border p-3">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="mt-1 break-all font-bold">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="break-all rounded-xl border border-border bg-surface/60 p-3 font-mono text-xs" dir="ltr">
                HASH: {result.doc.hash}
              </p>
              <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 text-primary" />
                {tr("موقّع رقمياً بختم منصة الـمُـنْـجِـز للضمان.", "Digitally signed with the Al-Munjaz escrow platform seal.")}
              </p>
            </div>
          ) : (
            <div className="relative grid gap-2">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive">
                <ShieldAlert className="size-4" /> {tr("لم يتم العثور على المستند ❌", "Document not found ❌")}
              </p>
              <p className="break-all font-mono text-xs text-muted-foreground" dir="ltr">{result.queried}</p>
              <p className="text-sm text-muted-foreground">
                {tr(
                  "تأكد من نسخ البصمة كاملة كما تظهر في تذييل ملف الـ PDF، أو افتح الصفحة من الجهاز الذي أصدر المستند.",
                  "Make sure the full hash is copied exactly as printed in the PDF footer, or open this page on the device that issued the document.",
                )}
              </p>
            </div>
          )}
        </Card>
      )}
    </Section>
  );
}
