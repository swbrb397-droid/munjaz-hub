import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Gemini models tried in order; the first that answers wins. */
const GEMINI_MODELS = ["gemini-3.6-flash", "gemini-flash-latest"] as const;

async function tryGemini(apiKey: string, instruction: string): Promise<string | null> {
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: instruction }] }] }),
          },
        );
        if (res.ok) {
          const payload = (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const out = payload.candidates?.[0]?.content?.parts
            ?.map((p) => p.text ?? "")
            .join("")
            .trim();
          if (out) return out;
          break;
        }
        // 503 = temporary overload: one short retry, then next model.
        if (res.status === 503) {
          await new Promise((r) => setTimeout(r, 700));
          continue;
        }
        console.error("gemini translate failed", model, res.status, await res.text());
        break;
      } catch (err) {
        console.error("gemini translate error", model, err);
        break;
      }
    }
  }
  return null;
}

/** Free public fallback so a translation is never null. */
async function tryMyMemory(text: string, target: "ar" | "en"): Promise<string | null> {
  try {
    const pair = target === "ar" ? "en|ar" : "ar|en";
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=${pair}`,
    );
    if (!res.ok) return null;
    const payload = (await res.json()) as { responseData?: { translatedText?: string } };
    const out = payload.responseData?.translatedText?.trim();
    return out && !/^\s*(MYMEMORY WARNING|QUERY LENGTH LIMIT)/i.test(out) ? out : null;
  } catch (err) {
    console.error("mymemory translate error", err);
    return null;
  }
}

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

    // 1) Primary engine: Gemini (key stays in encrypted server secrets).
    const geminiKey = process.env["GEMINI_API_KEY"];
    if (geminiKey) {
      const out = await tryGemini(geminiKey, instruction);
      if (out) return { text: out, target: data.target };
    }

    // 2) Fallback engine: Lovable AI Gateway.
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (apiKey) {
      try {
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
        if (res.ok) {
          const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const translated = payload.choices?.[0]?.message?.content?.trim();
          if (translated) return { text: translated, target: data.target };
        } else {
          console.error("gateway translate failed", res.status, await res.text());
        }
      } catch (err) {
        console.error("gateway translate error", err);
      }
    }

    // 3) Last-resort public engine so translation never returns null.
    const mm = await tryMyMemory(data.text, data.target);
    if (mm) return { text: mm, target: data.target };

    throw new Error("TRANSLATION_FAILED");
  });
