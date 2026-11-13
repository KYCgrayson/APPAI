"use client";

import { useEffect, useRef } from "react";

/**
 * Content-aware header that decides "show desktop inline layout vs. show
 * hamburger" by actually measuring whether the desktop layout fits, not by
 * trusting a CSS breakpoint. Handles:
 *   - any number of nav items
 *   - any title length
 *   - any viewport width (small phone, big desktop, unusual window sizes)
 *
 * The Tailwind md: classes on descendants remain the pre-JS default (so SSR
 * and no-JS clients still get a sensible layout). After hydration, this
 * component takes over: it sets data-cramped on the wrapper, and descendants
 * override their md: rules via group-data-[cramped=true]/chrome: variants.
 *
 * Measurement strategy: before each check, force the wrapper into its
 * "desktop" visual state (data-cramped=false), synchronously read scrollWidth
 * vs clientWidth, then commit the right state. Measuring in a known state
 * eliminates the oscillation bug you'd get from measuring cramped markup
 * (fewer children) then declaring it fits (of course it does — everything
 * moved into the drawer).
 */
export function AdaptiveChrome({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let rafId = 0;

    const check = () => {
      // Cancel any pending check — batch resize bursts.
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        // Force desktop state to get an honest "does this fit?" measurement.
        const prev = el.dataset.cramped;
        el.dataset.cramped = "false";
        // Read triggers layout; write to dataset then read is fine because
        // CSS switches synchronously via the data-attribute variant.
        const overflows = el.scrollWidth > el.clientWidth + 2;
        const next = overflows ? "true" : "false";
        if (next !== prev) {
          el.dataset.cramped = next;
        }
      });
    };

    check();

    const ro = new ResizeObserver(check);
    ro.observe(el);

    // Web fonts can change widths after first paint.
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(check).catch(() => {});
    }

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      // Initial value matches the CSS-only (pre-hydration) desktop default so
      // there's no flash on mount. If it actually doesn't fit, the effect
      // flips it to true on the next frame.
      data-cramped="false"
      className="group/chrome w-full max-w-6xl mx-auto px-6 py-3 flex items-center gap-6 overflow-hidden"
    >
      {children}
    </div>
  );
}
