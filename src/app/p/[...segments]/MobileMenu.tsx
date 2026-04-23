"use client";

import { useState, useEffect } from "react";

interface MenuLink {
  label: string;
  href: string;
  external?: boolean;
}

interface LocaleOption {
  locale: string;
  href: string;
  label: string;
  isActive: boolean;
}

interface Props {
  /** Primary site nav items (Home, Contact, ...) */
  navItems: MenuLink[];
  /** Language variants for the switcher inside the drawer. */
  locales: LocaleOption[];
  /** Utility links shown under the nav (Privacy, Terms, external canonical) */
  utilityLinks: MenuLink[];
  /** Optional download CTA (App Store / Play Store) rendered prominently. */
  download?: { label: string; href: string };
  themeColor: string;
}

/**
 * Mobile-only hamburger + drawer. Below the md breakpoint the sticky header
 * collapses to [logo, title, hamburger] and every other header element
 * (nav items, language switcher, Privacy/Terms, Download) moves into this
 * drawer. Returns null on desktop (the trigger is hidden via md:hidden).
 */
export function MobileMenu({
  navItems,
  locales,
  utilityLinks,
  download,
  themeColor,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const nothingToShow =
    navItems.length === 0 &&
    utilityLinks.length === 0 &&
    locales.length <= 1 &&
    !download;
  if (nothingToShow) return null;

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-10 h-10 -mr-2 rounded-md text-gray-700 hover:bg-gray-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {open ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-[57px] z-40 bg-black/20"
          />
          <div
            className="fixed left-0 right-0 top-[57px] z-40 bg-white border-b shadow-lg max-h-[calc(100vh-57px)] overflow-y-auto"
            style={{ borderBottomColor: `${themeColor}1a` }}
          >
            {navItems.length > 0 && (
              <ul>
                {navItems.map((item, i) => (
                  <li key={i}>
                    <a
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      onClick={() => setOpen(false)}
                      className="block px-6 py-4 text-base font-medium border-b border-gray-100 text-gray-900 hover:bg-gray-50"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {locales.length > 1 && (
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Language
                </div>
                <div className="flex flex-wrap gap-2">
                  {locales.map((l) => (
                    <a
                      key={l.locale}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                        l.isActive
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {utilityLinks.length > 0 && (
              <ul className="py-2">
                {utilityLinks.map((item, i) => (
                  <li key={i}>
                    <a
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      onClick={() => setOpen(false)}
                      className="block px-6 py-3 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {download && (
              <div className="p-4 border-t border-gray-100">
                <a
                  href={download.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="block w-full text-center text-white px-4 py-3 rounded-full text-sm font-semibold"
                  style={{ backgroundColor: themeColor }}
                >
                  {download.label}
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
