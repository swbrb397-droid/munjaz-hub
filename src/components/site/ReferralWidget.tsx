import { useState } from "react";
import { useEnsureReferralCode } from "@/lib/referral-code";
import { toast } from "sonner";
import { Copy, Users, Wallet2 } from "lucide-react";
import { Card } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useReferrals } from "@/lib/queries";

/** Referral link + live partner stats, shared by the wallet and profile pages. */
export function ReferralWidget({ className = "" }: { className?: string }) {
  const { tr } = useLang();
  const { user } = useAuth();
  const profile = useProfile();
  const referrals = useReferrals();
  const [copied, setCopied] = useState(false);

  const storedCode = (profile.data as { referral_code?: string } | null)?.referral_code ?? "";
  // Persists a code on the profile when it is still empty, then uses the live value.
  const code = useEnsureReferralCode(storedCode, profile.isSuccess || profile.isError);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = code ? `${origin}/auth?ref=${code}` : "";

  const joined = referrals.data?.referrals.length ?? 0;
  const earned = referrals.data?.totalEarned ?? 0;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success(tr("تم نسخ رابط الإحالة بنجاح", "Referral link copied successfully"));
    } catch {
      toast.error(tr("تعذّر النسخ", "Copy failed"));
    }
  };

  return (
    <Card className={`border-accent/25 ${className}`}>
      <h3 className="flex items-center gap-2 font-bold">
        <Users className="size-4 text-accent" /> {tr("برنامج الإحالات ومكافآت الشركاء", "Referrals & partner rewards")}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {tr("شارك رابطك واكسب عمولة من صافي أرباح المنصة لمدة 12 شهراً.", "Share your link and earn commission from net platform profit for 12 months.")}
      </p>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input
          readOnly
          dir="ltr"
          value={link || tr("جارٍ إنشاء الرابط...", "Generating link...")}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={tr("رابط الإحالة", "Referral link")}
          className="field-lux min-w-0 px-3 py-2.5 font-mono text-[11px] text-accent sm:text-xs"
        />
        <button
          type="button"
          onClick={copy}
          disabled={!link}
          className="chip chip-hover shrink-0 !text-primary disabled:opacity-50"
        >
          <Copy className="size-4" /> {copied ? tr("تم النسخ", "Copied") : tr("نسخ الرابط", "Copy link")}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface-2/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">{tr("عدد المسجلين عبرك", "Users joined via you")}</p>
          <p className="mt-1 text-2xl font-black">{joined}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-2/50 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wallet2 className="size-3.5" /> {tr("أرباح الإحالة (USDT)", "Referral earnings (USDT)")}
          </p>
          <p className="mt-1 text-2xl font-black text-primary">{earned.toFixed(2)}</p>
        </div>
      </div>
    </Card>
  );
}
