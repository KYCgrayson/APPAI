import { cookies, headers } from "next/headers";

import { matchSupportedLocale, parseAcceptLanguage } from "@/lib/accept-language";
import { routing, type Locale } from "@/i18n/routing";

/** The cookie next-intl's middleware writes when a visitor picks a language. */
const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * The visitor's platform locale on a route that carries no locale prefix.
 *
 * `/app/{appId}` deliberately keeps a locale-free URL — one stable address per
 * app — and `middleware.ts` skips next-intl there, so `requestLocale` is empty
 * and `getTranslations()` would silently fall back to English. A locale-free
 * URL is a routing choice, not a reason to show everyone English: visitors
 * arrive from `/{locale}/apps`, where the middleware has already recorded their
 * language in the NEXT_LOCALE cookie. Fall back to Accept-Language for a direct
 * hit, then to the default locale.
 */
export async function getPlatformLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = matchSupportedLocale(cookieStore.get(LOCALE_COOKIE)?.value, routing.locales);
  if (fromCookie) return fromCookie;

  const headerStore = await headers();
  for (const tag of parseAcceptLanguage(headerStore.get("accept-language"))) {
    const match = matchSupportedLocale(tag, routing.locales);
    if (match) return match;
  }

  return routing.defaultLocale;
}
