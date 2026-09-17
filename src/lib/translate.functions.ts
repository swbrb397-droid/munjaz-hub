import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Real AI translation for order-chat messages (Arabic <-> English).
 * The API key stays server-side; callers must be authenticated.
 */
export const translateMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string; target: "ar" | "en" }) => {
    const text = String(input?.text ?? "").trim().slice(0, 2000);
    if (!text) throw new Error("TEXT_REQUIRED");
    const target: "ar" | "en" = input?.target === "en" ? "en" : "ar";
    return { text, target };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI_UNAVAILABLE");

    const targetName = data.target === "en" ? "English" : "Arabic";
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate the user's message into ${targetName}. Output ONLY the translation, with no quotes, no notes and no transliteration. Preserve numbers, links and formatting.`,
          },
          { role: "user", content: data.text },
        ],
      }),
    });

    if (res.status === 429) throw new Error("RATE_LIMITED");
    if (res.status === 402) throw new Error("CREDITS_REQUIRED");
    if (!res.ok) {
      console.error("translateMessage failed", res.status, await res.text());
      throw new Error("TRANSLATION_FAILED");
    }

    const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const translated = payload.choices?.[0]?.message?.content?.trim();
    if (!translated) throw new Error("TRANSLATION_FAILED");
    return { text: translated, target: data.target };
  });
