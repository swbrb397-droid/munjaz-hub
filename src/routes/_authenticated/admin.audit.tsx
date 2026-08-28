import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, ScrollText } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useRoles } from "@/lib/queries";
import { readAuditEvents, type AuditEvent, type AuditEventType } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "عارض سجل التدقيق | الـمُـنْـجِـز" },
      { name: "description", content: "تصفية وتصدير سجل تدقيق المنصة: تنزيلات PDF، بلاغات النزاعات، وبصمات المستندات." },
      { property: "og:title", content: "عارض سجل التدقيق | الـمُـنْـجِـز" },
      { property: "og:description", content: "فلاتر تفاعلية حسب المستخدم ونوع الحدث وبصمة المستند مع تصدير CSV." },
    ],
  }),
  component: AuditViewer,
});

const TYPES: (AuditEventType | "all")[] = [
  "all",
  "PDF_DOWNLOAD_EVENT",
  "DISPUTE_FLAG",
  "ASSET_DOWNLOAD_EVENT",
  "DOWNLOAD_TOKEN_EVENT",
  "TRANSLATION_CACHE_EVENT",
];

function toCsv(rows: AuditEvent[]): string {
  const head = ["timestamp", "type", "user_id", "target", "hash", "meta"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const body = rows.map((r) =>
    [r.at, r.type, r.userId ?? "", r.target, r.hash ?? "", JSON.stringify(r.meta ?? {})].map((v) => esc(String(v))).join(","),
  );
  return [head.join(","), ...body].join("\n");
}

function AuditViewer() {
  const { tr } = useLang();
  const roles = useRoles();
  const isAdmin = (roles.data ?? []).includes("admin");

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [user, setUser] = useState("");
  const [type, setType] = useState<AuditEventType | "all">("all");
  const [hash, setHash] = useState("");

  useEffect(() => {
    setEvents(readAuditEvents().slice().reverse());
    const onEvent = () => setEvents(readAuditEvents().slice().reverse());
    window.addEventListener("munjaz:audit", onEvent);
    return () => window.removeEventListener("munjaz:audit", onEvent);
  }, []);

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (type === "all" || e.type === type) &&
          (!user.trim() || (e.userId ?? "").toLowerCase().includes(user.trim().toLowerCase())) &&
          (!hash.trim() || (e.hash ?? "").toLowerCase().includes(hash.trim().toLowerCase())),
      ),
    [events, type, user, hash],
  );

  const exportCsv = () => {
    const blob = new Blob([`\uFEFF${toCsv(filtered)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `munjaz-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (roles.isLoading) {
    return <Section title={tr("سجل التدقيق", "Audit log")}><Card>{tr("جارٍ التحقق من الصلاحيات…", "Checking permissions…")}</Card></Section>;
  }

  if (!isAdmin) {
    return (
      <Section title={tr("سجل التدقيق", "Audit log")} subtitle={tr("صلاحيات محدودة", "Restricted access")}>
        <Card>
          <p className="text-sm text-muted-foreground">
            {tr("هذه الصفحة مخصّصة لمشرفي المنصة فقط.", "This page is restricted to platform administrators.")}
          </p>
        </Card>
      </Section>
    );
  }

  return (
    <Section
      title={tr("عارض سجل التدقيق", "Audit log viewer")}
      subtitle={tr("تتبّع أحداث التنزيل والنزاعات وبصمات المستندات", "Track download, dispute, and document-hash events")}
    >
      <Card className="mb-4 grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground">
            <ArrowLeft className="size-3.5" /> {tr("لوحة الإدارة", "Admin dashboard")}
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ScrollText className="size-4 text-primary" /> {filtered.length} / {events.length} {tr("حدثاً", "events")}
          </span>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="ms-auto inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            <Download className="size-4" /> {tr("تصدير CSV 📊", "Export CSV 📊")}
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder={tr("تصفية حسب المستخدم (ID)", "Filter by user ID")}
            className="w-full min-w-0 rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AuditEventType | "all")}
            aria-label={tr("نوع الحدث", "Event type")}
            className="w-full min-w-0 rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{t === "all" ? tr("كل الأحداث", "All events") : t}</option>
            ))}
          </select>
          <input
            value={hash}
            dir="ltr"
            onChange={(e) => setHash(e.target.value)}
            placeholder={tr("بصمة المستند", "Document hash")}
            className="w-full min-w-0 rounded-lg border border-input bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          />
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {tr("لا توجد أحداث مطابقة.", "No matching events.")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-start text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  {[tr("الوقت", "Timestamp"), tr("النوع", "Type"), tr("المستخدم", "User"), tr("المستهدف", "Target"), tr("البصمة", "Hash")].map((h) => (
                    <th key={h} className="border-b border-border px-2 py-2 text-start font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={`${e.at}-${i}`} className="align-top">
                    <td className="border-b border-border/60 px-2 py-2 font-mono" dir="ltr">{new Date(e.at).toLocaleString()}</td>
                    <td className="border-b border-border/60 px-2 py-2 font-bold text-primary">{e.type}</td>
                    <td className="border-b border-border/60 px-2 py-2 font-mono text-muted-foreground" dir="ltr">{e.userId ?? "—"}</td>
                    <td className="max-w-[220px] truncate border-b border-border/60 px-2 py-2">{e.target}</td>
                    <td className="border-b border-border/60 px-2 py-2 font-mono text-muted-foreground" dir="ltr">{e.hash ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Section>
  );
}
