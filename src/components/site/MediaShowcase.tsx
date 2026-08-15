import { useEffect, useState } from "react";
import { Code2, Image as ImageIcon, MonitorPlay, PlayCircle, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "@/lib/lang";

// TODO: Connect to secure Supabase Storage Media Bucket via Signed URLs.

export type MediaFormat = "image" | "live" | "code" | "video";

export type MediaItem = {
  id: string;
  src: string;
  title?: string;
  format: MediaFormat;
};

const FORMAT_META: Record<MediaFormat, { icon: typeof ImageIcon; ar: string; en: string; cls: string }> = {
  image: { icon: ImageIcon, ar: "صور", en: "Images", cls: "border-primary/40 bg-primary/10 text-primary" },
  live: { icon: MonitorPlay, ar: "معاينة حية", en: "Live preview", cls: "border-accent/40 bg-accent/10 text-accent" },
  code: { icon: Code2, ar: "مقتطف كود", en: "Code snippet", cls: "border-violet/40 bg-violet/10 text-violet" },
  video: { icon: PlayCircle, ar: "معاينة فيديو", en: "Video preview", cls: "border-border bg-secondary text-foreground" },
};

function FormatBadge({ format }: { format: MediaFormat }) {
  const { lang } = useLang();
  const meta = FORMAT_META[format];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold backdrop-blur ${meta.cls}`}>
      <Icon className="size-3" /> {lang === "ar" ? meta.ar : meta.en}
    </span>
  );
}

export function MediaShowcase({ items, title }: { items: MediaItem[]; title?: string }) {
  const { tr } = useLang();
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % items.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + items.length) % items.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items.length]);

  if (!items.length) return null;
  const active = open === null ? null : items[open]!;

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{title ?? tr("معرض الوسائط", "Media showcase")}</h2>
        <p className="text-xs text-muted-foreground">{tr("اضغط على أي عنصر لعرضه بالحجم الكامل", "Tap any item to view it full size")}</p>
      </div>

      {/* Carousel on small screens, grid from sm and up */}
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
        {items.map((m, i) => (
          <button
            key={m.id}
            onClick={() => setOpen(i)}
            className="group relative min-w-[78%] snap-start overflow-hidden rounded-2xl border border-border bg-surface text-start transition-colors hover:border-primary/60 sm:min-w-0"
            aria-label={m.title ?? tr("عرض الوسيط", "View media")}
          >
            <img src={m.src} alt={m.title ?? ""} loading="lazy" width={768} height={512} className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            <span className="absolute top-2 start-2"><FormatBadge format={m.format} /></span>
            {m.title && <span className="block truncate px-3 py-2 text-sm font-semibold">{m.title}</span>}
          </button>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/90 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(null)}
        >
          <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <FormatBadge format={active.format} />
              <button onClick={() => setOpen(null)} aria-label={tr("إغلاق", "Close")} className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <img src={active.src} alt={active.title ?? ""} className="max-h-[70vh] w-full rounded-2xl border border-border object-contain" />
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                onClick={() => setOpen((i) => (i === null ? i : (i - 1 + items.length) % items.length))}
                className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                aria-label={tr("السابق", "Previous")}
              >
                <ChevronLeft className="size-4" />
              </button>
              <p className="truncate text-sm font-semibold">{active.title}</p>
              <button
                onClick={() => setOpen((i) => (i === null ? i : (i + 1) % items.length))}
                className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                aria-label={tr("التالي", "Next")}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
