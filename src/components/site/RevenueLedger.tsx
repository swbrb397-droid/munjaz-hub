import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/cloud-client";
import { useLang } from "@/lib/lang";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/site/Shell";
import { MfaChallengeDialog } from "@/components/site/MfaChallengeDialog";

const fmt = (n: number) => Number(n ?? 0).toFixed(2);

/** Owner profit ledger: gross commission − owner withdrawals = undrawn profit. */
export function RevenueLedger() {
  const { tr, lang } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [txRef, setTxRef] = useState("");
  const [notes, setNotes] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ["admin-revenue-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_revenue_summary");
      if (error) throw error;
      const r = (data ?? [])[0];
      return {
        gross: Number(r?.gross_commission ?? 0),
        withdrawn: Number(r?.owner_withdrawals ?? 0),
        net: Number(r?.net_available ?? 0),
      };
    },
  });

  const ledger = useQuery({
    queryKey: ["admin-profit-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_profit_withdrawals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const value = Math.round(Number(amount) * 100) / 100;
      const { error } = await supabase.from("admin_profit_withdrawals").insert({
        admin_id: user!.id,
        amount: value,
        tx_ref: txRef.trim() || null,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tr("تم تسجيل سحب الأرباح", "Owner withdrawal recorded"));
      setOpen(false);
      setAmount("");
      setTxRef("");
      setNotes("");
      void qc.invalidateQueries({ queryKey: ["admin-revenue-summary"] });
      void qc.invalidateQueries({ queryKey: ["admin-profit-withdrawals"] });
    },
    onError: () => toast.error(tr("تعذّر التسجيل — تأكد من صلاحية المشرف والتحقق الثنائي.", "Failed — admin role and 2FA are required.")),
  });

  const submit = async () => {
    const value = Number(amount);
    if (!(value > 0)) return toast.error(tr("أدخل مبلغاً صحيحاً", "Enter a valid amount"));
    if (summary.data && value > summary.data.net) {
      return toast.error(tr("المبلغ يتجاوز صافي الأرباح المتبقية", "Amount exceeds undrawn profit"));
    }
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp?.find((f) => f.status === "verified");
    if (!factor) return toast.error(tr("فعّل التحقق الثنائي أولاً", "Enable 2FA first"));
    setFactorId(factor.id);
  };

  const s = summary.data;
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          [tr("إجمالي العمولات المكتسبة", "Total gross commission earned"), s?.gross],
          [tr("إجمالي مسحوبات الإدارة/المالك", "Total owner withdrawals"), s?.withdrawn],
          [tr("صافي الأرباح المتبقية للسحب", "Net undrawn profit"), s?.net],
        ].map(([k, v]) => (
          <Card key={String(k)}>
            <p className="text-sm text-muted-foreground">{k}</p>
            <p className="text-2xl font-black text-primary">
              <bdi>{fmt(Number(v ?? 0))}</bdi> USDT
            </p>
          </Card>
        ))}
      </div>

      <Card className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">{tr("سجل سحوبات المالك", "Owner withdrawal ledger")}</h3>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground"
          >
            <Plus className="size-4" /> {tr("تسجيل سحب أرباح للمالك", "Record owner withdrawal")}
          </button>
        </div>
        {(ledger.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr("لا توجد سحوبات مسجلة بعد.", "No withdrawals recorded yet.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="p-2 text-start font-medium">{tr("التاريخ", "Date")}</th>
                  <th className="p-2 text-start font-medium">{tr("المبلغ", "Amount")}</th>
                  <th className="p-2 text-start font-medium">{tr("المرجع", "Reference")}</th>
                  <th className="p-2 text-start font-medium">{tr("ملاحظات", "Notes")}</th>
                </tr>
              </thead>
              <tbody>
                {(ledger.data ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="p-2 text-xs" dir="ltr">{new Date(r.created_at).toLocaleString(lang === "ar" ? "ar" : "en")}</td>
                    <td className="p-2 font-bold text-primary"><bdi>{fmt(Number(r.amount))}</bdi> USDT</td>
                    <td className="max-w-[180px] truncate p-2 font-mono text-xs" dir="ltr">{r.tx_ref || "—"}</td>
                    <td className="p-2 text-xs text-muted-foreground">{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
          <Card className="grid w-full max-w-md gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{tr("تسجيل سحب أرباح للمالك", "Record owner withdrawal")}</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label={tr("إغلاق", "Close")}><X className="size-4" /></button>
            </div>
            <label className="grid gap-1 text-xs">
              {tr("المبلغ (USDT)", "Amount (USDT)")}
              <input type="number" min="0.01" step="0.01" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
            </label>
            <label className="grid gap-1 text-xs">
              {tr("مرجع البوابة / Tx Hash (اختياري)", "Gateway / Tx hash reference (optional)")}
              <input dir="ltr" maxLength={200} value={txRef} onChange={(e) => setTxRef(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
            </label>
            <label className="grid gap-1 text-xs">
              {tr("ملاحظات", "Notes")}
              <textarea maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-20 rounded-lg border border-border bg-background p-3 text-sm" />
            </label>
            <button type="button" disabled={save.isPending} onClick={submit} className="min-h-[44px] rounded-lg bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50">
              {tr("تأكيد بالتحقق الثنائي", "Confirm with 2FA")}
            </button>
          </Card>
        </div>
      )}

      {factorId && (
        <MfaChallengeDialog
          factorId={factorId}
          title={tr("تأكيد سحب أرباح المالك", "Confirm owner withdrawal")}
          onClose={() => setFactorId(null)}
          onVerified={async () => {
            setFactorId(null);
            await save.mutateAsync();
          }}
        />
      )}
    </div>
  );
}
