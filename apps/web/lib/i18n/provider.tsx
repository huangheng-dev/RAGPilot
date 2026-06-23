"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { messages, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n/messages";

type I18nContextValue = {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveMessage(key: string, language: SupportedLanguage) {
  const segments = key.split(".");
  let currentValue: unknown = messages[language];

  for (const segment of segments) {
    if (typeof currentValue !== "object" || currentValue === null || !(segment in currentValue)) {
      return null;
    }

    currentValue = (currentValue as Record<string, unknown>)[segment];
  }

  return typeof currentValue === "string" ? currentValue : null;
}

function interpolate(template: string, params?: Record<string, string | number>) {
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce(
    (currentValue, [key, value]) => currentValue.replaceAll(`{${key}}`, String(value)),
    template
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<SupportedLanguage>("en");

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("ragpilot-language");
    if (storedLanguage && SUPPORTED_LANGUAGES.includes(storedLanguage as SupportedLanguage)) {
      setLanguage(storedLanguage as SupportedLanguage);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("ragpilot-language", language);
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, params) => {
        const resolvedMessage = resolveMessage(key, language) ?? resolveMessage(key, "en") ?? key;
        return interpolate(resolvedMessage, params);
      }
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider.");
  }

  return context;
}
