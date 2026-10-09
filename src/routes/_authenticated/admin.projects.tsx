import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, Section } from "@/components/site/Shell";
import { ProjectStatusChip } from "@/components/site/ProjectStatusChip";
import { useLang } from "@/lib/lang";
import { supabase } from "@/lib/cloud-client";
import { categoryLabel, projectError, usd } from "@/lib/projects";

export const Route = createFileRoute("/_authenticated/admin/projects")({
  head: () => ({
    meta: [
      { title: "إدارة المشاريع | المنجز" },
      { name: "description", content: "مراجعة المشاريع المفتوحة وعروضها وإغلاق المخالف منها." },
      { property: "og:title", content: "إدارة المشاريع | المنجز" },
      { property: "og:description", content: "لوحة مراقبة المشاريع والعروض." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminProjects,
});

function AdminProjects() {
  const { tr, lang } = useLang();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const projects = useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data;
    },
  });
  const proposals = useQuery({
    queryKey: ["admin-project-proposals", openId],
    enabled: !!openId,
    queryFn: async () => {
      const { data, error } = await supabase.from("project_proposals").select("*").eq("project_id", openId!).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const moderate = useMutation({
    mutationFn: async (v: { id: string; action: "close" | "remove" | "reopen"; note: string }) => {
      const { error } = await supabase.rpc("admin_moderate_project", { _project_id: v.id, _action: v.action, _note: v.note });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tr("تم تنفيذ الإجراء وتسجيله", "Action applied and logged"));
      void qc.invalidateQueries({ queryKey: ["admin-projects"] });
      void qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e) => toast.error(projectError(e, ar)),
  });

  const rows = useMemo(() => (projects.data ?? []).filter((p) => status === "all" || p.status === status), [projects.data, status]);
  const act = (id: string, action: "close" | "remove" | "reopen") => {
    const note = window.prompt(tr("سبب الإجراء (يظهر لصاحب المشروع ويُحفظ في سجل التدقيق):", "Reason (shown to the owner and saved in the audit log):"));
    if (note === null) return;
    moderate.mutate({ id, action, note: note.trim().slice(0, 500) });
  };

  return (
    <Section title={tr("إدارة المشاريع", "Project moderation")} subtitle={tr("كل إجراء يُسجَّل في سجل التدقيق. المشاريع ذات الضمان الجاري تُدار من مكتب النزاعات.", "Every action is audited. Projects with active escrow are handled via the dispute desk.")}>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="mb-3 rounded-lg border border-input bg-surface px-3 py-2 text-sm">
        {["all", "open", "in_progress", "completed", "closed", "removed"].map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <p className="mb-2 text-xs text-muted-foreground">{tr("العدد:", "Count:")} <bdi>{rows.length}</bdi></p>
      <div className="grid gap-2">
        {rows.map((p) => (
          <Card key={p.id} className="p-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <Link to="/project/$id" params={{ id: p.id }} className="min-w-0 flex-1 break-words text-sm font-bold hover:text-primary">{p.title}</Link>
              <ProjectStatusChip status={p.status} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {categoryLabel(p.category, ar)} · <bdi>{usd(p.budget_min)} – {usd(p.budget_max)}</bdi> USDT · <bdi>{p.proposals_count}</bdi> {tr("عرض", "bids")} · <bdi>{new Date(p.created_at).toLocaleString(ar ? "ar" : "en")}</bdi>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setOpenId(openId === p.id ? null : p.id)} className="rounded-lg border border-border px-2.5 py-1 text-xs font-bold">{tr("سجل العروض", "Proposal log")}</button>
              {p.status === "open" && <button type="button" disabled={moderate.isPending} onClick={() => act(p.id, "close")} className="rounded-lg border border-border px-2.5 py-1 text-xs font-bold">{tr("إغلاق", "Close")}</button>}
              {(p.status === "open" || p.status === "closed") && <button type="button" disabled={moderate.isPending} onClick={() => act(p.id, "remove")} className="rounded-lg border border-destructive/40 px-2.5 py-1 text-xs font-bold text-destructive">{tr("حذف لمخالفة", "Remove")}</button>}
              {(p.status === "closed" || p.status === "removed") && <button type="button" disabled={moderate.isPending} onClick={() => act(p.id, "reopen")} className="rounded-lg border border-primary/40 px-2.5 py-1 text-xs font-bold text-primary">{tr("إعادة فتح", "Reopen")}</button>}
            </div>
            {openId === p.id && (
              <div className="mt-3 grid gap-2 border-t border-border pt-3">
                {(proposals.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">{tr("لا توجد عروض.", "No proposals.")}</p>}
                {(proposals.data ?? []).map((r) => (
                  <div key={r.id} className="rounded-lg bg-surface-2/40 p-2 text-xs">
                    <p><bdi className="font-mono">{r.freelancer_id.slice(0, 8)}</bdi> · <bdi className="font-bold text-primary">{usd(r.amount_usdt)}</bdi> USDT · <bdi>{r.delivery_days}</bdi>d · {r.status} · <bdi>{new Date(r.created_at).toLocaleString(ar ? "ar" : "en")}</bdi></p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{r.cover_letter}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </Section>
  );
}
