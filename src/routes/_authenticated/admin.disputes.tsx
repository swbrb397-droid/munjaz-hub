import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileDown, Gavel, Loader2, MessagesSquare, ShieldCheck, X } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/cloud-client";
import { useAuth } from "@/hooks/use-auth";
import { sanitizeText } from "@/lib/security";
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
      { title: "مركز تسوية النزاعات والضمان | المُنجِز" },
      { name: "description", content: "مراجعة النزاعات المفتوحة، تفقّد ملفات التسليم ومحادثات الطلب، وتحرير أو إرجاع مبالغ الضمان بضغطة واحدة." },
      { property: "og:title", content: "مركز تسوية النزاعات والضمان | المُنجِز" },
      { property: "og:description", content: "تسوية نزاعات الضمان مع سجل تدقيق كامل." },
    ],
  }),
  component: AdminDisputes,
});

/** Evidence entries stored on the case (`dispute_cases.evidence` jsonb array). */
function EvidenceVault({ evidence }: { evidence: unknown }) {
  const { tr } = useLang();
  const rows = Array.isArray(evidence) ? evidence : [];
  if (rows.length === 0)
    return <p className="text-xs text-muted-foreground">{tr("لا توجد أدلة مرفقة.", "No evidence attached.")}</p>;

  return (
    <div className="grid gap-2">
      {rows.map((raw, i) => {
        const entry = (typeof raw === "string" ? { name: raw } : (raw ?? {})) as Record<string, unknown>;
        const label = String(entry["name"] ?? entry["work"] ?? entry["type"] ?? `evidence-${i + 1}`);
        const url = String(entry["url"] ?? entry["proof"] ?? entry["name"] ?? "");
        const isUrl = /^https?:\/\//i.test(url);
        const isImage = isUrl && /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url);
        return (
          <div key={`${label}-${i}`} className="rounded-lg border border-border p-2 text-[11px]">
            <p className="truncate font-bold">{label}</p>
            {isImage ? (
              <a href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={label} loading="lazy" className="mt-2 h-28 w-full rounded-lg object-cover" />
              </a>
            ) : isUrl ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-primary underline">
                {url}
              </a>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CaseModal({ item, onClose }: { item: AdminDispute; onClose: () => void }) {
  const { tr } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();
  const messages = useCaseMessages(item.order_id);
  const files = useCaseDeliverables(item.order_id);
  const resolve = useResolveDispute();
  const [ruling, setRuling] = useState("");
  const [directive, setDirective] = useState("");
  const [sendingDirective, setSendingDirective] = useState(false);

  /** Injects a binding official admin message into the order chat. */
  const sendDirective = async () => {
    if (!item.order_id || !user || directive.trim().length < 5) return;
    setSendingDirective(true);
    const { error } = await supabase.from("order_messages").insert({
      order_id: item.order_id,
      sender_id: user.id,
      body: `⚖️ توجيه إداري رسمي من إدارة المُنجِز: ${sanitizeText(directive, 2000)}`,
      lang: "ar",
    });
    setSendingDirective(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDirective("");
    void qc.invalidateQueries({ queryKey: ["admin-case-messages", item.order_id] });
    toast.success(tr("تم إرسال التوجيه الإداري إلى محادثة الطلب.", "Official directive posted to the order chat."));
  };

  const settle = (action: "release" | "refund") => {
    resolve.mutate(
      { id: item.id, action, ...(ruling.trim() ? { ruling: ruling.trim() } : {}) },
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

        <div className="mt-4 rounded-xl border border-border p-4">
          <h3 className="text-xs font-black">{tr("خزنة الأدلة المرفوعة", "Evidence vault")}</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <EvidenceVault evidence={item.evidence} />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-accent/40 bg-accent/5 p-4">
          <h3 className="text-xs font-black text-accent">{tr("إرسال توجيه إداري رسمي", "Send an official admin directive")}</h3>
          <textarea
            value={directive}
            onChange={(e) => setDirective(e.target.value)}
            rows={2}
            placeholder={tr("نص ملزم يُضاف إلى محادثة الطلب…", "Binding text injected into the order chat…")}
            className="mt-3 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={sendingDirective || directive.trim().length < 5 || !item.order_id}
            onClick={() => void sendDirective()}
            className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground disabled:opacity-50"
          >
            {sendingDirective ? tr("جارٍ الإرسال…", "Sending…") : tr("إرسال التوجيه", "Send directive")}
          </button>
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
