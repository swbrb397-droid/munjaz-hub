import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_wallet_summary",
  title: "Get wallet summary",
  description: "Return the signed-in user's USDT wallet balance and most recent wallet transactions.",
  inputSchema: {
    transactionLimit: z.number().int().min(0).max(50).default(10),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ transactionLimit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("balance_usdt,escrow_usdt")
      .eq("user_id", userId)
      .maybeSingle();
    if (walletError) throw new ToolError(walletError.message);

    const limit = transactionLimit ?? 10;
    let transactions: Array<{ id: string; kind: string; amountUsdt: number; status: string; createdAt: string | null }> = [];
    if (limit > 0) {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("id,kind,amount_usdt,status,created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new ToolError(error.message);
      transactions = (data ?? []).map((t) => ({
        id: String(t.id),
        kind: t.kind ?? "",
        amountUsdt: Number(t.amount_usdt ?? 0),
        status: t.status ?? "",
        createdAt: t.created_at ? String(t.created_at) : null,
      }));
    }

    const summary = {
      balanceUsdt: Number(wallet?.balance_usdt ?? 0),
      escrowUsdt: Number(wallet?.escrow_usdt ?? 0),
      transactions,
    };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
