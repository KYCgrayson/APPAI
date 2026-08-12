/**
 * Accept-Language parsing, kept free of next/* imports so it stays directly
 * unit-testable under the node --experimental-strip-types test runner.
 */

/** Parses an Accept-Language header into locales ordered by descending q-value. */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const quality = q ? Number.parseFloat(q.trim().slice(2)) : 1;
      return { tag: tag.trim(), quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((entry) => entry.tag && entry.tag !== "*" && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality)
    .map((entry) => entry.tag);
}

/**
 * Best supported match for a requested tag, in three tiers:
 *
 * 1. exact — "zh-TW" → "zh-TW"
 * 2. the bare language — "de-AT" → "de"
 * 3. any region of that language — "zh-HK" → the first shipped "zh-*"
 *
 * Tier 3 matters because the platform ships regional locales without a bare
 * one: "zh-HK" shares no exact or bare match with {zh-CN, zh-TW}, and without
 * it a Hong Kong visitor would be served English rather than Chinese. The
 * region picked is the first in `supported`, so callers control the preference
 * by ordering that list.
 */
export function matchSupportedLocale<T extends string>(
  value: string | undefined | null,
  supported: readonly T[],
): T | null {
  if (!value) return null;
  const wanted = value.toLowerCase();
  const exact = supported.find((l) => l.toLowerCase() === wanted);
  if (exact) return exact;

  const primary = wanted.split("-")[0];
  const bare = supported.find((l) => l.toLowerCase() === primary);
  if (bare) return bare;

  return supported.find((l) => l.toLowerCase().split("-")[0] === primary) ?? null;
}

/**
 * First supported locale matching an ordered preference list, e.g. the output
 * of `parseAcceptLanguage`. Each preference is tried through all three tiers
 * before moving on, so a visitor's first choice wins over a closer match to
 * their second.
 */
export function matchPreferredLocale<T extends string>(
  preferred: readonly string[],
  supported: readonly T[],
): T | null {
  for (const pref of preferred) {
    const match = matchSupportedLocale(pref, supported);
    if (match) return match;
  }
  return null;
}
