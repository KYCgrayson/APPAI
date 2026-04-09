"use client";

import { useState } from "react";
import { sanitizeUrl } from "@/lib/sanitize";
import type { NavItem } from "./PageRenderer";

interface Props {
  /** Slug of the root page (used to build child page URLs). */
  rootSlug: string;
  /** Locale segment to inject into nav links. Empty string when default locale. */
  localeSegment: string;
  /** Page title shown as the brand label on the left. */
  brand: string;
  /** Optional logo URL shown next to the brand. */
  logo?: string | null;
  /** Theme color used for hover/border highlights. */
  themeColor: string;
  /** Navigation items. */
  items: NavItem[];
}

/**
 * Resolve a NavItem.target into a real href.
 *
 *   target = "https://..."     → external URL, opens in new tab
 *   target = "#anchor"         → in-page anchor, stays on current page
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
  if (target.startsWith("#")) {
    return { href: target, external: false };
  }
  // Treat as child slug. Build /p/{root}/{locale}/{child} or /p/{root}/{child}.
  const parts = ["/p", rootSlug];
  if (localeSegment) parts.push(localeSegment);
  parts.push(target);
  return { href: parts.join("/"), external: false };
}

export function SiteNav({
  rootSlug,
  localeSegment,
  brand,
  logo,
  themeColor,
  items,
}: Props) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  const homeHref = localeSegment ? `/p/${rootSlug}/${localeSegment}` : `/p/${rootSlug}`;

  return (
    <nav
      className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70"
      style={{ borderBottomColor: `${themeColor}1a` }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <a href={homeHref} className="flex items-center gap-2 min-w-0">
          {logo && (
            <img
              src={sanitizeUrl(logo)}
              alt=""
              className="w-7 h-7 rounded-md object-cover"
            />
          )}
          <span className="font-semibold text-gray-900 truncate" style={{ maxWidth: "12rem" }}>
            {brand}
          </span>
        </a>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-1">
          {items.map((item, i) => {
            const { href, external } = resolveTarget(item.target, rootSlug, localeSegment);
            return (
              <li key={i}>
                <a
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md text-gray-700 hover:bg-gray-100"
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

      {/* Mobile dropdown */}
      {open && (
        <ul className="md:hidden border-t border-gray-200 bg-white">
          {items.map((item, i) => {
            const { href, external } = resolveTarget(item.target, rootSlug, localeSegment);
            return (
              <li key={i}>
                <a
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  onClick={() => setOpen(false)}
                  className="block px-6 py-4 text-base font-medium text-gray-800 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
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
