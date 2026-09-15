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
    SESSION_EXPIRED: [
      "انتهت صلاحية جلستك — يرجى تسجيل الدخول من جديد ثم إعادة المحاولة.",
      "Your session expired — please sign in again and retry.",
    ],
    Unauthorized: [
      "انتهت صلاحية جلستك — يرجى تسجيل الدخول من جديد ثم إعادة المحاولة.",
      "Your session expired — please sign in again and retry.",
    ],
  };
  const key = Object.keys(map).find((k) => raw.includes(k));
  const entry = key ? map[key] : undefined;
  // Never mask an unknown gateway error — surface the real text to the user.
  if (!entry) return raw?.trim() || (ar ? "فشل إنشاء الفاتورة" : "Failed to create the invoice");
  return ar ? entry[0] : entry[1];
}

/**
 * Guarantees the bearer token attached to the server call is a live JWT.
 * A token that is missing, malformed or about to expire is refreshed first,
 * so the gateway call never fails with "Unauthorized: Invalid token".
 */
async function ensureFreshSession(force = false): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const token = session?.access_token ?? "";
  const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
  const stale = !token || token.split(".").length !== 3 || expiresAt - Date.now() < 60_000;

  if (force || stale) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    const next = refreshed.session?.access_token ?? "";
    if (error || next.split(".").length !== 3) throw new Error("SESSION_EXPIRED");
    return next;
  }
  return token;
}

/** Creates a gateway invoice for a USDT wallet top-up. */
export function useCreateTopUp() {
  const create = useServerFn(createTopUpInvoice);
  return useMutation({
    mutationFn: async (input: { amount: number; network: TopUpNetwork; method: TopUpMethod }) => {
      await ensureFreshSession();
      try {
        return await create({ data: input });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e ?? "");
        // One retry with a force-refreshed token covers a race with token rotation.
        if (!/unauthorized|invalid token|jwt/i.test(message)) throw e;
        await ensureFreshSession(true);
        return await create({ data: input });
      }
    },
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
