import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TopUpNetwork = "trc20" | "bep20";

export type TopUpInvoice = {
  id: string;
  amount_usdt: number;
  network: TopUpNetwork;
  provider: string;
  pay_address: string | null;
  pay_url: string | null;
  expires_at: string;
};

const NP_CURRENCY: Record<TopUpNetwork, string> = { trc20: "usdttrc20", bep20: "usdtbsc" };

/**
 * Creates a payment invoice for a wallet top-up.
 *
 * With NOWPAYMENTS_API_KEY configured we ask the gateway for a dedicated
 * pay-in address (its webhook then credits the wallet automatically). Without
 * it we fall back to the platform's own deposit address, if one is configured.
 */
export const createTopUpInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number; network: TopUpNetwork }) => {
    const amount = Math.round(Number(input.amount) * 1e6) / 1e6;
    if (!Number.isFinite(amount) || amount < 10) throw new Error("MIN_TOPUP_10");
    if (amount > 100000) throw new Error("MAX_TOPUP_100000");
    if (input.network !== "trc20" && input.network !== "bep20") throw new Error("INVALID_NETWORK");
    return { amount, network: input.network };
  })
  .handler(async ({ data, context }): Promise<TopUpInvoice> => {
    const { userId } = context;
    const apiKey = process.env["NOWPAYMENTS_API_KEY"];
    const fallbackAddress =
      data.network === "trc20" ? process.env["DEPOSIT_ADDRESS_TRC20"] : process.env["DEPOSIT_ADDRESS_BEP20"];

    if (!apiKey && !fallbackAddress) throw new Error("GATEWAY_NOT_CONFIGURED");

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
      const res = await fetch("https://api.nowpayments.io/v1/payment", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          price_amount: data.amount,
          price_currency: "usd",
          pay_currency: NP_CURRENCY[data.network],
          order_id: invoice.id,
          order_description: `Munjaz wallet top-up ${data.amount} USDT`,
        }),
      });
      const body = (await res.json()) as { pay_address?: string; payment_id?: number | string; invoice_url?: string };
      if (!res.ok || !body.pay_address) throw new Error("GATEWAY_ERROR");

      payAddress = body.pay_address;
      payUrl = body.invoice_url ?? null;
      externalId = body.payment_id != null ? String(body.payment_id) : null;

      await supabaseAdmin
        .from("crypto_invoices")
        .update({ pay_address: payAddress, pay_url: payUrl, external_id: externalId })
        .eq("id", invoice.id);
    }

    return {
      id: invoice.id,
      amount_usdt: Number(invoice.amount_usdt),
      network: data.network,
      provider: apiKey ? "nowpayments" : "manual",
      pay_address: payAddress,
      pay_url: payUrl,
      expires_at: invoice.expires_at,
    };
  });
