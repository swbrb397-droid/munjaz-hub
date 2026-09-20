import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_disputes",
  title: "List my disputes",
  description: "List dispute cases visible to the signed-in user, with status and resolution details.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("dispute_cases")
      .select("id,order_id,status,reason,resolution,created_at,resolved_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) throw new ToolError(error.message);
    const disputes = (data ?? []).map((d) => ({
      id: String(d.id),
      orderId: d.order_id ? String(d.order_id) : null,
      status: d.status ?? "",
      reason: d.reason ?? "",
      resolution: d.resolution ?? null,
      createdAt: d.created_at ? String(d.created_at) : null,
      resolvedAt: d.resolved_at ? String(d.resolved_at) : null,
    }));
    return {
      content: [{ type: "text" as const, text: JSON.stringify(disputes, null, 2) }],
      structuredContent: { disputes },
    };
  },
});
