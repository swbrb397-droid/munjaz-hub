import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

const dict = {
  ar: {
    home: "الرئيسية",
    store: "المتجر و NFT",
    leaderboard: "لوحة المتصدرين",
    createListing: "إنشاء عرض",
    dashboard: "لوحة التحكم",
    wallet: "المحفظة",
    workspace: "مساحة الطلب",
    admin: "الإدارة",
    brand: "مُنجَز",
    notifications: "التنبيهات",
    menu: "القائمة",
    verified: "موثّق",
    terms: "الشروط والأحكام",
    footer: "مُنجَز — سوق الخدمات الرقمية بعملة USDT.",
    footerSub: "TRC-20 · BEP-20 · Polygon",
  },
  en: {
    home: "Home",
    store: "Store & NFT",
    leaderboard: "Leaderboard",
    createListing: "Create listing",
    dashboard: "Dashboard",
    wallet: "Wallet",
    workspace: "Workspace",
    admin: "Admin",
    brand: "Al-Munjaz",
    notifications: "Notifications",
    menu: "Menu",
    verified: "Verified",
    terms: "Terms of Service",
    footer: "Al-Munjaz — the USDT-native digital services marketplace.",
    footerSub: "TRC-20 · BEP-20 · Polygon",
  },
} as const;

export type TranslationKey = keyof (typeof dict)["ar"];

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TranslationKey) => string;
  /** Inline bilingual helper: tr("عربي", "English") */
  tr: (ar: string, en: string) => string;
};

const LangContext = createContext<Ctx>({
  lang: "ar",
  setLang: () => {},
  t: (k) => dict.ar[k],
  tr: (ar) => ar,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("ar");

  useEffect(() => {
    const stored = window.localStorage.getItem("munjaz-lang");
    if (stored === "en" || stored === "ar") setLang(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem("munjaz-lang", lang);
  }, [lang]);

  return (
    <LangContext.Provider
      value={{ lang, setLang, t: (k) => dict[lang][k], tr: (ar, en) => (lang === "ar" ? ar : en) }}
    >
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
