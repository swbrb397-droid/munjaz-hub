import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileDown, Gavel, Loader2, MessagesSquare, ShieldCheck, X } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useUserProfile } from "@/hooks/use-user-profile";
import {
  useAdminDisputes,
  useCaseDeliverables,
  useCaseMessages,
  useResolveDispute,
  vaultUrl,
  type AdminDispute,
} from "@/lib/admin-cases";
import { formatUsdt } from "@/lib/security";

export const Route = createFileRoute("/_authenticated/admin/disputes")({
  head: () => ({
    meta: [
      { title: "مركز تسوية النزاعات والضمان | الـمُـنْـجِـز" },
      { name: "description", content: "مراجعة النزاعات المفتوحة، تفقّد ملفات التسليم ومحادثات الطلب، وتحرير أو إرجاع مبالغ الضمان بضغطة واحدة." },
      { property: "og:title", content: "مركز تسوية النزاعات والضمان | الـمُـنْـجِـز" },
      { property: "og:description", content: "تسوية نزاعات الضمان مع سجل تدقيق كامل." },
    ],
  }),
  component: AdminDisputes,
});

function CaseModal({ item, onClose }: { item: AdminDispute; onClose: () => void }) {
  const { tr } = useLang();
  const messages = useCaseMessages(item.order_id);
  const files = useCaseDeliverables(item.order_id);
  const resolve = useResolveDispute();
  const [ruling, setRuling] = useState("");

  const settle = (action: "release" | "refund") => {
    resolve.mutate(
      { id: item.id, action, ruling: ruling.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(
            action === "release"
              ? tr("تم تحرير المبلغ للبائع ✅", "Escrow released to the seller ✅")
              : tr("تم إرجاع المبلغ للمشتري ✅", "Escrow refunded to the buyer ✅"),
          );
          onClose();
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-start justify-center overflow-y-auto bg-background/85 p-4 backdrop-blur" role="dialog" aria-modal="true">
      <Card className="my-4 w-full max-w-2xl">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="min-w-0 truncate text-sm font-black">{tr("ملف النزاع", "Dispute file")} · {item.kind}</h2>
          <button type="button" onClick={onClose} aria-label={tr("إغلاق", "Close")} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-2 rounded-xl border border-border p-4 text-sm">
          <p className="font-bold">{item.order?.title ?? tr("بدون طلب مرتبط", "No linked order")}</p>
          <p className="text-xs text-muted-foreground">{item.reason}</p>
          {item.order && (
            <p className="text-xs">
              {tr("قيمة الضمان", "Escrow value")}: <span className="font-bold text-primary">{formatUsdt(item.order.amount_usdt)} USDT</span>
              {" · "}{item.order.status}
            </p>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <h3 className="flex items-center gap-2 text-xs font-black"><FileDown className="size-4 text-accent" /> {tr("ملفات التسليم (Vault)", "Deliverables (Vault)")}</h3>
            <div className="mt-3 grid gap-2">
              {files.isLoading && <Loader2 className="size-4 animate-spin text-primary" />}
              {!files.isLoading && (files.data ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">{tr("لا توجد ملفات مرفوعة.", "No files uploaded.")}</p>
              )}
              {(files.data ?? []).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={async () => {
                    const url = await vaultUrl(f.storage_path);
                    if (url) window.open(url, "_blank", "noopener");
                    else toast.error(tr("تعذّر فتح الملف.", "Could not open the file."));
                  }}
                  className="truncate rounded-lg border border-border px-3 py-2 text-start text-[11px] hover:border-primary hover:text-primary"
                >
                  {f.is_final ? "★ " : ""}{f.file_name}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border p-4">
            <h3 className="flex items-center gap-2 text-xs font-black"><MessagesSquare className="size-4 text-accent" /> {tr("سجل المحادثة", "Chat transcript")}</h3>
            <div className="mt-3 max-h-56 overflow-y-auto grid gap-2">
              {messages.isLoading && <Loader2 className="size-4 animate-spin text-primary" />}
              {!messages.isLoading && (messages.data ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">{tr("لا توجد رسائل.", "No messages.")}</p>
              )}
              {(messages.data ?? []).map((m) => (
                <div key={m.id} className="rounded-lg border border-border/70 p-2 text-[11px]">
                  <p className="text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>
                  <p className="mt-1 break-words">{m.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <label className="mt-4 grid gap-2 text-sm">
          <span className="text-muted-foreground">{tr("حيثيات القرار (اختياري)", "Ruling notes (optional)")}</span>
          <textarea
            value={ruling}
            onChange={(e) => setRuling(e.target.value)}
            rows={2}
            className="rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={resolve.isPending}
            onClick={() => settle("release")}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {tr("تحرير المبلغ للبائع", "Release to seller")}
          </button>
          <button
            type="button"
            disabled={resolve.isPending}
            onClick={() => settle("refund")}
            className="rounded-xl border border-destructive/60 px-4 py-2 text-sm font-bold text-destructive disabled:opacity-60"
          >
            {tr("إرجاع المبلغ للمشتري", "Refund buyer")}
          </button>
        </div>
      </Card>
    </div>
  );
}

function AdminDisputes() {
  const { tr } = useLang();
  const { isAdmin } = useUserProfile();
  const [onlyOpen, setOnlyOpen] = useState(true);
  const disputes = useAdminDisputes(isAdmin, onlyOpen);
  const [active, setActive] = useState<AdminDispute | null>(null);

  useEffect(() => {
    if (!active) return;
    const fresh = (disputes.data ?? []).find((d) => d.id === active.id);
    if (fresh && fresh !== active) setActive(fresh);
  }, [disputes.data, active]);

  return (
    <Section
      title={tr("مركز تسوية النزاعات والضمان", "Dispute & escrow resolution center")}
      subtitle={tr("فحص الأدلة وتسوية الضمان بضغطة واحدة", "Inspect the evidence and settle escrow in one click")}
    >
      <Card className="mb-6 flex flex-wrap items-center gap-2">
        <Gavel className="size-4 text-primary" />
        {([[true, tr("النزاعات النشطة", "Active disputes")], [false, tr("الكل", "All")]] as const).map(([v, label]) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => setOnlyOpen(v)}
            className={`rounded-lg px-3 py-1.5 text-sm ${onlyOpen === v ? "bg-primary font-bold text-primary-foreground" : "border border-border text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </Card>

      <Card>
        {disputes.isLoading ? (
          <div className="grid place-items-center py-10"><Loader2 className="size-5 animate-spin text-primary" /></div>
        ) : (disputes.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {tr("لا توجد نزاعات حالياً.", "No disputes right now.")}
          </p>
        ) : (
          <div className="grid gap-3">
            {(disputes.data ?? []).map((d) => (
              <div key={d.id} className="grid gap-3 rounded-xl border border-border p-4 text-sm md:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <p className="truncate font-bold">{d.order?.title ?? d.kind}</p>
                  <p className="truncate text-xs text-muted-foreground">{d.reason}</p>
                  <p className="mt-1 text-xs">
                    <span className="rounded-md border border-border px-2 py-0.5">{d.status}</span>
                    {d.order && <span className="ms-2 font-bold text-primary">{formatUsdt(d.order.amount_usdt)} USDT</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActive(d)}
                  className="inline-flex items-center gap-2 self-start rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"
                >
                  <ShieldCheck className="size-4" /> {tr("فحص وتسوية", "Inspect & settle")}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {active && <CaseModal item={active} onClose={() => setActive(null)} />}
    </Section>
  );
}
