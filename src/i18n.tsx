import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppLanguage = "en" | "zh-CN";

interface I18nValue {
  language: AppLanguage;
  locale: "en-US" | "zh-CN";
  setLanguage: (language: AppLanguage) => void;
  t: (english: string, chinese: string) => string;
}

const LANGUAGE_KEY = "patchmark-core.language.v1";

function initialLanguage(): AppLanguage {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  return saved === "zh-CN" ? "zh-CN" : "en";
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(initialLanguage);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nValue>(() => ({
    language,
    locale: language === "zh-CN" ? "zh-CN" : "en-US",
    setLanguage,
    t: (english, chinese) => language === "zh-CN" ? chinese : english,
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

