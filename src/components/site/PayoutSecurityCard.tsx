import { useState } from "react";
import { Sparkles, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/site/Shell";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 min-h-[24px] w-11 shrink-0 items-center rounded-full border transition-colors ${
        checked ? "border-primary bg-primary/30" : "border-border bg-secondary"
      }`}
    >
      <span
        className={`absolute size-4 rounded-full transition-all ${
          checked ? "start-6 bg-primary" : "start-1 bg-muted-foreground"
        }`}
      />
    </button>
  );
}

/** Security time-lock controls for payouts. */
export function PayoutSecurityCard({ className = "" }: { className?: string }) {
  const [timeLock, setTimeLock] = useState(true);

  return (
    <Card className={className}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <h3 className="min-w-0 text-sm font-black">إدارة أمان وسحب الأرباح المتقدم</h3>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent">
          <Sparkles className="size-3" /> ميزة حصرية لباقات Pro والشركات ⭐
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-xl border border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-sm font-bold">
              <TimerReset className="size-4 shrink-0 text-primary" />
              <span className="min-w-0">قفل وتأخير السحب الأمني (Time-Lock)</span>
            </p>
            <Toggle
              checked={timeLock}
              label="قفل وتأخير السحب الأمني"
              onChange={(v) => {
                setTimeLock(v);
                toast.success(v ? "تم تفعيل فترة التهدئة 24 ساعة على السحوبات الكبيرة" : "تم تعطيل قفل السحب الأمني");
              }}
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            فرض فترة تهدئة إلزامية مدتها 24 ساعة على طلبات السحب الكبيرة لحماية الرصيد من محاولات الاستنزاف.
          </p>
        </div>
      </div>
    </Card>
  );
}
