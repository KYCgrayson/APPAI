import { unstable_cache } from "next/cache";

// Leave room below Next's 2 MiB entry limit, including its JSON envelope.
export const HOSTED_PAGE_CACHE_MAX_BYTES = 1_800_000;
const MAX_AGE_SECONDS = 86400;
export const HOSTED_PAGE_CACHE_OPTIONS = { tags: ["hosted-page"], revalidate: MAX_AGE_SECONDS };

// Next stores the DTO JSON as a string inside its fetch entry: count that
// second escaping pass too (a quote-heavy DTO can otherwise double in size).
export function hostedEntryBytes(value: unknown) {
  return Buffer.byteLength(JSON.stringify({ kind: "FETCH", data: { headers: {},
    body: JSON.stringify(value), status: 200, url: "" }, revalidate: MAX_AGE_SECONDS, tags: ["hosted-page"] }), "utf8");
}

class OversizedHostedValue<T> extends Error {
  // Next logs rejected background revalidations. Never attach publisher content
  // as an enumerable Error property (or include it in the error message).
  #value: T;
  constructor(value: T) { super("Hosted page exceeds data-cache budget"); this.#value = value; }
  uncachedValue() { return this.#value; }
}

/** A single public DTO with its load time; no chunks or process-local registry. */
export function hostedDataCache<A extends unknown[], T>(
  family: string,
  read: (...args: A) => Promise<T>,
) {
  const readEntry = async (...args: A) => {
    const value = await read(...args);
    const entry = { value, loadedAt: Date.now() };
    const bytes = hostedEntryBytes(entry);
    if (bytes > HOSTED_PAGE_CACHE_MAX_BYTES) {
      // Arguments are public slugs/organisation IDs/locales, never viewer data.
      console.warn("[hosted-page] Uncached oversized DTO", { family, key: args, bytes });
      // A rejected callback is never written by unstable_cache.
      throw new OversizedHostedValue(value);
    }
    return entry;
  };
  const cached = unstable_cache(readEntry, [`hosted-page-${family}-v2`], HOSTED_PAGE_CACHE_OPTIONS);
  return async (...args: A): Promise<T> => {
    try {
      const entry = await cached(...args);
      // Next serves stale data while refreshing TTL-expired entries. If that
      // refresh now exceeds the size budget, Next catches the rejection and
      // retains the old entry. Enforce the one-day ceiling outside the cache so
      // even a missed invalidation cannot leave that old page visible forever.
      // This rare path can read alongside Next's background refresh; neither
      // the fallback nor its result is nested inside another persistent cache.
      return Date.now() - entry.loadedAt >= MAX_AGE_SECONDS * 1000
        ? (await readEntry(...args)).value : entry.value;
    } catch (error) {
      if (error instanceof OversizedHostedValue) return error.uncachedValue() as T;
      // DB errors must propagate, never become cached 404s or stale successes.
      throw error;
    }
  };
}
