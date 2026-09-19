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

export const PROHIBITED_CONTENT_MESSAGE =
  "تم رفض الصورة: تم اكتشاف محتوى مخالف لسياسة المنصة (مواد محظورة أو غير ملائمة)";

/** Fail-closed thresholds mandated by platform policy. */
const T = { drugs: 0.4, pills: 0.4, weapons: 0.5, nudityRaw: 0.5, offensive: 0.7, scam: 0.8 };

async function screenViaSightengine(dataUrl: string, apiUser: string, apiSecret: string): Promise<Verdict | null> {
  try {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
    if (!match) return null;
    const [, mime, b64] = match;
    const bin = Uint8Array.from(atob(b64!), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("media", new Blob([bin], { type: mime! }), "cover");
    form.append("models", "nudity-2.0,wad,offensive,scam");
    form.append("api_user", apiUser);
    form.append("api_secret", apiSecret);
    const res = await fetch("https://api.sightengine.com/1.0/check.json", { method: "POST", body: form });
    if (!res.ok) return null;
    const p = (await res.json()) as {
      status?: string;
      nudity?: { raw?: number; partial?: number; sexual_activity?: number; sexual_display?: number; erotica?: number };
      offensive?: { prob?: number };
      weapon?: number | { classes?: Record<string, number> };
      drugs?: number;
      recreational_drug?: { prob?: number };
      medical?: number | { prob?: number };
      scam?: { prob?: number };
    };
    if (p.status !== "success") return null;

    const nudityRaw = Math.max(
      p.nudity?.raw ?? 0,
      p.nudity?.sexual_activity ?? 0,
      p.nudity?.sexual_display ?? 0,
    );
    const weapons = typeof p.weapon === "number" ? p.weapon : Math.max(0, ...Object.values(p.weapon?.classes ?? {}));
    const drugs = Math.max(p.drugs ?? 0, p.recreational_drug?.prob ?? 0);
    const pills = typeof p.medical === "number" ? p.medical : (p.medical?.prob ?? 0);
    const offensive = p.offensive?.prob ?? 0;
    const scam = p.scam?.prob ?? 0;

    if (
      drugs > T.drugs ||
      pills > T.pills ||
      weapons > T.weapons ||
      nudityRaw > T.nudityRaw ||
      offensive > T.offensive ||
      scam > T.scam
    ) {
      return { allowed: false, reason: PROHIBITED_CONTENT_MESSAGE };
    }
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
