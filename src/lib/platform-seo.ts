import type { Metadata } from "next";
import { locales } from "../i18n/routing.ts";
import { PLATFORM_ORIGIN } from "./platform-identity.ts";

export const DEFAULT_SHARE_IMAGE = `${PLATFORM_ORIGIN}/appai.png`;

const OPEN_GRAPH_LOCALES: Record<string, string> = {
  en: "en_US", ja: "ja_JP", ko: "ko_KR", "zh-CN": "zh_CN", "zh-TW": "zh_TW",
  de: "de_DE", fr: "fr_FR", es: "es_ES", hi: "hi_IN",
};

export function platformOpenGraphLocale(locale: string): string {
  return OPEN_GRAPH_LOCALES[locale] ?? locale.replace(/-/g, "_");
}

export function platformUrl(path: string, locale: string, origin = PLATFORM_ORIGIN): string {
  const pathname = path.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "");
  const prefix = locale === "en" ? "" : `/${locale}`;
  return `${origin.replace(/\/$/, "")}${prefix}${pathname ? `/${pathname}` : prefix ? "" : "/"}`;
}

export function platformAlternates(path: string, origin = PLATFORM_ORIGIN) {
  return Object.fromEntries([
    ...locales.map(locale => [locale, platformUrl(path, locale, origin)]),
    ["x-default", platformUrl(path, "en", origin)],
  ]);
}

export function buildPlatformMetadata(
  locale: string,
  path: string,
  copy: { title: string; description: string },
): Metadata {
  const url = platformUrl(path, locale);
  return {
    ...copy,
    alternates: { canonical: url, languages: platformAlternates(path) },
    openGraph: {
      ...copy, url, type: "website", siteName: "AppAI",
      locale: platformOpenGraphLocale(locale),
      alternateLocale: locales.filter(value => value !== locale).map(platformOpenGraphLocale),
      images: [{ url: DEFAULT_SHARE_IMAGE, width: 1024, height: 1024, alt: "AppAI" }],
    },
    twitter: { ...copy, card: "summary_large_image", images: [DEFAULT_SHARE_IMAGE] },
  };
}
