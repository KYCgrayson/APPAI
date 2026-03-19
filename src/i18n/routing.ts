import { defineRouting } from "next-intl/routing";

export const locales = ["en", "ja", "ko", "zh-CN", "zh-TW", "de", "fr", "es", "hi"] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  en: "English",
  ja: "日本語",
  ko: "한국어",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  hi: "हिन्दी",
};

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localePrefix: "as-needed",
});
