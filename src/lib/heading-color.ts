import { isRecord } from "./hosted-content.ts";
import { normalizeOpaqueHex, readableTextColor } from "./prose-theme.ts";

/** Inherit only this presentation setting, never copy root sections/SEO into children. */
export function inheritHeadingColor(content: unknown, rootContent: unknown): unknown {
  if (!isRecord(rootContent) || (rootContent.headingColor !== "theme" && rootContent.headingColor !== "dark")) return content;
  if (isRecord(content) && content.headingColor !== undefined) return content;
  return { ...(isRecord(content) ? content : {}), headingColor: rootContent.headingColor };
}

// Built-in sections/cards may paint a different surface from their wrapper.
// Reset at that surface, so nested headings inherit its contrast-safe neutral.
export const neutralHeadingCss = [
  '[data-heading-color="dark"] :is(.bg-white,.bg-gray-50,.bg-gray-100,.bg-gray-200,.bg-amber-50,.bg-green-50,.bg-red-50){--page-heading-neutral:#111827}',
  '[data-heading-color="dark"] :is(.bg-black,.bg-gray-700,.bg-gray-800,.bg-gray-900,.bg-gray-950){--page-heading-neutral:#f9fafb}',
  '[data-heading-color="dark"] :is(h1,h2,h3,h4,h5,h6):not([data-heading-color="theme"] *){color:var(--page-heading-neutral)!important}',
].join("");

/** Neutral on normal surfaces; black/white on explicit colour surfaces keeps AA. */
export function sectionHeadingColor(type: string, data: Record<string, unknown>, dark: boolean, theme: string) {
  if (type === "hero" && (!data.variant || data.variant === "centered") && (data.backgroundImage || data.backgroundVideo)) return "#ffffff";
  const background = type === "cta" || type === "download" ? theme : data.backgroundColor;
  const hex = normalizeOpaqueHex(background);
  if (hex) return readableTextColor(hex);
  // Unknown explicit surfaces must retain the section's original theme styling.
  if (background) return undefined;
  return dark ? "#f9fafb" : "#111827";
}
