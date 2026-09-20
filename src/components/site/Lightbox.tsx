import { useEffect, useState } from "react";
import { X, ZoomIn, ZoomOut, Download } from "lucide-react";
import { useLang } from "@/lib/lang";

export type LightboxImage = { url: string; name: string };

/**
 * In-app image viewer used instead of window.open(), which mobile browsers
 * block ("تم حظر نافذة منبثقة") when called after an async signed-URL fetch.
 */
export function Lightbox({ image, onClose }: { image: LightboxImage | null; onClose: () => void }) {
  const { tr } = useLang();
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
  }, [image?.url]);

  useEffect(() => {
    if (!image) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [image, onClose]);

  if (!image) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.name}
      className="fixed inset-0 z-[90] flex flex-col bg-background/95 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="flex items-center gap-2 border-b border-border/60 px-3 py-2"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="min-w-0 flex-1 truncate text-xs font-bold">{image.name}</span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
          disabled={zoom <= 1}
          aria-label={tr("تصغير", "Zoom out")}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-border disabled:opacity-40"
        >
          <ZoomOut className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
          disabled={zoom >= 4}
          aria-label={tr("تكبير", "Zoom in")}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-border disabled:opacity-40"
        >
          <ZoomIn className="size-4" />
        </button>
        <a
          href={image.url}
          download={image.name}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={tr("تنزيل", "Download")}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-border"
        >
          <Download className="size-4" />
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label={tr("إغلاق", "Close")}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-border"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3" onClick={(e) => e.stopPropagation()}>
        <img
          src={image.url}
          alt={image.name}
          style={{ transform: `scale(${zoom})` }}
          className="mx-auto max-h-full max-w-full origin-center object-contain transition-transform"
        />
      </div>
    </div>
  );
}
