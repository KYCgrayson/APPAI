"use client";

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
      onClick={handleClick}
      className={`px-2 py-0.5 rounded ${isActive ? "bg-gray-100 font-medium text-gray-900" : "text-gray-500 hover:text-gray-900"}`}
    >
      {label}
    </a>
  );
}
