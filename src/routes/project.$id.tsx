import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Clock, Loader2, Lock, ShieldCheck, Star, Timer } from "lucide-react";
import { toast } from "sonner";
import { Card, Section } from "@/components/site/Shell";
import { ProjectStatusChip } from "@/components/site/ProjectStatusChip";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { useWallet } from "@/lib/queries";
import { supabase } from "@/lib/cloud-client";
import { sanitizeText } from "@/lib/security";
import { PresenceBadge, relativeAgo, usePresence } from "@/lib/presence";
import {
  categoryLabel, projectError, usd, useProject, useProjectAction, useProjectProposals, useProposalQuota, useSubmitProposal,
} from "@/lib/projects";

export const Route = createFileRoute("/project/$id")({
  head: () => ({
    meta: [
      { title: "تفاصيل المشروع | المنجز" },
      { name: "description", content: "تفاصيل مشروع مفتوح على المنجز — قدّم عرضك والميزانية محمية بالضمان." },
      { property: "og:title", content: "مشروع مفتوح | المنجز" },
      { property: "og:description", content: "قدّم عرضك على هذا المشروع — الدفع بـ USDT عبر الضمان." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectDetail,
});

type PublicProfile = { id: string; display_name: string; avatar_url: string | null; is_verified: boolean; rating: number; completed_orders: number };

function useProfiles(ids: string[]) {
  const key = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["public-profiles", key],
    enabled: key.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_profiles", { _ids: key });
      if (error) throw error;
      const map: Record<string, PublicProfile> = {};
      for (const r of (data ?? []) as PublicProfile[]) map[r.id] = r;
      return map;
    },
  });
}

function Countdown({ dueAt }: { dueAt: string }) {
  const { tr } = useLang();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const ms = new Date(dueAt).getTime() - now;
  if (ms <= 0) return <span className="font-bold text-destructive">{tr("انتهت مهلة التسليم", "Delivery deadline passed")}</span>;
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return <bdi className="font-mono font-bold text-primary">{d}d {h}h {m}m</bdi>;
}

function ProjectDetail() {
  const { id } = Route.useParams();
  const { tr, lang } = useLang();
  const ar = lang === "ar";
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const project = useProject(id);
  const p = project.data;
  const isOwner = !!user && p?.owner_id === user.id;
  const proposals = useProjectProposals(id, isAuthenticated && !!p);
  const rows = proposals.data ?? [];
  const myProposal = rows.find((r) => r.freelancer_id === user?.id);
  const ids = useMemo(() => [p?.owner_id, ...rows.map((r) => r.freelancer_id)].filter(Boolean) as string[], [p?.owner_id, rows]);
  const profiles = useProfiles(ids);
  const presence = usePresence(ids);
  const action = useProjectAction();
  const wallet = useWallet();

  const order = useQuery({
    queryKey: ["project-order", p?.order_id],
    enabled: !!p?.order_id && isAuthenticated,
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("id,due_at,status").eq("id", p!.order_id!).maybeSingle();
      return data;
    },
  });

  if (project.isLoading) return <Section title=""><div className="h-40 animate-pulse rounded-xl bg-secondary/70" /></Section>;
  if (!p) {
    return (
      <Section title={tr("المشروع غير متاح", "Project unavailable")}>
        <Link to="/projects" className="text-sm font-bold text-primary">{tr("العودة إلى المشاريع", "Back to projects")}</Link>
      </Section>
    );
  }
  const owner = profiles.data?.[p.owner_id];
  const available = Number(wallet.data?.available_usdt ?? 0);

  return (
    <Section title={p.title} subtitle={`${categoryLabel(p.category, ar)} · ${relativeAgo(p.created_at, ar)}`}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-4">
          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <ProjectStatusChip status={p.status} />
              <span className="rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                <bdi>{usd(p.budget_min)} – {usd(p.budget_max)}</bdi> USDT
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3.5" /> <bdi>{p.delivery_days}</bdi> {tr("يوم", "days")}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{p.description}</p>
            {p.admin_note && isOwner && <p className="mt-3 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{p.admin_note}</p>}
          </Card>

          {p.status === "in_progress" && order.data && (isOwner || myProposal?.status === "accepted") && (
            <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/40">
              <span className="inline-flex items-center gap-2 text-sm"><Timer className="size-4 text-primary" /> {tr("الوقت المتبقي للتسليم:", "Time left to deliver:")} {order.data.due_at && <Countdown dueAt={order.data.due_at} />}</span>
              <Link to="/fulfillment/$orderId" params={{ orderId: order.data.id }} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                {tr("فتح مساحة التنفيذ", "Open workspace")}
              </Link>
            </Card>
          )}

          {isOwner ? (
            <Card>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-black">{tr("العروض المستلمة", "Received proposals")} (<bdi>{rows.length}</bdi>)</h2>
                {p.status === "open" && (
                  <button
                    type="button"
                    disabled={action.isPending}
                    onClick={() => {
                      if (!window.confirm(tr("إغلاق المشروع ورفض العروض المعلقة؟", "Close project and reject pending proposals?"))) return;
                      action.mutate({ kind: "close", id: p.id }, { onSuccess: () => toast.success(tr("تم إغلاق المشروع", "Project closed")), onError: (e) => toast.error(projectError(e, ar)) });
                    }}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-destructive"
                  >
                    {tr("إغلاق المشروع", "Close project")}
                  </button>
                )}
              </div>
              {rows.length === 0 && <p className="text-xs text-muted-foreground">{tr("لم تصل عروض بعد.", "No proposals yet.")}</p>}
              <div className="grid gap-3">
                {rows.map((r) => {
                  const fp = profiles.data?.[r.freelancer_id];
                  return (
                    <div key={r.id} className="rounded-xl border border-border bg-surface-2/40 p-3">
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-bold">{fp?.display_name ?? "—"}</span>
                          {fp?.is_verified && <BadgeCheck className="size-4 shrink-0 text-accent" />}
                          {fp && <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"><Star className="size-3" /> <bdi>{Number(fp.rating).toFixed(1)}</bdi> · <bdi>{fp.completed_orders}</bdi></span>}
                        </span>
                        <PresenceBadge lastActive={presence.data?.[r.freelancer_id]} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        <span className="font-bold text-primary"><bdi>{usd(r.amount_usdt)}</bdi> USDT</span>
                        <span className="text-muted-foreground"><bdi>{r.delivery_days}</bdi> {tr("يوم", "days")}</span>
                        <ProposalStatus status={r.status} />
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">{r.cover_letter}</p>
                      {p.status === "open" && r.status === "pending" && (
                        <button
                          type="button"
                          disabled={action.isPending}
                          onClick={() => {
                            if (available < Number(r.amount_usdt)) {
                              toast.error(tr("رصيدك المتاح لا يكفي. اشحن محفظتك أولاً.", "Insufficient balance. Top up first."));
                              return;
                            }
                            if (!window.confirm(tr(`سيتم حجز ${usd(r.amount_usdt)} USDT في الضمان وبدء الطلب. متابعة؟`, `${usd(r.amount_usdt)} USDT will be locked in escrow and the order will start. Continue?`))) return;
                            action.mutate({ kind: "accept", id: r.id }, {
                              onSuccess: (orderId) => {
                                toast.success(tr("تم قبول العرض وحجز المبلغ في الضمان", "Proposal accepted and funds locked in escrow"));
                                if (orderId) navigate({ to: "/fulfillment/$orderId", params: { orderId } });
                              },
                              onError: (e) => toast.error(projectError(e, ar)),
                            });
                          }}
                          className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50"
                        >
                          {action.isPending && <Loader2 className="size-4 animate-spin" />}
                          {tr("قبول العرض وحجز المبلغ", "Accept & fund escrow")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : (
            <ProposalBox projectId={p.id} open={p.status === "open"} myProposal={myProposal} isAuthenticated={isAuthenticated} />
          )}
        </div>

        <aside className="grid content-start gap-4">
          <Card>
            <p className="text-xs text-muted-foreground">{tr("صاحب المشروع", "Project owner")}</p>
            <p className="mt-1 flex items-center gap-1 text-sm font-bold">{owner?.display_name ?? "—"} {owner?.is_verified && <BadgeCheck className="size-4 text-accent" />}</p>
            <PresenceBadge lastActive={presence.data?.[p.owner_id]} className="mt-1" />
          </Card>
          <Card className="grid gap-2 text-xs leading-relaxed text-muted-foreground">
            <span className="flex items-center gap-1.5 font-bold text-foreground"><ShieldCheck className="size-4 text-primary" /> {tr("كيف يحميك المنجز", "How Munjaz protects you")}</span>
            <span>{tr("• تُحجز قيمة العرض في الضمان لحظة القبول.", "• The amount is locked in escrow upon acceptance.")}</span>
            <span>{tr("• يُحرَّر المبلغ للمستقل بعد التسليم ومهلة الفحص.", "• Released after delivery and the inspection window.")}</span>
            <span>{tr("• النزاعات تُحكَّم بسجل محادثة غير قابل للتعديل.", "• Disputes are judged on an immutable chat log.")}</span>
            <span className="flex items-center gap-1"><Lock className="size-3" /> {tr("العروض سرّية بين المستقل وصاحب المشروع.", "Proposals are private between freelancer and owner.")}</span>
          </Card>
        </aside>
      </div>
    </Section>
  );
}

function ProposalStatus({ status }: { status: string }) {
  const { tr } = useLang();
  const m: Record<string, [string, string, string]> = {
    pending: ["بانتظار الرد", "Pending", "text-muted-foreground"],
    accepted: ["مقبول", "Accepted", "text-primary"],
    rejected: ["لم يُختر", "Not selected", "text-muted-foreground"],
    withdrawn: ["مسحوب", "Withdrawn", "text-muted-foreground"],
  };
  const [a, e, c] = m[status] ?? [status, status, ""];
  return <span className={`font-bold ${c}`}>{tr(a, e)}</span>;
}

function ProposalBox({ projectId, open, myProposal, isAuthenticated }: {
  projectId: string; open: boolean; isAuthenticated: boolean;
  myProposal: { id: string; amount_usdt: number; delivery_days: number; cover_letter: string; status: string } | undefined;
}) {
  const { tr, lang } = useLang();
  const ar = lang === "ar";
  const submit = useSubmitProposal();
  const action = useProjectAction();
  const quota = useProposalQuota(isAuthenticated && open && !myProposal);
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState(7);
  const [cover, setCover] = useState("");
  const field = "w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

  if (!isAuthenticated) {
    return (
      <Card className="text-center">
        <Link to="/auth" className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">{tr("سجّل الدخول لتقديم عرض", "Sign in to submit a proposal")}</Link>
      </Card>
    );
  }
  if (myProposal) {
    return (
      <Card>
        <h2 className="mb-2 text-base font-black">{tr("عرضك", "Your proposal")}</h2>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="font-bold text-primary"><bdi>{usd(myProposal.amount_usdt)}</bdi> USDT</span>
          <span><bdi>{myProposal.delivery_days}</bdi> {tr("يوم", "days")}</span>
          <ProposalStatus status={myProposal.status} />
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{myProposal.cover_letter}</p>
        {myProposal.status === "pending" && (
          <button type="button" disabled={action.isPending} onClick={() => action.mutate({ kind: "withdraw", id: myProposal.id }, { onSuccess: () => toast.success(tr("تم سحب العرض", "Proposal withdrawn")), onError: (e) => toast.error(projectError(e, ar)) })} className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-destructive">
            {tr("سحب العرض", "Withdraw")}
          </button>
        )}
      </Card>
    );
  }
  if (!open) return <Card className="text-sm text-muted-foreground">{tr("هذا المشروع لم يعد يستقبل عروضاً.", "This project no longer accepts proposals.")}</Card>;

  const amt = Number(amount);
  const valid = amt >= 3 && cover.trim().length >= 30;
  const q = quota.data;
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-black">{tr("قدّم عرضك", "Submit your proposal")}</h2>
        {q && <span className="text-[11px] text-muted-foreground">{tr("العروض اليوم:", "Today's proposals:")} <bdi>{q.used} / {q.cap}</bdi></span>}
      </div>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid || submit.isPending) return;
          submit.mutate({ projectId, amount: amt, days, cover: sanitizeText(cover, 2500) }, {
            onSuccess: () => toast.success(tr("تم إرسال عرضك", "Proposal sent")),
            onError: (err) => toast.error(projectError(err, ar)),
          });
        }}
      >
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">{tr("قيمة العرض (USDT)", "Your price (USDT)")}</span>
          <input className={field} type="number" min={3} step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">{tr("مدة التسليم (أيام)", "Delivery (days)")}</span>
          <input className={field} type="number" min={1} max={90} value={days} onChange={(e) => setDays(Math.min(90, Math.max(1, Number(e.target.value) || 1)))} />
        </label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="text-muted-foreground">{tr("لماذا أنت الأنسب لهذا المشروع؟", "Why are you the best fit?")}</span>
          <textarea className={`${field} min-h-28 resize-y`} maxLength={2500} value={cover} onChange={(e) => setCover(e.target.value)} />
          <span className="text-[11px] text-muted-foreground"><bdi>{cover.trim().length}</bdi> / 2500 · {tr("30 حرفاً على الأقل · بدون وسائل تواصل خارجية", "30 characters min · no external contact details")}</span>
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={!valid || submit.isPending || (!!q && q.used >= q.cap)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {submit.isPending && <Loader2 className="size-4 animate-spin" />} {tr("إرسال العرض", "Send proposal")}
          </button>
        </div>
      </form>
    </Card>
  );
}
