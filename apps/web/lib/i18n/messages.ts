import en from "@/messages/en";
import zhCN from "@/messages/zh-CN";

export const SUPPORTED_LANGUAGES = ["en", "zh-CN"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const messages = {
  en,
  "zh-CN": zhCN
} as const;

export type TranslationDictionary = (typeof messages)["en"];
