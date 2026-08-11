/**
 * Resolving content across AppAI's two locale sets.
 *
 * The platform UI ships 9 locales (`src/i18n/routing.ts`) because we translate
 * it ourselves. Hosted pages accept any BCP 47 `xx` / `xx-XX` code, because the
 * publishing agent decides which languages an app is offered in. The two sets
 * are intentionally different sizes, so anything that reads publisher content
 * for a platform visitor has to bridge the gap rather than assume a hit.
 */

/** A row carrying publisher content for one locale (e.g. a `HostedPage`). */
export type LocalizedRow = { locale: string; isDefault?: boolean };

function primarySubtag(locale: string) {
  return locale.toLowerCase().split("-")[0] ?? "";
}

/**
 * Picks the row that best serves `target`, preferring in order:
 *
 * 1. exact match — `zh-TW` → `zh-TW`
 * 2. the bare language — `zh-TW` → `zh`
 * 3. another region of the same language — `zh-TW` → `zh-CN`
 * 4. the publisher's default row
 * 5. whatever exists, so a caller with rows never gets nothing
 *
 * Tiers 2 and 3 are separate on purpose: a Traditional Chinese visitor is
 * better served by generic `zh` than by Simplified `zh-CN`, and the same holds
 * for `pt` vs `pt-BR`. Returns `undefined` only when `rows` is empty, which is
 * the normal case for an app that never published a hosted page.
 */
export function pickByLocale<T extends LocalizedRow>(rows: readonly T[], target: string): T | undefined {
  if (rows.length === 0) return undefined;

  const wanted = target.toLowerCase();
  const wantedPrimary = primarySubtag(target);

  let barePrimary: T | undefined;
  let otherRegion: T | undefined;
  let fallbackDefault: T | undefined;

  for (const row of rows) {
    const rowLocale = row.locale.toLowerCase();
    if (rowLocale === wanted) return row;

    if (primarySubtag(row.locale) === wantedPrimary) {
      if (rowLocale === wantedPrimary) barePrimary ??= row;
      else otherRegion ??= row;
    }

    if (row.isDefault) fallbackDefault ??= row;
  }

  return barePrimary ?? otherRegion ?? fallbackDefault ?? rows[0];
}

/** Groups localized rows by a key so callers can `pickByLocale` per group. */
export function groupByKey<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = grouped.get(k);
    if (bucket) bucket.push(row);
    else grouped.set(k, [row]);
  }
  return grouped;
}
