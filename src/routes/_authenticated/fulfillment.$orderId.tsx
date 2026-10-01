import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Copy, Download, Loader2, Timer } from "lucide-react";
import { toast } from "sonner";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { supabase } from "@/lib/cloud-client";
import { useInstantDelivery, signInstantFile } from "@/lib/instant-delivery";

export const Route = createFileRoute("/_authenticated/fulfillment/$orderId")({
  head: () => ({
    meta: [
      { title: "تسليم فوري | المنجز" },
      { name: "description", content: "استلم محتوى طلبك الرقمي فوراً: تنزيل الملف أو نسخ المحتوى السري مباشرة بعد الشراء." },
      { property: "og:title", content: "تسليم فوري | المنجز" },
      { property: "og:description", content: "محتوى طلبك الرقمي جاهز للتنزيل أو النسخ فور إتمام الدفع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Fulfillment,
});

function Fulfillment() {
  const { orderId } = Route.useParams();
  const { tr } = useLang();
  const [downloading, setDownloading] = useState(false);

  const order = useQuery({
    queryKey: ["fulfillment-order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,title,amount_usdt,status,listing_id,category,auto_release_at")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const status = order.data?.status;
  const releaseAt = order.data?.auto_release_at ? new Date(order.data.auto_release_at).getTime() : 0;
  const remaining = Math.max(0, releaseAt - now);
  const inWindow = status === "delivered" && remaining > 0;
  const hh = String(Math.floor(remaining / 3_600_000)).padStart(2, "0");
  const mm = String(Math.floor((remaining % 3_600_000) / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60_000) / 1000)).padStart(2, "0");

  const [confirming, setConfirming] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [shot, setShot] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["fulfillment-order", orderId] });

  const confirmEarly = async () => {
    setConfirming(true);
    const { error } = await supabase.rpc("confirm_instant_delivery", { p_order_id: orderId });
    setConfirming(false);
    if (error) return toast.error(tr("تعذّر تأكيد الاستلام", "Could not confirm receipt"));
    toast.success(tr("تم تأكيد الاستلام وتحرير المبلغ للبائع", "Receipt confirmed and funds released to the seller"));
    refresh();
  };

  const submitDispute = async () => {
    if (reason.trim().length < 20) return toast.error(tr("اكتب سبباً واضحاً لا يقل عن 20 حرفاً", "Write a clear reason of at least 20 characters"));
    if (!shot) return toast.error(tr("لقطة الشاشة إلزامية كدليل", "A screenshot is required as evidence"));
    if (!shot.type.startsWith("image/") || shot.size > 5 * 1024 * 1024)
      return toast.error(tr("يجب أن يكون الدليل صورة لا تتجاوز 5MB", "Evidence must be an image up to 5MB"));
    setSending(true);
    try {
      const safe = shot.name.replace(/[^\w.\-]+/g, "_").slice(-60);
      const path = `${orderId}/disputes/${Date.now()}-${safe}`;
      const up = await supabase.storage.from("digital-vault").upload(path, shot, { upsert: false });
      if (up.error) throw up.error;
      const { error } = await supabase.rpc("open_instant_dispute", {
        p_order_id: orderId,
        p_reason: reason.trim(),
        p_evidence: [{ bucket: "digital-vault", path, name: safe }],
      });
      if (error) throw error;
      toast.success(tr("تم فتح النزاع — المبلغ مجمّد حتى قرار الإدارة", "Dispute opened — funds stay frozen until the admin ruling"));
      setDisputeOpen(false);
      refresh();
    } catch (e) {
      const msg = (e as Error).message ?? "";
      toast.error(
        msg.includes("WINDOW_CLOSED")
          ? tr("انتهت مهلة الـ 24 ساعة لفتح النزاع", "The 24-hour dispute window has closed")
          : tr("تعذّر فتح النزاع، حاول مجدداً", "Could not open the dispute, try again"),
      );
    } finally {
      setSending(false);
    }
  };

  const delivery = useInstantDelivery(order.data?.listing_id ?? null, !!order.data?.listing_id);

  const download = async () => {
    const path = delivery.data?.file_path;
    if (!path) return;
    setDownloading(true);
    const url = await signInstantFile(path);
    setDownloading(false);
    if (!url) {
      toast.error(tr("تعذّر تجهيز رابط التنزيل، حاول مجدداً", "Could not prepare the download link, try again"));
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = delivery.data?.file_name ?? "deliverable";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const copy = async () => {
    const text = delivery.data?.content ?? "";
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast.success(tr("تم نسخ المحتوى", "Content copied"));
  };

  return (
    <Section
      title={tr("تم الشراء بنجاح — محتوى طلبك الفوري جاهز الآن", "Purchase complete — your instant content is ready")}
      subtitle={order.data?.title ?? ""}
    >
      <Card className="grid gap-4 p-5">
        {status === "delivered" && (
          <div className="grid gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
            <p className="inline-flex items-center gap-2 text-xs font-bold text-primary">
              <Timer className="size-4 shrink-0" />
              {inWindow
                ? tr("المبلغ محجوز في الضمان — يُحرَّر للبائع تلقائياً بعد:", "Funds held in escrow — auto-released to the seller in:")
                : tr("انتهت مهلة الاعتراض — جارٍ تحرير المبلغ للبائع.", "Dispute window ended — releasing funds to the seller.")}
              {inWindow && <bdi dir="ltr" className="font-mono text-sm">{hh}:{mm}:{ss}</bdi>}
            </p>
            {inWindow && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={confirmEarly}
                  disabled={confirming}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
                >
                  {confirming ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  {tr("تأكيد الاستلام والقبول", "Confirm & Accept")}
                </button>
                <button
                  type="button"
                  onClick={() => setDisputeOpen((v) => !v)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive"
                >
                  <AlertTriangle className="size-4" />
                  {tr("الإبلاغ عن محتوى معطوب / فتح نزاع", "Report Problem / Open Dispute")}
                </button>
              </div>
            )}
            {inWindow && disputeOpen && (
              <div className="grid gap-2 rounded-xl border border-destructive/40 p-3">
                <label className="grid gap-1 text-xs">
                  <span className="font-bold">{tr("سبب النزاع (إلزامي)", "Dispute reason (required)")}</span>
                  <textarea
                    dir="auto"
                    value={reason}
                    maxLength={2000}
                    onChange={(e) => setReason(e.target.value)}
                    className="min-h-24 rounded-lg border border-input bg-surface p-2 text-sm outline-none focus:border-primary"
                    placeholder={tr("صف المشكلة بدقة: ملف تالف، رابط معطل، كود مستخدم…", "Describe the problem: corrupt file, dead link, used code…")}
                  />
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="font-bold">{tr("لقطة شاشة كدليل (إلزامي)", "Screenshot evidence (required)")}</span>
                  <input type="file" accept="image/*" onChange={(e) => setShot(e.target.files?.[0] ?? null)} className="text-xs" />
                </label>
                <button
                  type="button"
                  onClick={submitDispute}
                  disabled={sending}
                  className="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground disabled:opacity-60"
                >
                  {sending && <Loader2 className="size-4 animate-spin" />}
                  {tr("إرسال النزاع للإدارة", "Send dispute to admin")}
                </button>
              </div>
            )}
          </div>
        )}
        {status === "disputed" && (
          <p className="inline-flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            {tr("النزاع قيد مراجعة الإدارة — المبلغ مجمّد حتى صدور القرار.", "Dispute under admin review — funds frozen until the ruling.")}
          </p>
        )}
        {status === "completed" && (
          <p className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0" />
            {tr("اكتمل الطلب وتم تحرير المبلغ للبائع.", "Order completed and funds released to the seller.")}
          </p>
        )}

        {delivery.isLoading ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {tr("جارٍ تجهيز المحتوى…", "Preparing your content…")}
          </p>
        ) : (
          <>
            {delivery.data?.file_path && (
              <button
                type="button"
                onClick={download}
                disabled={downloading}
                className="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {tr("تنزيل الملف الآن", "Download the file now")}
              </button>
            )}

            {delivery.data?.content && (
              <div className="grid gap-2">
                <span className="text-xs font-bold text-muted-foreground">
                  {tr("المحتوى السري / البرومنت", "Secret content / prompt")}
                </span>
                <pre
                  dir="auto"
                  className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-surface-2/60 p-3 text-xs leading-relaxed"
                >
                  {delivery.data.content}
                </pre>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-bold text-primary"
                >
                  <Copy className="size-4" /> {tr("نسخ المحتوى", "Copy content")}
                </button>
              </div>
            )}

            {!delivery.data?.file_path && !delivery.data?.content && (
              <p className="text-sm text-muted-foreground">
                {tr(
                  "لم يرفق البائع محتوى فورياً بعد — تواصل مع الدعم لاسترجاع المبلغ أو استلام المحتوى.",
                  "The seller has not attached instant content yet — contact support for the content or a refund.",
                )}
              </p>
            )}
          </>
        )}

        <Link to="/orders" className="text-xs font-bold text-primary underline">
          {tr("العودة إلى طلباتي", "Back to my orders")}
        </Link>
      </Card>
    </Section>
  );
}
