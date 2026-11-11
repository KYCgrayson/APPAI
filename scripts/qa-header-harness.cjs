/* eslint-disable @typescript-eslint/no-require-imports -- Static QA runs as CommonJS. */
/* Static header QA (no server, auth, database, environment files or downloads).
 * PATH="$HOME/.local/node-v24.22.2-darwin-arm64/bin:$PATH" node scripts/qa-header-harness.cjs
 * Open /private/tmp/appai-header-qa/index.html in a browser; inspect at 375, 768,
 * and 1280px. Each page includes a real game trail and a long-name stress case.
 * Add --all-locales for all nine locales (default: zh-TW, en, hi, de).
 * Optional: QA_OUTPUT_DIR. Uses installed Tailwind/PostCSS to build globals.css,
 * and the SSR test loader for static locale/navigation fixtures; no hydration.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const postcss = require('postcss');
const tailwindcss = require('@tailwindcss/postcss');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.QA_OUTPUT_DIR || '/private/tmp/appai-header-qa');
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

(async () => {
  const { fixtureDb, registerHostedRenderLoader, registerDirectoryFixtures } = await import('../tests/helpers/hosted-render-loader.mjs');
  const loader = registerHostedRenderLoader();
  const intl = registerDirectoryFixtures();
  try {
    const { renderHtml } = await import('../tests/helpers/render-html.mjs');
    const { PlatformHeaderView } = await import('../src/components/PlatformHeaderView.tsx');
    const { getDirectoryCopy } = await import('../src/lib/directory-copy.ts');
    const { getGamesCopy } = await import('../src/lib/games-catalog.ts');
    const { getGamePageLabels } = await import('../src/lib/games-pages-copy.ts');
    const { gameBreadcrumbs } = await import('../src/lib/games-page-seo.ts');
    const { locales } = await import('../src/i18n/routing.ts');
    const selected = process.argv.includes('--all-locales') ? locales : ['zh-TW', 'en', 'hi', 'de'];
    await fs.mkdir(output, { recursive: true });
    const cssPath = path.join(root, 'src/app/globals.css');
    // Explicit sources keep the build confined to the UI source tree.
    const source = (await fs.readFile(cssPath, 'utf8')).replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../";');
    const css = await postcss([tailwindcss({ base: root, optimize: true })]).process(source, { from: cssPath, to: path.join(output, 'header.css') });
    await fs.writeFile(path.join(output, 'header.css'), css.css);
    await fs.copyFile(path.join(root, 'public/appai-logo2.png'), path.join(output, 'appai-logo2.png'));
    const document = (locale, title, body) => `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="header.css"><style>body{margin:0;background:#030712;color:#d1d5db}h1,h2,p{margin:16px}section{margin-bottom:32px}</style></head><body class="antialiased font-sans">${body}</body></html>`;
    const links = [];
    for (const locale of selected) {
      fixtureDb.locale = locale;
      const messages = JSON.parse(await fs.readFile(path.join(root, `src/messages/${locale}.json`), 'utf8'));
      const labels = { account: messages.common, categories: getDirectoryCopy(locale).categories, games: getGamesCopy(locale).nav, breadcrumb: getGamePageLabels(locale).breadcrumb };
      const breadcrumbs = gameBreadcrumbs(locale, 'water-pouring');
      for (const signedIn of [true, false]) {
        const state = signedIn ? 'signed-in' : 'signed-out';
        const title = `${locale} / ${state}`;
        const props = { labels, user: signedIn ? { name: 'Header QA Account '.repeat(12) } : null, isAdmin: signedIn };
        const longTrail = breadcrumbs.map((item, index) => index === breadcrumbs.length - 1 ? { ...item, name: `${item.name} `.repeat(30).trim() } : item);
        const samples = [];
        for (const [label, trail] of [['Game breadcrumb', breadcrumbs], ['Long current name', longTrail], ['Without breadcrumbs', undefined]]) {
          const html = await renderHtml(PlatformHeaderView({ ...props, breadcrumbs: trail }));
          samples.push(`<section><h2>${label}</h2>${html.replaceAll('"/appai-logo2.png"', '"appai-logo2.png"')}</section>`);
        }
        const filename = `${locale}-${state}.html`;
        await fs.writeFile(path.join(output, filename), document(locale, title, `<h1>${title}</h1>${samples.join('\n')}`));
        links.push(`<li><a href="${filename}">${title}</a></li>`);
      }
    }
    await fs.writeFile(path.join(output, 'index.html'), document('en', 'Platform header QA', `<h1>Platform header QA</h1><p>Open each fixture and set the viewport to 375, 768, and 1280px. Check the account name ellipsis, 44px mobile controls, breadcrumb item wrapping, long-name ellipsis, and horizontal overflow. Links and language changes are static SSR fixtures.</p><ul>${links.join('\n')}</ul>`));
    console.log(`Wrote ${links.length} static fixtures and built CSS: ${pathToFileURL(path.join(output, 'index.html'))}`);
  } finally {
    intl.deregister();
    loader.deregister();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
