"use client";

import { useState, useEffect, useId } from "react";
import { hostedNavigationCopy, hostedLinkFocus } from "@/lib/hosted-navigation-copy";
import { proseThemeVariables } from "@/lib/prose-theme";

interface MenuLink {
  label: string;
  href: string;
  external?: boolean;
  isCurrent?: boolean;
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
  labels?: ReturnType<typeof hostedNavigationCopy>;
}

/**
 * Mobile-only hamburger + drawer. Below the md breakpoint the sticky header
 * collapses to [logo, title, Home, hamburger] and other header elements
 * (nav items, language switcher, Privacy/Terms, Download) moves into this
 * drawer. Returns null on desktop (the trigger is hidden via md:hidden).
 */
export function MobileMenu({
  navItems,
  locales,
  utilityLinks,
  download,
  themeColor,
  labels = hostedNavigationCopy("en"),
}: Props) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const downloadColor = proseThemeVariables(themeColor)?.["--page-theme-link-light"] || "#000000";

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
        aria-label={open ? labels.closeMenu : labels.openMenu}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`relative z-50 inline-flex items-center justify-center w-11 h-11 rounded-md text-gray-700 hover:bg-gray-100 ${hostedLinkFocus}`}
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
            aria-label={labels.closeMenu}
            onClick={() => setOpen(false)}
            className={`absolute inset-x-0 top-full z-40 h-dvh bg-black/20 ${hostedLinkFocus}`}
          />
          <div
            id={menuId}
            className="absolute left-0 right-0 top-full z-50 bg-white text-gray-900 border-b shadow-lg max-h-[calc(100dvh-5rem)] overflow-y-auto"
            style={{ borderBottomColor: `${themeColor}1a` }}
          >
            {navItems.length > 0 && (
              <ul>
                {navItems.map((item, i) => (
                  <li key={i}>
                    <a
                      href={item.href}
                      aria-current={item.isCurrent ? "page" : undefined}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      onClick={() => setOpen(false)}
                      className={`block min-h-11 px-6 py-4 text-base font-medium border-b border-gray-100 text-gray-900 hover:bg-gray-50 ${hostedLinkFocus} focus-visible:ring-inset`}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {locales.length > 1 && (
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
                  {labels.language}
                </div>
                <div className="flex flex-wrap gap-2">
                  {locales.map((l) => (
                    <a
                      key={l.locale}
                      href={l.href}
                      aria-current={l.isActive ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={`inline-flex min-h-11 min-w-11 items-center justify-center px-3 rounded-full text-sm font-medium border ${hostedLinkFocus} ${
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
                      aria-current={item.isCurrent ? "page" : undefined}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      onClick={() => setOpen(false)}
                      className={`block min-h-11 px-6 py-3 text-sm text-gray-600 hover:bg-gray-50 ${hostedLinkFocus} focus-visible:ring-inset`}
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
                  className={`block min-h-11 w-full text-center text-white px-4 py-3 rounded-full text-sm font-semibold ${hostedLinkFocus}`}
                  style={{ backgroundColor: downloadColor }}
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
