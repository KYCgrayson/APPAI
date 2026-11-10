import { loadSitemapIds } from "@/lib/sitemap-data";
import { PLATFORM_ORIGIN } from "@/lib/platform-identity";

export const dynamic = "force-dynamic";

export async function GET() {
  const shards = await loadSitemapIds();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${shards.map(({ id }) => `<sitemap><loc>${PLATFORM_ORIGIN}/sitemaps/sitemap/${id}.xml</loc></sitemap>`).join("")}</sitemapindex>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
