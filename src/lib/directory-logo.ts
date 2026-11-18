import { extractLogoFromContent } from "./page-logo.ts";

/** Keep existing App logos verbatim; legacy pages may only have a header/hero logo. */
export function directoryLogo(logoUrl: string | null | undefined, page?: { content?: unknown; headerLogo?: unknown } | null) {
  return logoUrl || extractLogoFromContent(page?.content, page?.headerLogo);
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export function firstGrapheme(name: string): string {
  return graphemes.segment(name.trim())[Symbol.iterator]().next().value?.segment ?? "?";
}

/** Opaque hex only: alpha/CSS expressions cannot guarantee contrast on every surface. */
export function directoryTileColors(themeColor?: string | null) {
  const backgroundColor = /^#[\da-f]{6}$/i.test(themeColor ?? "") ? themeColor! : "#334155";
  const channels = [1, 3, 5].map(start => {
    const value = parseInt(backgroundColor.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  // Choosing the higher of black/white contrast guarantees >= 4.5:1 for any opaque sRGB colour.
  const color = (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
  return { backgroundColor, color };
}

/** Stable partition after assembling all cache batches, never just within a batch. */
export function logosFirst<T>(items: readonly T[], logo: (item: T) => string | null | undefined): T[] {
  const withLogo: T[] = [], withoutLogo: T[] = [];
  for (const item of items) (logo(item) ? withLogo : withoutLogo).push(item);
  return [...withLogo, ...withoutLogo];
}
