import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { createTopUpInvoice, type TopUpInvoice, type TopUpMethod, type TopUpNetwork } from "@/lib/topup.functions";

export type { TopUpInvoice, TopUpMethod, TopUpNetwork };

export function topUpErrorMessage(raw: string, ar: boolean): string {
  const map: Record<string, [string, string]> = {
    MIN_TOPUP_10: ["الحد الأدنى للشحن 10 USDT.", "Minimum top-up is 10 USDT."],
    MAX_TOPUP_100000: ["الحد الأقصى للشحن 100000 USDT.", "Maximum top-up is 100,000 USDT."],
    INVALID_NETWORK: ["اختر شبكة صحيحة.", "Choose a valid network."],
    GATEWAY_NOT_CONFIGURED: [
      "بوابة الدفع غير مفعّلة بعد — تواصل مع الإدارة.",
      "The payment gateway is not enabled yet — contact support.",
    ],
    GATEWAY_ERROR: ["تعذّر إنشاء الفاتورة، حاول مرة أخرى.", "Could not create the invoice, please try again."],
  };
  const key = Object.keys(map).find((k) => raw.includes(k));
  const entry = key ? map[key] : undefined;
  if (!entry) return ar ? "حدث خطأ غير متوقع." : "Something went wrong.";
  return ar ? entry[0] : entry[1];
}

/** Creates a gateway invoice for a USDT wallet top-up. */
export function useCreateTopUp() {
  const create = useServerFn(createTopUpInvoice);
  return useMutation({
    mutationFn: (input: { amount: number; network: TopUpNetwork; method: TopUpMethod }) => create({ data: input }),
  });
}

/** Watches one invoice so the UI flips to "paid" the moment the webhook credits it. */
export function useInvoiceRealtime(invoiceId: string | null, onPaid: () => void) {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!invoiceId || !user) return;
    const channel = supabase
      .channel(`invoice-${invoiceId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "crypto_invoices", filter: `id=eq.${invoiceId}` },
        (payload) => {
          if ((payload.new as { status?: string }).status === "paid") {
            void qc.invalidateQueries({ queryKey: ["wallet"] });
            void qc.invalidateQueries({ queryKey: ["transactions"] });
            onPaid();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [invoiceId, user, qc, onPaid]);
}
