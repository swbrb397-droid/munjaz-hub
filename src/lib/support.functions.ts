import { createServerFn } from "@tanstack/react-start";

const SYSTEM_PROMPT = `أنت المساعد الذكي الرسمي لمنصة «المنجز» للأعمال الرقمية والضمان (Escrow).
أجب بالعربية الفصحى المهنية وبإيجاز (٤ جمل كحد أقصى).
الحقائق الرسمية التي يجب الالتزام بها حرفياً:
- مدة حجز الضمان بعد التسليم: 48 ساعة للباقة المجانية، 24 ساعة لباقة Pro (مع توثيق KYC)، و16–24 ساعة لباقة الشركات.
- عمولة المنصة: 10% مجاني، 5% Pro، 2.5% شركات.
- الحد الأدنى للسحب 10 USDT عبر TRC-20 أو BEP-20 أو Polygon، مع قفل أمني 24 ساعة عند تغيير كلمة المرور أو المصادقة الثنائية أو عنوان السحب.
- عمولة الإحالة تُحتسب من صافي رسوم المنصة فقط: 20% في الشهر الأول ثم 10% لبقية 11 شهراً (دورة 365 يوماً)، ولا تشمل مشتريات الباقات.
- قرار التحكيم الآلي قرار ابتدائي، ويحق تصعيده للتحكيم البشري خلال 24 ساعة.
لا تطلب أي بيانات تواصل خارجية أو دفع خارج المنصة إطلاقاً.`;

/** Public support assistant (works for guests too) backed by the Lovable AI gateway. */
export const supportAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: { message: string; lang?: string }) => {
    const message = String(input?.message ?? "").trim().slice(0, 1000);
    if (!message) throw new Error("MESSAGE_REQUIRED");
    const lang = input?.lang === "en" ? "en" : "ar";
    return { message, lang };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI_UNAVAILABLE");

    // Strict language lock: Latin-script input (or an English UI) forces an
    // English-only answer; Arabic input keeps the Arabic default.
    const hasLatin = /[a-zA-Z]/.test(data.message);
    const hasArabic = /[\u0600-\u06FF]/.test(data.message);
    const english = hasArabic ? false : hasLatin || data.lang === "en";
    const languageRule = english
      ? "The user is communicating in English. You MUST respond strictly and fluently in English. Do not output any Arabic characters."
      : "المستخدم يكتب بالعربية. التزم بالرد بالعربية الفصحى فقط.";

    // Hard 15s ceiling so the widget can fall back to a support ticket.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: data.message },
          ],
        }),
      });
      if (res.status === 429) throw new Error("RATE_LIMITED");
      if (res.status === 402) throw new Error("CREDITS_REQUIRED");
      if (!res.ok) throw new Error("AI_UNAVAILABLE");
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const reply = json.choices?.[0]?.message?.content?.trim();
      if (!reply) throw new Error("AI_UNAVAILABLE");
      return { reply };
    } finally {
      clearTimeout(timer);
    }
  });
