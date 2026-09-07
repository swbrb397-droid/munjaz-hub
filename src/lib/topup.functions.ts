import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TopUpNetwork = "trc20" | "bep20";
export type TopUpMethod = "crypto" | "card";

export type TopUpInvoice = {
  id: string;
  amount_usdt: number;
  network: TopUpNetwork;
  method: TopUpMethod;
  provider: string;
  pay_address: string | null;
  pay_url: string | null;
  simulated: boolean;
  expires_at: string;
};

const NP_CURRENCY: Record<TopUpNetwork, string> = { trc20: "usdttrc20", bep20: "usdtbsc" };

/**
 * Creates a NOWPayments invoice for a wallet top-up.
 *
 * - `crypto`: a dedicated pay-in address (+ QR) on TRC-20 / BEP-20.
 * - `card`: the NOWPayments hosted checkout (fiat on-ramp) — no card data
 *   ever touches this app, keeping the flow PCI-DSS compliant.
 *
 * Without gateway keys we return a simulated invoice so preview flows stay usable.
 */
export const createTopUpInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number; network: TopUpNetwork; method?: TopUpMethod }) => {
    const amount = Math.round(Number(input.amount) * 1e6) / 1e6;
    if (!Number.isFinite(amount) || amount < 10) throw new Error("MIN_TOPUP_10");
    if (amount > 100000) throw new Error("MAX_TOPUP_100000");
    if (input.network !== "trc20" && input.network !== "bep20") throw new Error("INVALID_NETWORK");
    const method: TopUpMethod = input.method === "card" ? "card" : "crypto";
    return { amount, network: input.network, method };
  })
  .handler(async ({ data, context }): Promise<TopUpInvoice> => {
    const { userId } = context;
    const apiKey = process.env["NOWPAYMENTS_API_KEY"];
    const fallbackAddress =
      data.network === "trc20" ? process.env["DEPOSIT_ADDRESS_TRC20"] : process.env["DEPOSIT_ADDRESS_BEP20"];

    // Live/production mode: no simulated invoices — the NOWPayments API key
    // must be configured so every top-up creates a real payment.
    if (!apiKey) throw new Error("GATEWAY_NOT_CONFIGURED");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invoice, error } = await supabaseAdmin
      .from("crypto_invoices")
      .insert({
        user_id: userId,
        amount_usdt: data.amount,
        network: data.network,
        provider: apiKey ? "nowpayments" : "manual",
        pay_address: apiKey ? null : (fallbackAddress ?? null),
      })
      .select()
      .single();

    if (error || !invoice) throw new Error(error?.message ?? "INVOICE_FAILED");

    let payAddress = invoice.pay_address;
    let payUrl: string | null = null;
    let externalId: string | null = null;

    if (apiKey) {
      const endpoint = data.method === "card" ? "https://api.nowpayments.io/v1/invoice" : "https://api.nowpayments.io/v1/payment";
      const body =
        data.method === "card"
          ? {
              price_amount: data.amount,
              price_currency: "usd",
              pay_currency: NP_CURRENCY[data.network],
              order_id: invoice.id,
              order_description: `Munjaz wallet top-up ${data.amount} USDT`,
              is_fee_paid_by_user: true,
            }
          : {
              price_amount: data.amount,
              price_currency: "usd",
              pay_currency: NP_CURRENCY[data.network],
              order_id: invoice.id,
              order_description: `Munjaz wallet top-up ${data.amount} USDT`,
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        pay_address?: string;
        payment_id?: number | string;
        id?: number | string;
        invoice_url?: string;
      };
      if (!res.ok || (data.method === "crypto" ? !json.pay_address : !json.invoice_url)) throw new Error("GATEWAY_ERROR");

      payAddress = json.pay_address ?? null;
      payUrl = json.invoice_url ?? null;
      externalId = (json.payment_id ?? json.id) != null ? String(json.payment_id ?? json.id) : null;

      await supabaseAdmin
        .from("crypto_invoices")
        .update({ pay_address: payAddress, pay_url: payUrl, external_id: externalId })
        .eq("id", invoice.id);
    }

    return {
      id: invoice.id,
      amount_usdt: Number(invoice.amount_usdt),
      network: data.network,
      method: data.method,
      provider: apiKey ? "nowpayments" : "manual",
      pay_address: payAddress,
      pay_url: payUrl,
      simulated: false,
      expires_at: invoice.expires_at,
    };
  });
