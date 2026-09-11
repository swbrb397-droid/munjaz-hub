import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Crown, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/site/Shell";
import { useLang } from "@/lib/lang";
import { usePassPreview, tierLabel } from "@/lib/platform";
import { useRedeemPass } from "@/lib/governance";

/** Redeem a subscription pass with a live confirmation preview before activation. */
export function RedeemPassCard({ className = "" }: { className?: string }) {
  const { tr, lang } = useLang();
  const [code, setCode] = useState("");
  const preview = usePassPreview(code);
  const redeem = useRedeemPass();

  const data = preview.data;
  const expected = data
    ? new Date(Date.now() + data.duration_days * 86_400_000).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")
    : null;

  const confirm = () =>
    redeem.mutate(code, {
      onSuccess: (result) => {
        toast.success(result.message ?? tr("تم تفعيل اشتراكك بنجاح!", "Your subscription is now active!"));
        setCode("");
      },
      onError: (e: Error) =>
        toast.error(
          /used|expired|not found|invalid/i.test(e.message)
            ? tr("رمز البطاقة غير صالح أو مستخدم مسبقاً.", "This pass code is invalid or already used.")
            : e.message,
        ),
    });

  return (
    <Card className={`border-primary/25 ${className}`}>
      <h3 className="flex items-center gap-2 font-bold">
        <KeyRound className="size-4 text-primary" /> {tr("استرداد بطاقة اشتراك", "Redeem subscription pass")}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {tr("الصق رمز البطاقة لعرض تفاصيل الباقة قبل التفعيل.", "Paste your pass code to preview the plan before activation.")}
      </p>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\s+/g, "").toUpperCase())}
        dir="ltr"
        maxLength={32}
        placeholder="MJ-XXXX-XXXX-XXXX"
        aria-label={tr("رمز بطاقة الاشتراك", "Subscription pass code")}
        className="field-lux mt-4 w-full px-3 py-2.5 font-mono text-sm tracking-wider text-foreground"
      />

      {preview.isFetching && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> {tr("جارٍ التحقق من البطاقة...", "Checking the pass...")}
        </p>
      )}

      {!preview.isFetching && code.trim().length >= 8 && !data && (
        <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {tr("لم يتم العثور على بطاقة بهذا الرمز.", "No pass found for this code.")}
        </p>
      )}

      {data && (
        <div className="mt-4 grid gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <Crown className="size-4 text-accent" />
            <span className="text-sm font-black">{tierLabel(data.tier, lang === "ar")}</span>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-primary" />
              {tr("مدة الاشتراك", "Duration")}: <span className="font-bold text-foreground">{data.duration_days} {tr("يوماً", "days")}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5 text-primary" />
              {tr("تاريخ الانتهاء المتوقع", "Expected expiry")}: <span className="font-bold text-foreground">{expected}</span>
            </span>
          </div>

          {!data.is_valid ? (
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {tr("هذه البطاقة مستخدمة أو منتهية الصلاحية.", "This pass is already used or expired.")}
            </p>
          ) : (
            <button
              type="button"
              onClick={confirm}
              disabled={redeem.isPending}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground glow disabled:opacity-60"
            >
              {redeem.isPending ? <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" />{tr("جارٍ التفعيل...", "Activating...")}</span> : tr("استرداد", "Redeem")}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
