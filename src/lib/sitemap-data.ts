import { publicPageWhere, publicAppFilter, publicRootSelect } from "./hosted-page-visibility";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { buildSitemapEntries, splitSitemapEntries } from "./sitemap-entries";

// Never cache the full directory: a single Next data-cache entry is limited to 2 MB.
async function loadSitemapEntries() {
  try {
    const roots = await db.hostedPage.findMany({ where: publicPageWhere(), select: publicRootSelect, orderBy: [{ slug: "asc" }, { locale: "asc" }] });
    const [pages, apps] = await Promise.all([
      db.hostedPage.findMany({
        where: publicPageWhere(roots),
        select: { slug: true, parentSlug: true, organizationId: true, locale: true, isDefault: true,
          updatedAt: true, privacyPolicy: true, termsOfService: true, canonicalUrl: true },
        orderBy: [{ slug: "asc" }, { locale: "asc" }],
      }),
      db.app.findMany({ where: publicAppFilter(roots), select: { id: true, updatedAt: true, hostedPageSlug: true }, orderBy: { id: "asc" } }),
    ]);
    return buildSitemapEntries(pages, apps);
  } catch (error) {
    if (process.env.ALLOW_LOCAL_HTTP_BACKEND !== "1") throw error;
    return buildSitemapEntries([], []);
  }
}

const cacheOptions = { revalidate: 3600, tags: ["seo-sitemap"] };

export const loadSitemapIds = unstable_cache(async () => {
  return splitSitemapEntries(await loadSitemapEntries()).map((_, id) => ({ id }));
}, ["seo-sitemap-ids"], cacheOptions);

export const loadSitemapShard = unstable_cache(async (id: string) => {
  return splitSitemapEntries(await loadSitemapEntries())[Number(id)] || [];
}, ["seo-sitemap-shard"], cacheOptions);
