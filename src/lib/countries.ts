/** ISO country codes with Arabic/English names for the seller-country badge. */
export const COUNTRIES: { code: string; ar: string; en: string }[] = [
  { code: "SA", ar: "السعودية", en: "Saudi Arabia" },
  { code: "AE", ar: "الإمارات", en: "UAE" },
  { code: "EG", ar: "مصر", en: "Egypt" },
  { code: "PS", ar: "فلسطين", en: "Palestine" },
  { code: "JO", ar: "الأردن", en: "Jordan" },
  { code: "KW", ar: "الكويت", en: "Kuwait" },
  { code: "QA", ar: "قطر", en: "Qatar" },
  { code: "BH", ar: "البحرين", en: "Bahrain" },
  { code: "OM", ar: "عُمان", en: "Oman" },
  { code: "IQ", ar: "العراق", en: "Iraq" },
  { code: "SY", ar: "سوريا", en: "Syria" },
  { code: "LB", ar: "لبنان", en: "Lebanon" },
  { code: "YE", ar: "اليمن", en: "Yemen" },
  { code: "MA", ar: "المغرب", en: "Morocco" },
  { code: "DZ", ar: "الجزائر", en: "Algeria" },
  { code: "TN", ar: "تونس", en: "Tunisia" },
  { code: "LY", ar: "ليبيا", en: "Libya" },
  { code: "SD", ar: "السودان", en: "Sudan" },
  { code: "MR", ar: "موريتانيا", en: "Mauritania" },
  { code: "TR", ar: "تركيا", en: "Turkey" },
  { code: "US", ar: "الولايات المتحدة", en: "United States" },
  { code: "GB", ar: "المملكة المتحدة", en: "United Kingdom" },
  { code: "DE", ar: "ألمانيا", en: "Germany" },
  { code: "FR", ar: "فرنسا", en: "France" },
  { code: "RU", ar: "روسيا", en: "Russia" },
  { code: "CN", ar: "الصين", en: "China" },
  { code: "IN", ar: "الهند", en: "India" },
  { code: "PK", ar: "باكستان", en: "Pakistan" },
];

export function flagEmoji(code: string): string {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "🌐";
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

export function countryName(code: string | null | undefined, ar: boolean): string | null {
  if (!code) return null;
  const c = COUNTRIES.find((x) => x.code === code.toUpperCase());
  return c ? (ar ? c.ar : c.en) : null;
}
