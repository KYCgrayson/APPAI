import { extractLogoFromContent, isLogoUrl } from "./page-logo.ts";
import { normalizeOpaqueHex, readableTextColor } from "./prose-theme.ts";

/** Keep valid App logos verbatim; legacy pages may only have a header/hero logo. */
export function directoryLogo(logoUrl: string | null | undefined, page?: { content?: unknown; headerLogo?: unknown } | null) {
  return isLogoUrl(logoUrl) ? logoUrl : extractLogoFromContent(page?.content, page?.headerLogo);
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export function firstGrapheme(name: string): string {
  let firstVisible: string | undefined;
  for (const { segment } of graphemes.segment(name)) {
    if (!/[^\p{White_Space}\p{C}\p{M}\p{Default_Ignorable_Code_Point}]/u.test(segment)) continue;
    firstVisible ??= segment;
    if (/[\p{L}\p{N}\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(segment)) return segment;
  }
  return firstVisible ?? "?";
}

/** Opaque hex only: alpha/CSS expressions cannot guarantee contrast on every surface. */
export function directoryTileColors(themeColor?: string | null) {
  const backgroundColor = normalizeOpaqueHex(themeColor) ?? "#334155";
  return { backgroundColor, color: readableTextColor(backgroundColor) };
}

/** Stable partition after assembling all cache batches, never just within a batch. */
export function logosFirst<T>(items: readonly T[], logo: (item: T) => string | null | undefined): T[] {
  const withLogo: T[] = [], withoutLogo: T[] = [];
  for (const item of items) (isLogoUrl(logo(item)) ? withLogo : withoutLogo).push(item);
  return [...withLogo, ...withoutLogo];
}
