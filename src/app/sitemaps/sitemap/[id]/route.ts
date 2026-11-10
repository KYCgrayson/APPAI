import { loadSitemapShard } from "@/lib/sitemap-data";
import { sitemapXml } from "@/lib/sitemap-entries";

// Resolve new shard IDs at request time, including IDs created after deployment.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = /^(0|[1-9]\d*)\.xml$/.exec(id);
  if (!match || !Number.isSafeInteger(Number(match[1]))) return new Response(null, { status: 404 });
  const entries = await loadSitemapShard(match[1]);
  return new Response(sitemapXml(entries), { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
