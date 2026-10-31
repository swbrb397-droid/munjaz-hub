import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Lock, PackageCheck, Scale } from "lucide-react";
import { toast } from "sonner";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { useWallet } from "@/lib/queries";
import { supabase } from "@/lib/cloud-client";
import { VerifiedBadge } from "@/components/site/VerifiedBadge";
import { TopUpDialog } from "@/components/site/TopUpDialog";

export const Route = createFileRoute("/c/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "صفقة مباشرة بضمان المُنجِز" },
      { name: "description", content: "دعوة لصفقة مباشرة: المبلغ يُحجز في الضمان ولا يصل للمستقل إلا بعد استلامك." },
      { property: "og:title", content: "صفقة مباشرة بضمان المُنجِز" },
      { property: "og:description", content: "ادفع بأمان: أموالك محجوزة حتى تستلم عملك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContractInvite,
});

function ContractInvite() {
  const { token } = Route.useParams();
  const { tr } = useLang();
  const { isAuthenticated } = useAuth();
  const wallet = useWallet();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [topUp, setTopUp] = useState<number | null>(null);

  const q = useQuery({
    queryKey: ["direct-contract", token, isAuthenticated],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_direct_contract", { _token: token });
      if (error) throw error;
      return (data ?? [])[0] ?? null;
    },
  });

  if (q.isLoading) return <Section title=" "><Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" /></Section>;
  const c = q.data;
  if (!c) return <Section title={tr("الرابط غير صالح", "Invalid link")}><p className="text-center text-muted-foreground">{tr("تأكد من الرابط مع المستقل.", "Check the link with the freelancer.")}</p></Section>;

  const amount = Number(c.amount_usdt);
  const accept = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("accept_direct_contract", { _token: token });
    setBusy(false);
    if (error) {
      if (error.message.includes("INSUFFICIENT_FUNDS")) {
        const bal = Number((wallet.data as { available_usdt?: number } | null)?.available_usdt ?? 0);
        setTopUp(Math.max(1, Math.ceil((amount - bal) * 100) / 100));
        toast.error(tr("رصيدك غير كافٍ — اشحن محفظتك أولاً", "Insufficient balance — top up first"));
      } else if (error.message.includes("OWN_CONTRACT")) toast.error(tr("لا يمكنك قبول صفقتك بنفسك", "You can't accept your own contract"));
      else if (error.message.includes("CONTRACT_NOT_OPEN")) { toast.error(tr("هذه الصفقة لم تعد متاحة", "This contract is no longer available")); void q.refetch(); }
      else toast.error(tr("تعذّر قبول الصفقة", "Could not accept the contract"));
      return;
    }
    toast.success(tr("تم حجز المبلغ في الضمان وبدأ العمل", "Funds held in escrow — work has started"));
    if (data) navigate({ to: "/workspace", search: { order: data as string } });
  };

  const steps = [
    { icon: Lock, t: tr("تدفع ويُحجز المبلغ", "You pay, funds are held"), d: tr("لا يصل للمستقل أثناء العمل.", "The freelancer can't touch it during the work.") },
    { icon: PackageCheck, t: tr("تستلم وتفحص", "You receive and inspect"), d: tr("يُفرج عن المبلغ بعد اعتمادك أو انتهاء مهلة الفحص.", "Released after your approval or when the inspection window ends.") },
    { icon: Scale, t: tr("تحكيم عند الخلاف", "Arbitration if needed"), d: tr("فريق محايد يراجع الاتفاق والتسليم.", "A neutral team reviews the agreement and delivery.") },
  ];

  return (
    <Section title={tr("دعوة لصفقة مباشرة", "Direct contract invitation")} subtitle={tr("بضمان المُنجِز — أموالك محفوظة حتى تستلم عملك.", "Protected by Al Munjaz Hub — your money is safe until you receive the work.")}>
      <div className="mx-auto grid max-w-2xl gap-5">
        <Card className="grid gap-3">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">{tr("من", "From")}: <span className="font-semibold text-foreground">{c.seller_name}</span> {c.seller_verified && <VerifiedBadge />}</p>
          <h2 className="text-xl font-black">{c.title}</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{c.description}</p>
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
            <div><p className="text-muted-foreground">{tr("المبلغ", "Amount")}</p><p className="text-lg font-black text-primary"><bdi>{amount.toFixed(2)}</bdi> USDT</p></div>
            <div><p className="text-muted-foreground">{tr("مدة التسليم", "Delivery")}</p><p className="text-lg font-bold">{c.delivery_days} {tr("يوم", "days")}</p></div>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          {steps.map((s) => (
            <Card key={s.t} className="grid gap-1.5">
              <s.icon className="size-5 text-primary" aria-hidden />
              <p className="text-sm font-bold">{s.t}</p>
              <p className="text-xs text-muted-foreground">{s.d}</p>
            </Card>
          ))}
        </div>

        {c.status === "accepted" ? (
          c.order_id
            ? <Link to="/workspace" search={{ order: c.order_id }} className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">{tr("فتح الطلب", "Open order")}</Link>
            : <p className="text-center font-semibold text-muted-foreground">{tr("تم قبول هذه الصفقة مسبقاً.", "This contract was already accepted.")}</p>
        ) : c.status !== "open" ? (
          <p className="text-center font-semibold text-muted-foreground">{c.status === "expired" ? tr("انتهت صلاحية هذا الرابط.", "This link has expired.") : tr("ألغى المستقل هذه الصفقة.", "The freelancer cancelled this contract.")}</p>
        ) : c.is_seller ? (
          <p className="text-center text-sm text-muted-foreground">{tr("هذه صفقتك — أرسل الرابط لعميلك.", "This is your contract — send the link to your client.")}</p>
        ) : !isAuthenticated ? (
          <Link to="/auth" search={{ redirectTo: `/c/${token}` }} className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
            {tr("سجّل الدخول لقبول الصفقة", "Sign in to accept")}
          </Link>
        ) : (
          <button onClick={accept} disabled={busy} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-primary font-bold text-primary-foreground disabled:opacity-60">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {tr(`قبول وحجز ${amount.toFixed(2)} USDT في الضمان`, `Accept & hold ${amount.toFixed(2)} USDT in escrow`)}
          </button>
        )}
      </div>
      {topUp !== null && <TopUpDialog defaultAmount={topUp} onClose={() => { setTopUp(null); void wallet.refetch(); }} />}
    </Section>
  );
}
