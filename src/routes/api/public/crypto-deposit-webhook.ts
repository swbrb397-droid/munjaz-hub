import { createFileRoute } from "@tanstack/react-router";
import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * Payment-provider webhook receiver.
 *
 * Supports NOWPayments (HMAC-SHA512 over key-sorted JSON) and Cryptomus
 * (MD5 over base64 of the payload without the `sign` field). Only after the
 * signature is verified do we credit the wallet through the service-role RPC
 * `process_auto_deposit`, which is idempotent per invoice.
 */

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** NOWPayments signs the JSON body with keys sorted alphabetically, recursively. */
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortValue((value as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return value;
}

const PAID_STATUSES = new Set(["finished", "confirmed", "paid", "paid_over", "partially_paid", "complete"]);

export const Route = createFileRoute("/api/public/crypto-deposit-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const npSignature = request.headers.get("x-nowpayments-sig");
        const cryptomusSign = typeof payload["sign"] === "string" ? (payload["sign"] as string) : null;

        let provider: "nowpayments" | "cryptomus";

        if (npSignature) {
          const secret = process.env["NOWPAYMENTS_IPN_SECRET"];
          if (!secret) return new Response("Webhook not configured", { status: 503 });
          const expected = createHmac("sha512", secret).update(JSON.stringify(sortValue(payload))).digest("hex");
          if (!safeEqual(npSignature, expected)) return new Response("Invalid signature", { status: 401 });
          provider = "nowpayments";
        } else if (cryptomusSign) {
          const apiKey = process.env["CRYPTOMUS_API_KEY"];
          if (!apiKey) return new Response("Webhook not configured", { status: 503 });
          const { sign: _sign, ...rest } = payload as Record<string, unknown> & { sign?: string };
          const expected = createHash("md5")
            .update(Buffer.from(JSON.stringify(rest)).toString("base64") + apiKey)
            .digest("hex");
          if (!safeEqual(cryptomusSign, expected)) return new Response("Invalid signature", { status: 401 });
          provider = "cryptomus";
        } else {
          return new Response("Missing signature", { status: 401 });
        }

        const status = String(payload["payment_status"] ?? payload["status"] ?? "").toLowerCase();
        if (!PAID_STATUSES.has(status)) {
          // Acknowledge non-final states so the provider stops retrying.
          return Response.json({ ok: true, ignored: status });
        }

        const orderId = typeof payload["order_id"] === "string" ? (payload["order_id"] as string) : null;
        const externalId =
          payload["payment_id"] != null
            ? String(payload["payment_id"])
            : payload["uuid"] != null
              ? String(payload["uuid"])
              : null;
        const amount = Number(payload["actually_paid"] ?? payload["payment_amount"] ?? payload["amount"] ?? 0);
        const txHash =
          typeof payload["txid"] === "string"
            ? (payload["txid"] as string)
            : typeof payload["payin_hash"] === "string"
              ? (payload["payin_hash"] as string)
              : null;

        if (!orderId && !externalId) return new Response("Missing invoice reference", { status: 400 });

        const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

        const args: { _invoice_id?: string; _provider?: string; _external_id?: string; _amount?: number; _tx_hash?: string } = {
          _provider: provider,
        };
        if (orderId && isUuid(orderId)) args._invoice_id = orderId;
        if (externalId) args._external_id = externalId;
        if (Number.isFinite(amount) && amount > 0) args._amount = amount;
        if (txHash) args._tx_hash = txHash;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("process_auto_deposit", args);

        if (error) {
          console.error("[crypto-deposit-webhook]", error.message);
          return new Response("Credit failed", { status: 500 });
        }

        return Response.json({ ok: true, credited: data?.amount_usdt ?? null });
      },
    },
  },
});
