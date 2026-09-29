import { Link } from "@tanstack/react-router";
import { ShieldCheck, ShieldAlert, TrendingUp, Wallet } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useLang } from "@/lib/lang";

const TIERS: Record<string, { ar: string; en: string; limit: number }> = {
  tier0: { ar: "المستوى 0 · غير موثّق", en: "Tier 0 · Unverified", limit: 100 },
  tier1: { ar: "المستوى 1 · أساسي", en: "Tier 1 · Basic", limit: 500 },
  tier2: { ar: "المستوى 2 · موثّق", en: "Tier 2 · Verified", limit: 10000 },
  tier3: { ar: "المستوى 3 · مؤسسي", en: "Tier 3 · Institutional", limit: 50000 },
};
const ORDER_GOALS = [0, 5, 25, 100];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kycTier?: string | null | undefined;
  isVerified?: boolean;
  level: number;
  completedOrders: number;
};

export function KycLevelDrawer({ open, onOpenChange, kycTier, isVerified, level, completedOrders }: Props) {
  const { tr } = useLang();
  const key = kycTier && TIERS[kycTier] ? kycTier : "tier0";
  const idx = Number(key.slice(-1));
  const cur = TIERS[key]!;
  const nextKey = idx < 3 ? `tier${idx + 1}` : null;
  const next = nextKey ? TIERS[nextKey]! : null;
  const goal = ORDER_GOALS[Math.min(idx + 1, 3)]!;
  const pct = next ? Math.min(100, Math.round((completedOrders / Math.max(goal, 1)) * 100)) : 100;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-3xl border-border/60 bg-background/85 backdrop-blur-md">
        <SheetHeader className="text-start">
          <SheetTitle>{tr("التوثيق والمستوى", "Verification & level")}</SheetTitle>
          <SheetDescription>{tr("تفاصيل مستوى التوثيق وحدود السحب اليومية.", "KYC tier details and daily withdrawal limits.")}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 grid gap-3 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-black text-primary">
              {tr(cur.ar, cur.en)}
            </span>
            <span className="rounded-full border border-border px-3 py-1 text-xs font-bold">
              {tr("المستوى", "Level")} <bdi>{level}</bdi>
            </span>
            {isVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-3 py-1 text-xs font-bold text-primary">
                <ShieldCheck className="size-3.5" /> {tr("حساب موثّق", "Verified")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 px-3 py-1 text-xs font-bold text-amber-500">
                <ShieldAlert className="size-3.5" /> {tr("غير موثّق", "Unverified")}
              </span>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-secondary/40 p-4">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Wallet className="size-3.5" /> {tr("حد السحب اليومي", "Daily withdrawal limit")}
            </p>
            <p className="mt-1 text-xl font-black text-primary"><bdi>{cur.limit.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDT</bdi></p>
          </div>
          <div className="grid gap-1.5 text-xs">
            {Object.entries(TIERS).map(([k, t]) => (
              <div key={k} className={`flex items-center justify-between rounded-xl border px-3 py-2 ${k === key ? "border-primary/60 bg-primary/10" : "border-border"}`}>
                <span className="font-bold">{tr(t.ar, t.en)}</span>
                <bdi className="font-mono">{t.limit.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDT</bdi>
              </div>
            ))}
          </div>
          {next && (
            <div className="rounded-2xl border border-border p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold">
                <TrendingUp className="size-3.5 text-primary" /> {tr("التقدم نحو", "Progress to")} {tr(next.ar, next.en)}
              </p>
              <div className="mt-2 h-2.5 rounded-full bg-secondary">
                <div className="h-2.5 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                <bdi>{completedOrders} / {goal}</bdi> {tr("طلب مكتمل", "completed orders")}
              </p>
              <Link to="/kyc" onClick={() => onOpenChange(false)} className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
                {tr("رفع مستوى التوثيق", "Upgrade verification")}
              </Link>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
