import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Handshake, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/cloud-client";
import { moderateFields } from "@/lib/chat-moderation";

export const Route = createFileRoute("/_authenticated/contracts")({
  head: () => ({
    meta: [
      { title: "الصفقات المباشرة | المُنجِز" },
      { name: "description", content: "أنشئ صفقة مباشرة برابط خاص لعميلك، ويُحجز المبلغ في الضمان قبل بدء العمل." },
      { property: "og:title", content: "الصفقات المباشرة | المُنجِز" },
      { property: "og:description", content: "حوّل عملاءك من خارج المنصة إلى صفقات مضمونة الدفع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractsPage,
});

const ERR: Record<string, [string, string]> = {
  INVALID_TITLE: ["العنوان بين 5 و160 حرفاً", "Title must be 5–160 characters"],
  INVALID_DESCRIPTION: ["الوصف بين 20 و3000 حرف", "Description must be 20–3000 characters"],
  INVALID_AMOUNT: ["المبلغ بين 5 و50000 USDT", "Amount must be 5–50000 USDT"],
  INVALID_DAYS: ["مدة التسليم بين 1 و90 يوماً", "Delivery must be 1–90 days"],
  CONTACT_INFO_BLOCKED: ["لا يُسمح بوضع أرقام أو وسائل تواصل", "Contact details are not allowed"],
  PROFANITY_BLOCKED: ["النص يحتوي ألفاظاً غير لائقة", "Text contains inappropriate words"],
  DAILY_LIMIT: ["وصلت للحد اليومي (10 صفقات)", "Daily limit reached (10 contracts)"],
};

export function contractLink(token: string) {
  return `${typeof window !== "undefined" ? window.location.origin : "https://almunjazhub.com"}/c/${token}`;
}

function ContractsPage() {
  const { tr } = useLang();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("7");
  const [busy, setBusy] = useState(false);

  const list = useQuery({
    queryKey: ["direct-contracts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_contracts")
        .select("id, token, title, amount_usdt, status, expires_at, order_id, seller_id, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(contractLink(token));
    toast.success(tr("تم نسخ الرابط — أرسله لعميلك", "Link copied — send it to your client"));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mod = moderateFields(title, description);
    if (mod) { toast.error(mod); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("create_direct_contract", {
      _title: title, _description: description, _amount: Number(amount), _days: Number(days),
    });
    setBusy(false);
    if (error) {
      const k = Object.keys(ERR).find((x) => error.message.includes(x));
      toast.error(k ? tr(ERR[k]![0], ERR[k]![1]) : tr("تعذّر إنشاء الصفقة", "Could not create contract"));
      return;
    }
    setTitle(""); setDescription(""); setAmount("");
    await list.refetch();
    if (data) await copy(data as string);
  };

  const statusLabel = (s: string, exp: string) => {
    if (s === "open" && new Date(exp) < new Date()) return tr("منتهية", "Expired");
    return ({ open: tr("بانتظار العميل", "Awaiting client"), accepted: tr("مقبولة ومحجوزة", "Accepted & funded"), cancelled: tr("ملغاة", "Cancelled") } as Record<string, string>)[s] ?? s;
  };

  return (
    <Section title={tr("الصفقات المباشرة", "Direct contracts")} subtitle={tr("لديك عميل من خارج المنصة؟ أنشئ صفقة برابط خاص، فيدفع داخل الضمان قبل أن تبدأ.", "Have an outside client? Create a private link; they fund escrow before you start.")}>
      <div className="mx-auto grid max-w-4xl gap-6">
        <Card>
          <form onSubmit={submit} className="grid gap-4">
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">{tr("عنوان العمل", "Work title")}</span>
              <input required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} className="min-h-[44px] rounded-lg border border-border bg-background px-3" />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">{tr("تفاصيل الاتفاق وما سيتم تسليمه", "Agreement details and deliverables")}</span>
              <textarea required maxLength={3000} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-lg border border-border bg-background p-3" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">{tr("المبلغ (USDT)", "Amount (USDT)")}</span>
                <input required type="number" min={5} max={50000} step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="min-h-[44px] rounded-lg border border-border bg-background px-3" />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">{tr("مدة التسليم (أيام)", "Delivery (days)")}</span>
                <input required type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} className="min-h-[44px] rounded-lg border border-border bg-background px-3" />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">{tr("الرابط صالح 14 يوماً. تُخصم عمولة باقتك من المبلغ عند الإفراج فقط.", "The link is valid for 14 days. Your plan's commission is deducted only on release.")}</p>
            <button disabled={busy} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Handshake className="size-4" />}
              {tr("إنشاء الرابط ونسخه", "Create & copy link")}
            </button>
          </form>
        </Card>

        <div className="grid gap-3">
          <h2 className="text-lg font-bold">{tr("صفقاتك", "Your contracts")}</h2>
          {list.isLoading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> :
            (list.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{tr("لا توجد صفقات بعد.", "No contracts yet.")}</p> :
            list.data!.map((c) => (
              <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    <bdi>{Number(c.amount_usdt).toFixed(2)}</bdi> USDT · {statusLabel(c.status, c.expires_at)}
                    {c.seller_id !== user?.id && ` · ${tr("أنت العميل", "You are the client")}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {c.order_id ? (
                    <Link to="/workspace" search={{ order: c.order_id }} className="inline-flex min-h-[40px] items-center rounded-lg border border-border px-3 text-xs font-semibold hover:bg-secondary">
                      {tr("فتح الطلب", "Open order")}
                    </Link>
                  ) : c.status === "open" && c.seller_id === user?.id ? (
                    <>
                      <button onClick={() => copy(c.token)} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-secondary">
                        <Copy className="size-3.5" /> {tr("نسخ الرابط", "Copy link")}
                      </button>
                      <button
                        onClick={async () => { const { error } = await supabase.rpc("cancel_direct_contract", { _token: c.token }); if (error) toast.error(tr("تعذّر الإلغاء", "Could not cancel")); else void list.refetch(); }}
                        className="inline-flex min-h-[40px] items-center rounded-lg px-3 text-xs text-muted-foreground hover:text-destructive"
                      >
                        {tr("إلغاء", "Cancel")}
                      </button>
                    </>
                  ) : null}
                </div>
              </Card>
            ))}
        </div>
      </div>
    </Section>
  );
}
