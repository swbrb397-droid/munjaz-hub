import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `أنت المساعد الذكي الرسمي لمنصة «مُنجَز» للأعمال الرقمية والضمان (Escrow).
أجب دائماً بالعربية الفصحى المهنية وبإيجاز (٣ جمل كحد أقصى).
تخصصك: مواعيد التسليم، تعليمات الطلب، حالة التقدّم، آلية الضمان، والمراحل (Milestones).
لا تطلب أبداً بيانات تواصل خارجية أو معلومات دفع خارج المنصة، وذكّر المستخدم بأن الدفع محمي داخل الضمان.
إذا كان السؤال خارج نطاق الطلب، اعتذر بلطف ووجّه المستخدم لمركز الدعم.`;

/** Secure Gemini-backed order assistant. The API key never reaches the client bundle. */
export const orderAiAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; message: string }) => {
    if (!input?.orderId) throw new Error("ORDER_REQUIRED");
    const message = String(input.message ?? "").trim().slice(0, 2000);
    if (!message) throw new Error("MESSAGE_REQUIRED");
    return { orderId: String(input.orderId), message };
  })
  .handler(async ({ data, context }) => {
    // Only parties of the order may query the assistant (RLS-scoped read).
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("id, title, status, delivery_days, due_at, amount_usdt, sow_terms")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("FORBIDDEN");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI_UNAVAILABLE");

    const orderContext = [
      `عنوان الطلب: ${order.title}`,
      `الحالة: ${order.status}`,
      `مدة التسليم: ${order.delivery_days} يوم`,
      order.due_at ? `الموعد النهائي: ${order.due_at}` : "",
      `قيمة الضمان: ${order.amount_usdt} USDT`,
      order.sow_terms ? `نطاق العمل: ${String(order.sow_terms).slice(0, 800)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: `بيانات الطلب الحالي:\n${orderContext}` },
          { role: "user", content: data.message },
        ],
      }),
    });

    if (res.status === 429) throw new Error("RATE_LIMITED");
    if (res.status === 402) throw new Error("CREDITS_REQUIRED");
    if (!res.ok) {
      console.error("order-ai-assistant failed", res.status, await res.text());
      throw new Error("AI_UNAVAILABLE");
    }

    const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = payload.choices?.[0]?.message?.content?.trim();
    return { reply: reply || "تعذّر توليد رد الآن، يرجى المحاولة مرة أخرى." };
  });
