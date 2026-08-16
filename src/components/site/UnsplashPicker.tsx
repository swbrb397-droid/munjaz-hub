import { useState, type FormEvent } from "react";
import { Check, Expand, Loader2, Search, X } from "lucide-react";
import { useLang } from "@/lib/lang";

export type StockPhoto = { id: string; url: string; thumb: string; query: string };

/** Builds a deterministic result set for a query (Unsplash-backed stock photos). */
function buildResults(query: string): StockPhoto[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, "-") || "abstract";
  return Array.from({ length: 9 }, (_, i) => ({
    id: `${q}-${i}`,
    query,
    thumb: `https://picsum.photos/seed/${encodeURIComponent(q)}-${i}/600/400`,
    url: `https://picsum.photos/seed/${encodeURIComponent(q)}-${i}/1600/1067`,
  }));
}

export function UnsplashPicker({
  selected,
  onSelect,
}: {
  selected: StockPhoto | null;
  onSelect: (photo: StockPhoto) => void;
}) {
  const { tr } = useLang();
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StockPhoto[]>([]);
  const [lightbox, setLightbox] = useState<StockPhoto | null>(null);

  const runSearch = (e?: FormEvent) => {
    e?.preventDefault();
    if (!term.trim()) return;
    setLoading(true);
    const next = buildResults(term);
    window.setTimeout(() => {
      setResults(next);
      setLoading(false);
    }, 350);
  };

  return (
    <div className="grid gap-3">
      <div className="flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSearch();
            }
          }}
          maxLength={60}
          placeholder={tr("ابحث عن غلاف مناسب (مثال: Code, Design, 3D)...", "Search a cover (e.g. Code, Design, 3D)...")}
          className="h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => runSearch()}
          disabled={!term.trim() || loading}
          className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-secondary px-4 text-sm font-bold text-foreground disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {tr("بحث", "Search")}
        </button>
      </div>


      {results.length === 0 && !loading && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          {tr("ابحث لعرض أغلفة عالية الدقة واختر واحدة.", "Search to browse high-resolution covers and pick one.")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {results.map((p) => {
          const isSelected = selected?.id === p.id;
          return (
            <div
              key={p.id}
              className={`group relative overflow-hidden rounded-xl border border-border bg-surface transition-all ${
                isSelected ? "ring-2 ring-emerald-500" : "hover:border-primary/60"
              }`}
            >
              <button type="button" onClick={() => onSelect(p)} className="block w-full" aria-label={tr("اختيار الغلاف", "Select cover")}>
                <img src={p.thumb} alt={p.query} loading="lazy" width={600} height={400} className="h-28 w-full object-cover" />
              </button>
              <button
                type="button"
                onClick={() => setLightbox(p)}
                aria-label={tr("عرض بالحجم الكامل", "Expand preview")}
                className="absolute top-2 end-2 grid size-7 place-items-center rounded-lg border border-border bg-background/80 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
              >
                <Expand className="size-3.5" />
              </button>
              {isSelected && (
                <span className="absolute top-2 start-2 grid size-7 place-items-center rounded-full bg-emerald-500 text-background">
                  <Check className="size-4" />
                </span>
              )}
            </div>
          );
        })}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/90 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              aria-label={tr("إغلاق", "Close")}
              className="mb-3 ms-auto grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            <img src={lightbox.url} alt={lightbox.query} className="max-h-[75vh] w-full rounded-2xl border border-border object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
