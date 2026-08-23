import { useState } from "react";
import { Check, Copy, Share2, X } from "lucide-react";
import { QrCode } from "@/components/site/QrCode";

/** Share action for a service card: QR popup + copy link. */
export function ShareListing({ id, title, variant = "icon" }: { id: string; title: string; variant?: "icon" | "button" }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/listing/${id}` : `/listing/${id}`;

  return (
    <>
      <button
        type="button"
        aria-label="مشاركة العرض"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          variant === "button"
            ? "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-2/60 py-2 text-[11px] font-bold text-foreground hover:border-primary hover:text-primary"
            : "absolute top-2 start-2 grid size-7 place-items-center rounded-full border border-border bg-background/70 text-foreground backdrop-blur hover:border-primary hover:text-primary"
        }
      >
        <Share2 className="size-3.5" />
        {variant === "button" && <span>مشاركة العرض 🔗</span>}
      </button>


      {open && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-background/85 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <div className="w-full max-w-xs rounded-2xl border border-border bg-card p-5" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="min-w-0 truncate text-sm font-black">مشاركة العرض</h2>
              <button type="button" aria-label="إغلاق" onClick={() => setOpen(false)} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border">
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{title}</p>
            <div className="mt-4 grid place-items-center">
              <QrCode value={url} size={168} />
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-bold"
            >
              {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
              {copied ? "تم نسخ الرابط" : "نسخ رابط العرض"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
