import { Check, ChevronDown, Gauge, Zap, Coins } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useLang } from "@/lib/lang";
import type { GasEstimate } from "@/lib/gas";

type Net = "trc20" | "bep20" | "polygon";

const BRAND: Record<Net, { name: string; ring: string; tint: string; dot: string; badgeAr: string; badgeEn: string; Icon: typeof Zap }> = {
  trc20: { name: "TRC-20 · Tron", ring: "ring-net-tron", tint: "bg-net-tron/10 border-net-tron/40", dot: "bg-net-tron", badgeAr: "تأكيد سريع", badgeEn: "Fast confirmation", Icon: Zap },
  bep20: { name: "BEP-20 · BSC", ring: "ring-net-bsc", tint: "bg-net-bsc/10 border-net-bsc/40", dot: "bg-net-bsc", badgeAr: "رسوم غاز منخفضة", badgeEn: "Low gas fee", Icon: Coins },
  polygon: { name: "Polygon", ring: "ring-net-polygon", tint: "bg-net-polygon/10 border-net-polygon/40", dot: "bg-net-polygon", badgeAr: "إنتاجية عالية", badgeEn: "High throughput", Icon: Gauge },
};

export function NetworkSheet({ value, onChange, rows }: { value: Net; onChange: (n: Net) => void; rows: GasEstimate[] }) {
  const { tr } = useLang();
  const [open, setOpen] = useState(false);
  const cur = BRAND[value];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="field-lux flex min-h-[42px] w-full items-center justify-between gap-2 px-3 py-2 text-start"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className={`size-2.5 shrink-0 rounded-full ${cur.dot}`} />
          <span className="truncate font-bold" dir="ltr">{cur.name}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-60" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl border-border/60 bg-background/80 backdrop-blur-md">
          <SheetHeader className="text-start">
            <SheetTitle>{tr("اختر شبكة السحب", "Choose withdrawal network")}</SheetTitle>
            <SheetDescription>{tr("تأكد أن عنوانك يدعم الشبكة المختارة.", "Make sure your address supports the selected network.")}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid gap-3 pb-4">
            {(Object.keys(BRAND) as Net[]).map((k, i) => {
              const b = BRAND[k];
              const row = rows.find((r) => r.value === k);
              const sel = k === value;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => { onChange(k); setOpen(false); }}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className={`animate-fade-in grid min-w-0 gap-2 rounded-2xl border p-4 text-start shadow-lg transition-all hover:-translate-y-0.5 hover:ring-2 ${b.ring} ${b.tint} ${sel ? "ring-2" : "ring-0"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${b.dot} text-background`}>
                        <b.Icon className="size-4" />
                      </span>
                      <span className="truncate text-sm font-black" dir="ltr">{b.name}</span>
                    </span>
                    {sel && <Check className="size-4 shrink-0 text-primary" />}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-bold">{tr(b.badgeAr, b.badgeEn)}</span>
                    {row && (
                      <>
                        <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 font-mono text-[10px] font-bold" dir="ltr">{row.fee.toFixed(2)} USDT</span>
                        <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-bold">{tr(row.etaAr, row.etaEn)}</span>
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
