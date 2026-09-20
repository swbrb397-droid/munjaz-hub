import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Real AI translation for order-chat messages (Arabic <-> English).
 * The API key stays server-side; callers must be authenticated.
 */
export const translateMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string; target: "ar" | "en"; context?: string[] }) => {
    const text = String(input?.text ?? "").trim().slice(0, 2000);
    if (!text) throw new Error("TEXT_REQUIRED");
    const target: "ar" | "en" = input?.target === "en" ? "en" : "ar";
    // Bounded context: at most the last 5 messages, 120 chars each.
    const context = (Array.isArray(input?.context) ? input.context : [])
      .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
      .slice(-5)
      .map((c) => c.trim().slice(0, 120));
    return { text, target, context };
  })
  .handler(async ({ data }) => {
    const targetName = data.target === "en" ? "English" : "Arabic";
    const contextBlock = data.context.length
      ? `\n\nConversation context (most recent last, for disambiguation only — DO NOT translate these):\n${data.context.map((c, i) => `${i + 1}. ${c}`).join("\n")}`
      : "";

    const instruction = `Translate the following freelance platform message into natural, professional ${targetName}. Preserve technical terms (API, UI/UX, Escrow, USDT, Bug, SEO, Frontend, Backend) without literal distortion. Return ONLY the translation, with no quotes and no notes.${contextBlock}\n\n${data.text}`;

    // Primary engine: Gemini (key stays in encrypted server secrets).
    const geminiKey = process.env["GEMINI_API_KEY"];
    if (geminiKey) {
      try {
        const gres = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: instruction }] }] }),
          },
        );
        if (gres.ok) {
          const gp = (await gres.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const out = gp.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
          if (out) return { text: out, target: data.target };
        } else {
          console.error("gemini translate failed", gres.status, await gres.text());
        }
      } catch (err) {
        console.error("gemini translate error", err);
      }
    }

    // Fallback engine: Lovable AI Gateway.
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI_UNAVAILABLE");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a professional translator for a digital services marketplace. Translate the user's message into natural, professional ${targetName} as a native business writer would phrase it — never a literal word-for-word rendering. Keep industry terminology intact in its common form (API, UI/UX, USDT, Escrow, Bug, SEO, Frontend, Backend). Output ONLY the translation, with no quotes, no notes and no transliteration. Preserve numbers, links and formatting.${contextBlock}`,
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
