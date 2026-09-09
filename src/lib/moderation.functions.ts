import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODERATION_PROMPT = `You are the cover-image moderation engine for المُنجِز, a digital services marketplace.
Apply a PERMISSIVE, business-friendly moderation profile for service cover artwork.

You MUST allow (verdict ALLOWED: true):
- Promotional text overlays on artwork, Arabic calligraphy and typography.
- Service feature lists, pricing numbers, currency amounts.
- Software, app, and brand logos used in portfolio/mockup context.
- Artistic portfolio covers, UI mockups, product shots, banners.

Do NOT reject legitimate service artwork or mockups for containing text, prices, or logos.

Reject (verdict ALLOWED: false) ONLY for these two violations:
a) Blatant contact leakage intended to bypass platform fees: explicit phone numbers, WhatsApp numbers, Telegram handles, or external direct payment links rendered in the image.
b) Severe graphic or explicit adult material.

If you are uncertain, default to ALLOWED: true. False rejections frustrate sellers and are worse than a missed edge case.

Respond with STRICT JSON only, no markdown: {"allowed": boolean, "reason": string}. Keep "reason" to one short Arabic sentence.`;

/** Screens a listing cover image with a permissive, business-friendly AI profile. */
export const screenCoverImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dataUrl: string }) => {
    const dataUrl = String(input?.dataUrl ?? "");
    if (!dataUrl.startsWith("data:image/") || dataUrl.length > 7_500_000) {
      throw new Error("INVALID_IMAGE");
    }
    return { dataUrl };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { allowed: true, reason: "" }; // fail open — never block sellers on config gaps

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-lite",
          messages: [
            { role: "system", content: MODERATION_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: "افحص صورة الغلاف هذه وأعد الحكم بصيغة JSON." },
                { type: "image_url", image_url: { url: data.dataUrl } },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        console.error("cover-screening failed", res.status);
        return { allowed: true, reason: "" }; // uncertainty/gateway errors default to ALLOWED
      }
      const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = payload.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(raw) as { allowed?: boolean; reason?: string };
      if (typeof parsed.allowed !== "boolean") return { allowed: true, reason: "" };
      return { allowed: parsed.allowed, reason: String(parsed.reason ?? "").slice(0, 300) };
    } catch (e) {
      console.error("cover-screening error", e);
      return { allowed: true, reason: "" }; // fail open on any unexpected error
    }
  });
