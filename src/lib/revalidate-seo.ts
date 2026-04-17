import { revalidatePath } from "next/cache";

// Paths that are regenerated from the HostedPage table. Whenever an agent
// creates, updates, publishes, unpublishes, or deletes a page, every one of
// these files becomes stale — revalidate them all so SEO/GEO surfaces reflect
// reality instantly rather than waiting on the 1-hour ISR fallback.
const SEO_PATHS = ["/sitemap.xml", "/llms.txt", "/llms-full.txt"];

export function revalidateSeoIndexes(slug?: string) {
  for (const path of SEO_PATHS) {
    try {
      revalidatePath(path);
    } catch {
      // Best-effort; never fail a write because a cache bust failed.
    }
  }
  if (slug) {
    try {
      revalidatePath(`/p/${slug}`, "layout");
    } catch {
      // swallow
    }
  }
}
