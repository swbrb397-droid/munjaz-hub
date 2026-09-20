import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_orders",
  title: "List my orders",
  description: "List the signed-in user's Al-Munjaz orders (buyer or seller side) with escrow status.",
  inputSchema: {
    status: z
      .string()
      .trim()
      .optional()
      .describe("Optional exact order status filter, e.g. in_progress, delivered, completed, disputed."),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("orders")
      .select("id,code,title,status,amount_usdt,buyer_id,seller_id,created_at,deadline_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const userId = ctx.getUserId();
    const orders = (data ?? []).map((o) => ({
      id: String(o.id),
      code: o.code ?? null,
      title: o.title ?? "",
      status: o.status ?? "",
      amountUsdt: Number(o.amount_usdt ?? 0),
      role: o.buyer_id === userId ? "buyer" : o.seller_id === userId ? "seller" : "observer",
      createdAt: o.created_at ? String(o.created_at) : null,
      deadlineAt: o.deadline_at ? String(o.deadline_at) : null,
    }));
    return {
      content: [{ type: "text" as const, text: JSON.stringify(orders, null, 2) }],
      structuredContent: { orders },
    };
  },
});
