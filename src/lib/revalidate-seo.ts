import { revalidatePath, revalidateTag } from "next/cache";

// Paths that are regenerated from the HostedPage table. Whenever an agent
// creates, updates, publishes, unpublishes, or deletes a page, every one of
// these files becomes stale — revalidate them all so SEO/GEO surfaces reflect
// origin reads. The public directory shares this invalidation so removals
// disappear on the very next request, including cached App metadata.
// External llms caches can retain their one-hour max-age.
const SEO_PATHS = ["/sitemap.xml", "/llms.txt", "/llms-full.txt"];

export function revalidateSeoIndexes(slug?: string) {
  let refreshed = true;
  for (const tag of ["seo-sitemap", "public-directory"]) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch (error) {
      refreshed = false;
      console.error(`Failed to refresh ${tag} cache`, error);
    }
  }
  for (const path of SEO_PATHS) {
    try {
      revalidatePath(path);
    } catch (error) {
      refreshed = false;
      console.error(`Failed to refresh ${path}`, error);
    }
  }
  if (slug) {
    try {
      revalidatePath("/p/[...segments]", "layout");
    } catch (error) {
      refreshed = false;
      console.error("Failed to refresh hosted layout", error);
    }
  }
  return refreshed;
}
