// Server-only Gemini key rotation. Keys live in encrypted secrets, never in code.
export type GeminiPool = "chat" | "vision";

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

const MODELS = ["gemini-3.6-flash", "gemini-flash-latest"] as const;

function poolKeys(pool: GeminiPool): string[] {
  const names =
    pool === "chat"
      ? ["GEMINI_API_KEY", "GEMINI_CHAT_KEY_2", "GEMINI_CHAT_KEY_3", "GEMINI_API_KEY_BACKUP_1", "GEMINI_API_KEY_BACKUP_2"]
      : ["GEMINI_VISION_KEY", "GEMINI_API_KEY", "GEMINI_VISION_KEY_2", "GEMINI_VISION_KEY_3"];
  const seen = new Set<string>();
  return names
    .map((n) => process.env[n])
    .filter((k): k is string => !!k && !seen.has(k) && (seen.add(k), true));
}

function isExhausted(status: number, body: string) {
  return status === 429 || /RESOURCE_EXHAUSTED/i.test(body);
}

/**
 * Calls Gemini with the pool's keys in order. On 429 / RESOURCE_EXHAUSTED the
 * next key is tried; other errors move to the next model. Returns null when
 * every key is exhausted so callers can use their existing fallbacks.
 */
export async function geminiGenerate(
  pool: GeminiPool,
  parts: Part[],
  opts: { json?: boolean } = {},
): Promise<string | null> {
  const keys = poolKeys(pool);
  for (const key of keys) {
    let rotate = false;
    for (const model of MODELS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
              contents: [{ parts }],
              ...(opts.json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
            }),
          },
        );
        if (res.ok) {
          const payload = (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const out = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
          if (out) return out;
          continue;
        }
        const body = await res.text();
        if (isExhausted(res.status, body)) {
          rotate = true;
          break;
        }
        console.error("gemini pool error", pool, model, res.status);
      } catch (err) {
        console.error("gemini pool network error", pool, model, err);
      }
    }
    if (!rotate) continue;
  }
  return null;
}

/** Splits a data URL into a Gemini inline image part. */
export function imagePart(dataUrl: string): Part | null {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  return m ? { inline_data: { mime_type: m[1]!, data: m[2]! } } : null;
}
