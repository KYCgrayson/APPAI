import { createHash } from 'node:crypto';
import { renderHtml } from './render-html.mjs';
import { fixtureDb, fixtureSitemapCache } from './hosted-render-loader.mjs';
import { f0Pages, f0Apps, f0Urls } from '../fixtures/pr5-pages.ts';
const hash = text => createHash('sha256').update(text).digest('hex');
export async function captureF0() {
  fixtureDb.rows = structuredClone(f0Pages);
  fixtureDb.apps = structuredClone(f0Apps);
  fixtureDb.locale = 'en';
  fixtureSitemapCache.entries.clear();
  const hosted = await import('../../src/app/p/[...segments]/page.tsx');
  const { default: layout } = await import('../../src/app/p/[...segments]/layout.tsx');
  const { loadSitemapIds, loadSitemapShard } = await import('../../src/lib/sitemap-data.ts');
  const { sitemapXml } = await import('../../src/lib/sitemap-entries.ts');
  const { GET: llms } = await import('../../src/app/llms.txt/route.ts');
  const html = {};
  for (const url of f0Urls) {
    const props = { params: Promise.resolve({ segments: url.replace(/^\/p\//, '').split('/') }) };
    html[url] = hash(await renderHtml(await layout({ ...props, children: await hosted.default(props) })));
  }
  const shards = await Promise.all((await loadSitemapIds()).map(async ({ id }) => hash(sitemapXml(await loadSitemapShard(String(id))))));
  return { html, sitemapShards: shards, llms: hash(await (await llms()).text()) };
}
