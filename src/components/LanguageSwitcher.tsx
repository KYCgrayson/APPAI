"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, localeCookie, localeNames, routing, type Locale } from "@/i18n/routing";

export function LanguageSwitcher({ compact = false, rememberLocale = false }: {
  compact?: boolean;
  rememberLocale?: boolean;
}) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!rememberLocale || locale === routing.defaultLocale) return;
    const { name, sameSite } = localeCookie;
    if (document.cookie.split(";").some(cookie => cookie.trimStart().startsWith(`${name}=`))) return;
    // First visits to prefixed ISR pages omit Set-Cookie. Keep their locale
    // for subsequent links to locale-free routes such as the app launcher.
    document.cookie = `${name}=${locale}; Path=/; SameSite=${sameSite}`;
  }, [locale, rememberLocale]);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newLocale = e.target.value as Locale;
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <select
      value={locale}
      onChange={onChange}
      className={`text-sm bg-transparent border border-gray-700 rounded-md px-2 py-1 text-gray-400 hover:border-gray-500 hover:text-gray-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-gray-600 transition-colors ${compact ? "min-h-11 w-24 shrink-0 sm:w-auto" : ""}`}
      aria-label="Select language"
    >
      {locales.map((l) => (
        <option key={l} value={l}>
          {localeNames[l]}
        </option>
      ))}
    </select>
  );
}
