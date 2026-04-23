"use client";

import { useState } from "react";
import { sanitizeUrl } from "@/lib/sanitize";
import type { NavItem } from "./PageRenderer";

interface Props {
  /** Slug of the root page (used to build child page URLs). */
  rootSlug: string;
  /** Locale segment to inject into nav links. Empty string when default locale. */
  localeSegment: string;
  /** Theme color used for hover/border highlights. */
  themeColor: string;
  /** Navigation items. */
  items: NavItem[];
  /** Dark mode flag. */
  darkMode?: boolean;
}

/**
 * Resolve a NavItem.target into a real href.
 *
 *   target = "https://..."     → external URL, opens in new tab
 *   target = "#anchor"         → in-page anchor, stays on current page
 *   target = "/p/..."          → absolute internal path (used by Home)
 *   target = "child-slug"      → child page on the same root site
 */
function resolveTarget(
  target: string,
  rootSlug: string,
  localeSegment: string,
): { href: string; external: boolean } {
  if (/^https?:\/\//i.test(target)) {
    return { href: sanitizeUrl(target), external: true };
  }
  if (target.startsWith("#") || target.startsWith("/")) {
    return { href: target, external: false };
  }
  // Treat as child slug. Build /p/{root}/{locale}/{child} or /p/{root}/{child}.
  const parts = ["/p", rootSlug];
  if (localeSegment) parts.push(localeSegment);
  parts.push(target);
  return { href: parts.join("/"), external: false };
}

/**
 * Secondary site navigation for multi-page sites. Deliberately does NOT render
 * logo or site title — that's owned by the layout's sticky header. This avoids
 * the "two rows of branding" duplication. Renders nothing when items is empty.
 */
export function SiteNav({
  rootSlug,
  localeSegment,
  themeColor,
  items,
  darkMode = false,
}: Props) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <nav
      className={`w-full border-b ${
        darkMode ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-white"
      }`}
      style={{ borderBottomColor: `${themeColor}1a` }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
        <ul className="hidden md:flex items-center gap-1">
          {items.map((item, i) => {
            const { href, external } = resolveTarget(item.target, rootSlug, localeSegment);
            return (
              <li key={i}>
                <a
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    darkMode
                      ? "text-gray-300 hover:text-white hover:bg-gray-800"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md ${
            darkMode ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-100"
          }`}
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
      </div>

      {open && (
        <ul className={`md:hidden border-t ${darkMode ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-white"}`}>
          {items.map((item, i) => {
            const { href, external } = resolveTarget(item.target, rootSlug, localeSegment);
            return (
              <li key={i}>
                <a
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  onClick={() => setOpen(false)}
                  className={`block px-6 py-4 text-base font-medium border-b last:border-b-0 ${
                    darkMode
                      ? "text-gray-200 hover:bg-gray-800 border-gray-700"
                      : "text-gray-800 hover:bg-gray-50 border-gray-100"
                  }`}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
