import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Copy, Download, Loader2 } from "lucide-react";
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
        .select("id,title,amount_usdt,status,listing_id,category")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

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
      title={tr("✅ تم الشراء بنجاح — محتوى طلبك الفوري جاهز الآن", "✅ Purchase complete — your instant content is ready")}
      subtitle={order.data?.title ?? ""}
    >
      <Card className="grid gap-4 p-5">
        <p className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          {tr("تمت تسوية المبلغ وإغلاق الطلب فوراً — لا حاجة لأي محادثة ضمان.", "Payment settled and the order closed instantly — no escrow chat needed.")}
        </p>

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
