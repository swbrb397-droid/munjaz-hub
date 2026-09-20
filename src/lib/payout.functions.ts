import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const NETWORK_CURRENCY: Record<string, string> = {
  trc20: "usdttrc20",
  bep20: "usdtbsc",
  polygon: "usdtmatic",
};

/**
 * One-click crypto payout: verifies the caller is an admin, blocks users with
 * an open dispute, sends the payout through NOWPayments and records the batch
 * id on the withdrawal row. The API key never leaves the server.
 */
export const sendCryptoPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { withdrawalId: string }) => {
    const withdrawalId = String(input?.withdrawalId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(withdrawalId)) throw new Error("INVALID_WITHDRAWAL_ID");
    return { withdrawalId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("FORBIDDEN");

    const { data: row, error: rowError } = await supabase
      .from("withdrawal_requests")
      .select("id, user_id, net_usdt, network, address, status")
      .eq("id", data.withdrawalId)
      .maybeSingle();
    if (rowError) throw new Error(rowError.message);
    if (!row) throw new Error("WITHDRAWAL_NOT_FOUND");
    if (row.status === "paid" || row.status === "rejected") throw new Error("ALREADY_RESOLVED");

    // Safety radar: never pay out a user who is currently in arbitration.
    const { data: openCases, error: caseError } = await supabase
      .from("dispute_cases")
      .select("id")
      .or(`raised_by.eq.${row.user_id},against_user.eq.${row.user_id}`)
      .in("status", ["open", "ai_reviewed"])
      .limit(1);
    if (caseError) throw new Error(caseError.message);
    if ((openCases ?? []).length > 0) throw new Error("OPEN_DISPUTE_BLOCK");

    const apiKey = process.env["NOWPAYMENTS_API_KEY"];
    if (!apiKey) throw new Error("PAYOUT_PROVIDER_UNCONFIGURED");

    const currency = NETWORK_CURRENCY[row.network] ?? "usdttrc20";
    const res = await fetch("https://api.nowpayments.io/v1/payout", {
      method: "POST",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        ipn_callback_url: undefined,
        withdrawals: [
          {
            address: row.address,
            currency,
            amount: Number(row.net_usdt),
            unique_external_id: row.id,
          },
        ],
      }),
    });

    const payload = (await res.json().catch(() => null)) as
      | { id?: string; withdrawals?: { id?: string; hash?: string }[]; message?: string }
      | null;

    if (!res.ok) {
      console.error("NOWPayments payout failed", res.status, payload);
      throw new Error(payload?.message ?? `PAYOUT_FAILED_${res.status}`);
    }

    const reference = payload?.withdrawals?.[0]?.hash ?? payload?.withdrawals?.[0]?.id ?? payload?.id ?? "";

    const { error: resolveError } = await supabase.rpc("resolve_withdrawal", {
      _id: row.id,
      _action: "pay",
      _tx_hash: reference,
      _note: "1-click payout via NOWPayments",
    });
    if (resolveError) throw new Error(resolveError.message);

    return { batchId: payload?.id ?? "", reference };
  });
