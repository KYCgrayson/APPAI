import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import ts from 'typescript';
import { fixtureDb, registerHostedRenderLoader, registerHostedHeaders, registerHostedNavigationState } from './hosted-render-loader.mjs';
import { registerMainHostedBaseline } from './hosted-chrome-regression.mjs';
import { renderHtml } from './render-html.mjs';
import { page, app } from '../fixtures/pr5-pages.ts';

export async function visitorChromeFixture() {
  /** @type {{ open: boolean, user: null | { name?: string } }} */
  const state = { open: false, user: null };
  const hooks = [registerHostedRenderLoader(), registerHostedHeaders(), registerHostedNavigationState(state)];
  const baseline = registerMainHostedBaseline('a7c1925');
  const { default: Layout } = await import('../../src/app/p/[...segments]/layout.tsx');
  const { default: Page } = await import('../../src/app/p/[...segments]/page.tsx');
  const { default: BeforeLayout } = await import(baseline.layoutUrl);
  const { default: BeforePage } = await import(baseline.moduleUrl('src/app/p/[...segments]/page.tsx'));
  const { default: NotFound } = await import('../../src/app/not-found.tsx');
  const { default: BeforeNotFound } = await import(baseline.moduleUrl('src/app/not-found.tsx'));
  return {
    state,
    async render({ before = false, locale = 'zh-TW', suffix = '', explicitNav = false } = {}) {
      const root = page('visitor-fixture', { locale, title: '出版者的網站', tagline: '出版者副標題',
        canonicalUrl: 'https://example.com', privacyPolicy: '出版者的隱私內容', termsOfService: '出版者的條款內容',
        content: { appStoreUrl: 'https://apps.apple.com/app/id1234567890',
          ...(explicitNav ? { nav: [{ label: '登入是出版者寫的導覽', target: 'visitor-child' }] } : {}),
          sections: [{ type: 'about', data: { heading: '出版者標題', text: '登入、隱私、條款都是本文內容。' } }] } });
      fixtureDb.rows = [root, page('visitor-child', { ...root, slug: 'visitor-child', id: 'child', parentSlug: root.slug, title: '出版者子頁' })];
      fixtureDb.apps = [app('visitor-app', root.slug)];
      fixtureDb.hostedPath = `/p/${root.slug}${suffix ? '/' + suffix : ''}`;
      const params = Promise.resolve({ segments: [root.slug, ...(suffix ? [suffix] : [])] });
      const children = suffix === 'missing' ? await (before ? BeforeNotFound : NotFound)() : await (before ? BeforePage : Page)({ params });
      const tree = await (before ? BeforeLayout : Layout)({ params, children });
      const findMenu = node => {
        if (!node) return undefined;
        if (node?.type?.name === 'MobileMenu') return node.props;
        return (Array.isArray(node) ? node : [node?.props?.children]).flat().map(findMenu).find(Boolean);
      };
      return { html: await renderHtml(tree), menuProps: findMenu(tree) };
    },
    close() { baseline.deregister(); hooks.reverse().forEach(hook => hook.deregister()); },
  };
}

/** Bundle the real client component, React hydration and menu using installed
 * dependencies only. No package install, Next server, database or network. */
export function visitorChromeBrowserBundle(menuProps) {
  const modules = new Map();
  const load = path => {
    if (modules.has(path)) return path;
    modules.set(path, '');
    let source = readFileSync(path, 'utf8');
    if (['.ts', '.tsx'].includes(extname(path))) source = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const require = createRequire(path);
    source = source.replace(/require\(["']([^"']+)["']\)/g, (_, specifier) => {
      let target;
      if (specifier.startsWith('@/')) {
        const base = new URL('../../src/' + specifier.slice(2), import.meta.url).pathname;
        try { target = require.resolve(base + '.ts'); } catch { target = require.resolve(base + '.tsx'); }
      } else target = (specifier.startsWith('.') ? require : createRequire(import.meta.url)).resolve(specifier);
      return `require(${JSON.stringify(load(target))})`;
    });
    modules.set(path, source);
    return path;
  };
  const require = createRequire(import.meta.url);
  const react = load(require.resolve('react'));
  const dom = load(require.resolve('react-dom/client'));
  const visitor = load(new URL('../../src/app/p/[...segments]/VisitorChrome.tsx', import.meta.url).pathname);
  const menu = load(new URL('../../src/app/p/[...segments]/MobileMenu.tsx', import.meta.url).pathname);
  return `(() => {
    const process = { env: { NODE_ENV: 'development' } };
    const modules = {${[...modules].map(([path, code]) => `${JSON.stringify(path)}: (module, exports, require) => {${code}\n}`).join(',\n')}};
    const cache = {};
    const require = id => { if (!cache[id]) { const module = cache[id] = { exports: {} }; modules[id](module, module.exports, require); } return cache[id].exports; };
    const React = require(${JSON.stringify(react)}), dom = require(${JSON.stringify(dom)});
    const VisitorChrome = require(${JSON.stringify(visitor)}).VisitorChrome;
    const MobileMenu = require(${JSON.stringify(menu)}).MobileMenu;
    const container = document.querySelector('[data-chrome-aria-label="openMenu"]').parentElement;
    const effectHost = document.createElement('div'); document.body.append(effectHost);
    window.chromeErrors = [];
    dom.hydrateRoot(container, React.createElement(MobileMenu, ${JSON.stringify(menuProps)}), { onRecoverableError: error => window.chromeErrors.push(error.message) });
    window.visitorRoot = dom.createRoot(effectHost);
    window.mountVisitor = locale => window.visitorRoot.render(React.createElement(VisitorChrome, { locale }));
    window.mountVisitor(document.querySelector('[data-chrome-locale]').dataset.chromeLocale);
  })()`;
}
