import { useLang } from "@/lib/lang";

export function ProjectStatusChip({ status }: { status: string }) {
  const { tr } = useLang();
  const map: Record<string, [string, string, string]> = {
    open: ["مفتوح", "Open", "bg-primary/15 text-primary"],
    in_progress: ["قيد التنفيذ", "In progress", "bg-accent/20 text-accent-foreground"],
    completed: ["مكتمل", "Completed", "bg-secondary text-foreground"],
    closed: ["مغلق", "Closed", "bg-muted text-muted-foreground"],
    removed: ["محذوف من الإدارة", "Removed", "bg-destructive/15 text-destructive"],
  };
  const [a, e, cls] = map[status] ?? [status, status, "bg-muted"];
  return <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${cls}`}>{tr(a, e)}</span>;
}
