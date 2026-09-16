import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Cover-image screening.
 *
 * Primary path: Sightengine (nudity, offensive, weapons, drugs, gore).
 * Fallback: Lovable Gemini gateway with a permissive marketplace profile.
 * On any error we FAIL OPEN — sellers should not be blocked by config gaps.
 */

const GEMINI_PROMPT = `You are the cover-image moderation engine for المنجز, a digital services marketplace.
Apply a PERMISSIVE, business-friendly moderation profile for service cover artwork.

You MUST allow (verdict ALLOWED: true):
- Promotional text overlays on artwork, Arabic calligraphy and typography.
- Service feature lists, pricing numbers, currency amounts.
- Software, app, and brand logos used in portfolio/mockup context.
- Artistic portfolio covers, UI mockups, product shots, banners.

Reject (verdict ALLOWED: false) ONLY for these two violations:
a) Blatant contact leakage intended to bypass platform fees: explicit phone numbers, WhatsApp/Telegram handles, or external direct payment links rendered in the image.
b) Severe graphic or explicit adult material.

If you are uncertain, default to ALLOWED: true.
Respond with STRICT JSON only, no markdown: {"allowed": boolean, "reason": string}. Keep "reason" to one short Arabic sentence.`;

type Verdict = { allowed: boolean; reason: string };

async function screenViaSightengine(dataUrl: string, apiUser: string, apiSecret: string): Promise<Verdict | null> {
  try {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
    if (!match) return null;
    const [, mime, b64] = match;
    const bin = Uint8Array.from(atob(b64!), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("media", new Blob([bin], { type: mime! }), "cover");
    form.append("models", "nudity-2.1,offensive,weapon,recreational_drug,gore");
    form.append("api_user", apiUser);
    form.append("api_secret", apiSecret);
    const res = await fetch("https://api.sightengine.com/1.0/check.json", { method: "POST", body: form });
    if (!res.ok) return null;
    const p = (await res.json()) as {
      status?: string;
      nudity?: { sexual_activity?: number; sexual_display?: number; erotica?: number };
      offensive?: { prob?: number };
      weapon?: number | { classes?: Record<string, number> };
      recreational_drug?: { prob?: number };
      gore?: { prob?: number };
    };
    if (p.status !== "success") return null;
    const nud = Math.max(p.nudity?.sexual_activity ?? 0, p.nudity?.sexual_display ?? 0, p.nudity?.erotica ?? 0);
    const off = p.offensive?.prob ?? 0;
    const weap = typeof p.weapon === "number" ? p.weapon : Math.max(0, ...Object.values(p.weapon?.classes ?? {}));
    const drug = p.recreational_drug?.prob ?? 0;
    const gore = p.gore?.prob ?? 0;
    if (nud >= 0.6) return { allowed: false, reason: "الصورة تحتوي على محتوى بالغ صريح" };
    if (gore >= 0.6) return { allowed: false, reason: "الصورة تحتوي على محتوى دموي عنيف" };
    if (off >= 0.7) return { allowed: false, reason: "الصورة تحتوي على محتوى مسيء" };
    if (weap >= 0.7) return { allowed: false, reason: "الصورة تحتوي على أسلحة بارزة" };
    if (drug >= 0.7) return { allowed: false, reason: "الصورة تحتوي على مواد مخدرة" };
    return { allowed: true, reason: "" };
  } catch (e) {
    console.error("sightengine error", e);
    return null;
  }
}

async function screenViaGemini(dataUrl: string, apiKey: string): Promise<Verdict | null> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite",
        messages: [
          { role: "system", content: GEMINI_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "افحص صورة الغلاف هذه وأعد الحكم بصيغة JSON." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = payload.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as { allowed?: boolean; reason?: string };
    if (typeof parsed.allowed !== "boolean") return null;
    return { allowed: parsed.allowed, reason: String(parsed.reason ?? "").slice(0, 300) };
  } catch (e) {
    console.error("gemini moderation error", e);
    return null;
  }
}

export const screenCoverImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dataUrl: string }) => {
    const dataUrl = String(input?.dataUrl ?? "");
    if (!dataUrl.startsWith("data:image/") || dataUrl.length > 7_500_000) {
      throw new Error("INVALID_IMAGE");
    }
    return { dataUrl };
  })
  .handler(async ({ data }): Promise<Verdict> => {
    // Sightengine keys can arrive either as a combined secret ("user:secret")
    // in IMAGE_MODERATION_API_KEY, or as split SIGHTENGINE_API_USER + SIGHTENGINE_API_SECRET.
    const combined = process.env["IMAGE_MODERATION_API_KEY"] ?? "";
    let seUser = process.env["SIGHTENGINE_API_USER"] ?? "";
    let seSecret = process.env["SIGHTENGINE_API_SECRET"] ?? "";
    if ((!seUser || !seSecret) && combined.includes(":")) {
      const [u, s] = combined.split(":", 2);
      seUser = seUser || (u ?? "");
      seSecret = seSecret || (s ?? "");
    }

    if (seUser && seSecret) {
      const v = await screenViaSightengine(data.dataUrl, seUser, seSecret);
      if (v) return v;
    }

    const lovableKey = process.env["LOVABLE_API_KEY"];
    if (lovableKey) {
      const v = await screenViaGemini(data.dataUrl, lovableKey);
      if (v) return v;
    }

    return { allowed: true, reason: "" }; // fail open when no provider is configured
  });
