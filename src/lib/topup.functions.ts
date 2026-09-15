import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type TopUpNetwork = "trc20" | "bep20" | "polygon";
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

/** Exact NOWPayments pay_currency identifiers per settlement network. */
const NP_CURRENCY: Record<TopUpNetwork, string> = {
  trc20: "usdttrc20",
  bep20: "usdtbsc",
  polygon: "usdtmatic",
};

type VerifiedDepositUser = {
  userId: string;
};

/**
 * Verify the exact bearer token sent with this server-function request.
 *
 * This deliberately uses Auth's `getUser(token)` endpoint instead of local
 * JWKS/claims validation. That keeps invoice creation reliable while signing
 * keys rotate and gives us precise diagnostics without ever logging the JWT.
 */
async function verifyDepositUser(): Promise<VerifiedDepositUser> {
  const request = getRequest();
  const authHeader = request?.headers.get("authorization")?.trim() ?? "";

  if (!authHeader) {
    console.error("[createTopUpInvoice:auth] Missing Authorization header");
    throw new Error("AUTH_HEADER_MISSING");
  }
  if (!authHeader.startsWith("Bearer ")) {
    console.error("[createTopUpInvoice:auth] Authorization header is not Bearer");
    throw new Error("AUTH_HEADER_INVALID");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    console.error("[createTopUpInvoice:auth] Bearer token is empty");
    throw new Error("AUTH_TOKEN_MISSING");
  }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!supabaseUrl || !publishableKey) {
    console.error("[createTopUpInvoice:auth] Auth service environment is unavailable");
    throw new Error("AUTH_SERVICE_UNAVAILABLE");
  }

  const authClient = createClient<Database>(supabaseUrl, publishableKey, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);

  if (error || !user) {
    console.error("[createTopUpInvoice:auth] Token verification failed", {
      status: error?.status ?? null,
      code: error?.code ?? null,
      message: error?.message ?? "No user returned",
    });
    throw new Error("AUTH_TOKEN_INVALID");
  }

  return { userId: user.id };
}

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
  .inputValidator((input: { amount: number; network: TopUpNetwork; method?: TopUpMethod }) => {
    const amount = Math.round(Number(input.amount) * 1e6) / 1e6;
    if (!Number.isFinite(amount) || amount < 10) throw new Error("MIN_TOPUP_10");
    if (amount > 100000) throw new Error("MAX_TOPUP_100000");
    if (input.network !== "trc20" && input.network !== "bep20" && input.network !== "polygon")
      throw new Error("INVALID_NETWORK");
    const method: TopUpMethod = input.method === "card" ? "card" : "crypto";
    return { amount, network: input.network, method };
  })
  .handler(async ({ data }): Promise<TopUpInvoice> => {
    const { userId } = await verifyDepositUser();
    const apiKey = process.env["NOWPAYMENTS_API_KEY"];
    const fallbackAddress =
      data.network === "trc20"
        ? process.env["DEPOSIT_ADDRESS_TRC20"]
        : data.network === "polygon"
          ? process.env["DEPOSIT_ADDRESS_POLYGON"]
          : process.env["DEPOSIT_ADDRESS_BEP20"];

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
