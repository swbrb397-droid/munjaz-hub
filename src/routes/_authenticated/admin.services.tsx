import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Eye, Loader2, MoreHorizontal, Pause, Play, Search, Trash2, X } from "lucide-react";
import { Card, Section } from "@/components/site/Shell";
import { CoverImage } from "@/components/site/CoverImage";
import { useLang } from "@/lib/lang";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useAdminServices, useDeleteService, useToggleService, type AdminService } from "@/lib/admin-services";

export const Route = createFileRoute("/_authenticated/admin/services")({
  head: () => ({
    meta: [
      { title: "إدارة العروض والخدمات | المنجز" },
      { name: "description", content: "مكتب الإشراف على العروض: معاينة الخدمات، إيقافها أو تفعيلها، وحذفها نهائياً مع تسجيل كامل لإجراءات الإدارة." },
      { property: "og:title", content: "إدارة العروض والخدمات | المنجز" },
      { property: "og:description", content: "إشراف كامل على عروض البائعين داخل منصة المنجز." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminServices,
});

const CATEGORIES = [
  ["all", "كل التصنيفات", "All categories"],
  ["freelance", "خدمات مستقلة", "Freelance"],
  ["course", "دورات", "Courses"],
  ["product", "منتجات رقمية", "Products"],
  ["gaming", "ألعاب", "Gaming"],
] as const;

type StatusFilter = "all" | "active" | "suspended";

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB");
  } catch {
    return "—";
  }
}

function ActionsMenu({
  row,
  busy,
  onPreview,
  onToggle,
  onDelete,
}: {
  row: AdminService;
  busy: boolean;
  onPreview: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { tr } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        aria-label={tr("إجراءات", "Actions")}
        className="grid size-11 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
      </button>

      {open ? (
        <>
          <button type="button" aria-label={tr("إغلاق", "Close")} onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <div className="absolute end-0 z-40 mt-2 w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card shadow-xl max-sm:fixed max-sm:bottom-6 max-sm:end-auto max-sm:left-1/2 max-sm:top-auto max-sm:mt-0 max-sm:w-[min(18rem,calc(100vw-2rem))] max-sm:-translate-x-1/2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onPreview();
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-start text-sm hover:bg-surface"
            >
              <Eye className="size-4 text-primary" /> {tr("معاينة العرض", "Inspect service")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onToggle();
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-start text-sm hover:bg-surface"
            >
              {row.is_published ? <Pause className="size-4 text-amber-400" /> : <Play className="size-4 text-emerald-400" />}
              {row.is_published ? tr("إيقاف العرض", "Suspend service") : tr("تفعيل العرض", "Activate service")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-start text-sm text-destructive hover:bg-surface"
            >
              <Trash2 className="size-4" /> {tr("حذف العرض نهائياً", "Delete permanently")}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  const { tr } = useLang();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
        active ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
      }`}
    >
      {active ? tr("نشط", "Active") : tr("موقوف", "Suspended")}
    </span>
  );
}

function AdminServices() {
  const { tr, lang } = useLang();
  const { isAdmin } = useUserProfile();
  const rows = useAdminServices(isAdmin);
  const toggle = useToggleService();
  const remove = useDeleteService();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [preview, setPreview] = useState<AdminService | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminService | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const title = (r: AdminService) => (lang === "ar" ? r.title_ar : r.title_en) || r.title_ar || r.title_en;

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows.data ?? []).filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (status === "active" && !r.is_published) return false;
      if (status === "suspended" && r.is_published) return false;
      if (!q) return true;
      return (
        r.title_ar.toLowerCase().includes(q) ||
        r.title_en.toLowerCase().includes(q) ||
        r.sellerName.toLowerCase().includes(q)
      );
    });
  }, [rows.data, search, category, status]);

  const doToggle = (row: AdminService) => {
    setBusyId(row.id);
    toggle.mutate(
      { id: row.id, next: !row.is_published },
      {
        onSuccess: () => toast.success(tr("تم تحديث حالة العرض بنجاح", "Service status updated")),
        onError: (e: Error) => toast.error(e.message),
        onSettled: () => setBusyId(null),
      },
    );
  };

  const doDelete = (row: AdminService) => {
    setBusyId(row.id);
    remove.mutate(row.id, {
      onSuccess: () => {
        setConfirmDelete(null);
        toast.success(tr("تم حذف العرض نهائياً", "Service permanently deleted"));
      },
      onError: (e: Error) => toast.error(e.message),
      onSettled: () => setBusyId(null),
    });
  };

  return (
    <Section
      title={tr("إدارة العروض والخدمات", "Services moderation")}
      subtitle={tr("إشراف كامل على عروض البائعين: معاينة، إيقاف، أو حذف نهائي مع تسجيل كل إجراء", "Full oversight of seller listings: inspect, suspend, or permanently delete — every action is logged")}
    >
      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="relative sm:col-span-3 lg:col-span-1">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr("بحث باسم الخدمة أو البائع…", "Search by service or seller…")}
              className="h-11 w-full rounded-xl border border-input bg-surface ps-9 pe-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 rounded-xl border border-input bg-surface px-3 text-sm outline-none focus:border-primary"
          >
            {CATEGORIES.map(([value, ar, en]) => (
              <option key={value} value={value}>
                {tr(ar, en)}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="h-11 rounded-xl border border-input bg-surface px-3 text-sm outline-none focus:border-primary"
          >
            <option value="all">{tr("الكل", "All")}</option>
            <option value="active">{tr("نشط", "Active")}</option>
            <option value="suspended">{tr("معطل / موقوف", "Suspended")}</option>
          </select>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {tr("إجمالي العروض", "Total services")}: <bdi className="font-bold text-foreground">{(rows.data ?? []).length}</bdi>
        </p>
      </Card>

      {rows.isLoading ? (
        <div className="mt-4 grid gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-surface/60" />
          ))}
        </div>
      ) : rows.error ? (
        <Card className="mt-4">
          <p className="text-sm text-destructive">{(rows.error as Error).message}</p>
        </Card>
      ) : (rows.data ?? []).length === 0 ? (
        <Card className="mt-4 border-dashed">
          <p className="py-10 text-center text-sm text-muted-foreground">{tr("لا توجد خدمات مسجلة في المنصة بعد", "No services registered on the platform yet")}</p>
        </Card>
      ) : list.length === 0 ? (
        <Card className="mt-4 border-dashed">
          <p className="py-10 text-center text-sm text-muted-foreground">{tr("لا توجد نتائج مطابقة.", "No matching results.")}</p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="text-start">
                  <th className="p-2 text-start">{tr("الخدمة", "Service")}</th>
                  <th className="p-2 text-start">{tr("البائع", "Seller")}</th>
                  <th className="p-2 text-start">{tr("التصنيف", "Category")}</th>
                  <th className="p-2 text-start">{tr("السعر", "Price")}</th>
                  <th className="p-2 text-start">{tr("الحالة", "Status")}</th>
                  <th className="p-2 text-start">{tr("تاريخ الإنشاء", "Created")}</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-t border-border align-middle">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <CoverImage src={r.cover_url} alt={title(r)} category={r.category} className="size-12 shrink-0 rounded-lg" iconClassName="size-5" />
                        <span className="line-clamp-2 font-semibold">{title(r)}</span>
                      </div>
                    </td>
                    <td className="p-2 text-muted-foreground">{r.sellerName}</td>
                    <td className="p-2 text-muted-foreground">{r.category}</td>
                    <td className="p-2"><bdi className="font-bold">{r.price_usdt.toFixed(2)}</bdi> <span className="text-xs text-muted-foreground">USDT</span></td>
                    <td className="p-2"><StatusPill active={r.is_published} /></td>
                    <td className="p-2 text-xs text-muted-foreground" dir="ltr">{fmtDate(r.created_at)}</td>
                    <td className="p-2">
                      <ActionsMenu
                        row={r}
                        busy={busyId === r.id}
                        onPreview={() => setPreview(r)}
                        onToggle={() => doToggle(r)}
                        onDelete={() => setConfirmDelete(r)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="mt-4 grid gap-3 md:hidden">
            {list.map((r) => (
              <Card key={r.id}>
                <div className="flex items-start gap-3">
                  <CoverImage src={r.cover_url} alt={title(r)} category={r.category} className="size-16 shrink-0 rounded-xl" iconClassName="size-6" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-bold">{title(r)}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{r.sellerName} · {r.category}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <StatusPill active={r.is_published} />
                      <span className="font-bold"><bdi>{r.price_usdt.toFixed(2)}</bdi> USDT</span>
                      <span className="text-muted-foreground" dir="ltr">{fmtDate(r.created_at)}</span>
                    </div>
                  </div>
                  <ActionsMenu
                    row={r}
                    busy={busyId === r.id}
                    onPreview={() => setPreview(r)}
                    onToggle={() => doToggle(r)}
                    onDelete={() => setConfirmDelete(r)}
                  />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {preview ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-bold">{title(preview)}</h3>
              <button type="button" aria-label={tr("إغلاق", "Close")} onClick={() => setPreview(null)} className="grid size-9 place-items-center rounded-lg border border-border">
                <X className="size-4" />
              </button>
            </div>
            <CoverImage src={preview.cover_url} alt={title(preview)} category={preview.category} className="mt-4 h-44 w-full rounded-xl" />
            <dl className="mt-4 grid gap-2 text-sm">
              {([
                [tr("البائع", "Seller"), preview.sellerName],
                [tr("التصنيف", "Category"), preview.category],
                [tr("السعر", "Price"), `${preview.price_usdt.toFixed(2)} USDT`],
                [tr("الحالة", "Status"), preview.is_published ? tr("نشط", "Active") : tr("موقوف", "Suspended")],
                [tr("تاريخ الإنشاء", "Created"), fmtDate(preview.created_at)],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-semibold"><bdi>{v}</bdi></dd>
                </div>
              ))}
            </dl>
            <Link
              to="/listing/$id"
              params={{ id: preview.id }}
              onClick={() => setPreview(null)}
              className="mt-4 grid h-11 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground"
            >
              {tr("فتح صفحة العرض كما يراها المشتري", "Open the buyer-facing page")}
            </Link>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0F172A] p-6">
            <h3 className="flex items-center gap-2 text-base font-bold text-destructive">
              <AlertTriangle className="size-5" /> {tr("حذف نهائي", "Permanent deletion")}
            </h3>
            <p className="mt-3 text-sm text-muted-foreground">
              {tr("هل أنت متأكد من حذف هذا العرض نهائياً من المنصة؟ لا يمكن التراجع عن هذا الإجراء", "Delete this service permanently? This action cannot be undone.")}
            </p>
            <p className="mt-2 truncate text-sm font-semibold">{title(confirmDelete)}</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={busyId === confirmDelete.id}
                onClick={() => doDelete(confirmDelete)}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-destructive text-sm font-bold text-destructive-foreground disabled:opacity-60"
              >
                {busyId === confirmDelete.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {tr("حذف نهائياً", "Delete")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="h-11 flex-1 rounded-xl border border-border text-sm font-bold"
              >
                {tr("إلغاء", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Section>
  );
}
