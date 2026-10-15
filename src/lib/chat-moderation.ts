/**
 * Anti-bypass moderation for order chat (new messages AND edits).
 *
 * Users were bypassing the old regex guard by:
 *  - inserting spaces / dots / dashes inside phone numbers ("0 5 9 . 9 7 7"),
 *  - writing Eastern-Arabic numerals ("٠٥٩ ٩٧٧"),
 *  - posting Arabic profanity that the contact-only patterns never matched.
 *
 * The guard therefore normalises the text twice and checks both forms.
 */

const ARABIC_INDIC = /[\u0660-\u0669\u06F0-\u06F9]/g;

/** Returns the lowercase converted text plus a punctuation/space-stripped form. */
export function normalizeForModeration(raw: string): { converted: string; strippedDigits: string } {
  const converted = raw
    .replace(ARABIC_INDIC, (d) => {
      const code = d.charCodeAt(0);
      const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
      return String(code - base);
    })
    .replace(/[\u0640\u200c\u200d\u200e\u200f]/g, "")
    .toLowerCase();
  const strippedDigits = converted.replace(/[\s.\-_/\\,;:*#+()[\]'"«»]/g, "");
  return { converted, strippedDigits };
}

/** External platforms / contact channels that break escrow protection. */
const EXTERNAL_KEYWORDS = [
  "whatsapp",
  "whats app",
  "wa.me",
  "واتس",
  "واتساب",
  "telegram",
  "t.me",
  "تلجرام",
  "تليجرام",
  "تيليجرام",
  "discord",
  "دسكورد",
  "instagram",
  "انستغرام",
  "انستقرام",
  "snapchat",
  "سناب",
  "facebook",
  "فيسبوك",
  "فيس بوك",
  "skype",
  "سكايب",
  "imo",
  "viber",
  "فايبر",
  "signal app",
  "gmail",
  "hotmail",
  "outlook.com",
  "yahoo.com",
  "بريدي",
  "ايميلي",
  "إيميلي",
  "رقمي",
  "جوالي",
  "واتسي",
];

/** Arabic + English profanity / insults blocked inside a professional order room. */
const PROFANITY = [
  "عرص",
  "ياعرص",
  "منيك",
  "منيوك",
  "خول",
  "زبالة",
  "كلب",
  "حمار",
  "غبي",
  "تافه",
  "حقير",
  "قذر",
  "لعنة",
  "كسم",
  "كس ام",
  "طيز",
  "زب",
  "شرموط",
  "شرموطة",
  "قحبة",
  "نجس",
  "وسخ",
  "احمق",
  "أحمق",
  "معفن",
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "idiot",
  "moron",
];

const EMAIL_RE = /[\w.+-]+\s*(@|\[at\]|\(at\))\s*[\w-]+\s*\.\s*[a-z]{2,}/i;
/** Any contiguous run of 9+ digits after punctuation is stripped. */
const PHONE_RE = /\d{9,}/;
const URL_CONTACT_RE = /(wa\.me|t\.me|m\.me|telegram\.me|join\.skype)/i;

export type ModerationVerdict = { blocked: boolean; reason?: string };

export const CONTACT_BLOCK_MESSAGE =
  "⚠️ تم حظر الرسالة: يُمنع مشاركة وسائل التواصل أو الأرقام الخارجية وفقاً للمادة 5 من ميثاق المنصة.";
export const PROFANITY_BLOCK_MESSAGE =
  "⚠️ تم حظر الرسالة: تحتوي على ألفاظ مسيئة — يرجى الالتزام بلغة مهنية داخل غرفة الطلب.";

/** Whole-word match (with Arabic prefixes) so words like «زبون» never trip «زب». */
function hasWord(text: string, word: string): boolean {
  if (word.includes(" ")) return text.includes(word);
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])(يا|ال|وال|و|بال)?${esc}([^\\p{L}]|$)`, "u").test(text);
}

/** Single authoritative guard used by both message creation and message editing. */
export function moderateChatText(raw: string): ModerationVerdict {
  const text = String(raw ?? "");
  if (!text.trim()) return { blocked: false };
  const { converted, strippedDigits } = normalizeForModeration(text);

  if (PROFANITY.some((w) => hasWord(converted, w))) {
    return { blocked: true, reason: PROFANITY_BLOCK_MESSAGE };
  }
  if (EXTERNAL_KEYWORDS.some((w) => (/^[a-z ]+$/.test(w) ? hasWord(converted, w) : converted.includes(w)))) {
    return { blocked: true, reason: CONTACT_BLOCK_MESSAGE };
  }
  if (URL_CONTACT_RE.test(converted) || EMAIL_RE.test(converted) || EMAIL_RE.test(strippedDigits)) {
    return { blocked: true, reason: CONTACT_BLOCK_MESSAGE };
  }
  if (PHONE_RE.test(strippedDigits)) {
    return { blocked: true, reason: CONTACT_BLOCK_MESSAGE };
  }
  return { blocked: false };
}

/** Checks several user-written fields at once; returns the first block reason or null. */
export function moderateFields(...texts: (string | null | undefined)[]): string | null {
  for (const t of texts) {
    const v = moderateChatText(t ?? "");
    if (v.blocked) return v.reason ?? CONTACT_BLOCK_MESSAGE;
  }
  return null;
}

/** Messages may only be edited within this window (legal chat integrity). */
export const EDIT_WINDOW_MS = 5 * 60 * 1000;

export function isWithinEditWindow(createdAt: string | number | Date): boolean {
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && Date.now() - t <= EDIT_WINDOW_MS;
}

/** True when the text carries no characters that would need Arabic translation. */
export function isArabicOnly(raw: string): boolean {
  return !/[A-Za-z\u00C0-\u024F]/.test(String(raw ?? ""));
}
