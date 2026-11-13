"use client";

import { hostedLinkFocus } from "@/lib/hosted-navigation-copy";

interface Props {
  href: string;
  locale: string;
  isActive: boolean;
  label: string;
}

export function LocaleLink({ href, locale, isActive, label }: Props) {
  const handleClick = () => {
    // Set cookie to remember the user's manual language choice (1 year expiry)
    document.cookie = `appai_locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  };

  return (
    <a
      href={href}
      aria-current={isActive ? "page" : undefined}
      onClick={handleClick}
      className={`inline-flex min-h-11 items-center px-2 rounded ${hostedLinkFocus} ${isActive ? "bg-gray-100 font-medium text-gray-900" : "text-gray-600 hover:text-gray-900"}`}
    >
      {label}
    </a>
  );
}
