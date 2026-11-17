import { createElement } from 'react';
import { fixtureDb, registerHostedRenderLoader, registerHostedNavigationState } from './hosted-render-loader.mjs';
import { renderHtml } from './render-html.mjs';
import { page } from '../fixtures/pr5-pages.ts';

export async function darkStyleRenderer() {
  const loader = registerHostedRenderLoader();
  const state = { open: false, user: null };
  const navigation = registerHostedNavigationState(state);
  const { default: Layout } = await import('../../src/app/p/[...segments]/layout.tsx');
  const { default: HostedPage } = await import('../../src/app/p/[...segments]/page.tsx');
  const { PageRenderer } = await import('../../src/templates/shared/PageRenderer.tsx');
  return {
    async render(kit, { mode = kit.darkMode, child = false, childMode = mode, policy = "", open = false, signedIn = false, demo = false } = {}) {
      state.open = open;
      state.user = signedIn ? { name: 'Fixture visitor' } : null;
      const root = page(demo ? 'demo-style' : 'style-fixture', {
        title: 'Style fixture', themeColor: kit.themeColor, darkMode: mode === 'omitted' ? undefined : mode,
        canonicalUrl: 'https://example.com', content: {
          logo: '/appai-logo2.png', renderVersion: 2, appStoreUrl: 'https://apps.apple.com/app/id1234567890',
          sections: [
            ...kit.backgroundColors.map((backgroundColor, order) => ({ type: 'about', order,
              data: { heading: 'About the project', text: 'Readable body text with **emphasis** and a [link](https://example.com).', backgroundColor } })),
            { type: 'cta', order: 2, data: { headline: 'Start your project', subheadline: '## Clear guidance\nRead **the details** and [learn more](https://example.com).', buttonText: 'Get started', buttonUrl: 'https://example.com' } },
          ],
        },
      });
      const childPage = { ...root, id: 'child', slug: 'fixture-contact', parentSlug: root.slug, title: 'Contact', darkMode: childMode === 'omitted' ? undefined : childMode };
      fixtureDb.rows = [root, { ...root, id: 'zh-root', locale: 'zh-TW', isDefault: false }, childPage];
      const params = Promise.resolve({ segments: [root.slug, ...(policy ? [policy] : child ? [childPage.slug] : [])] });
      const body = policy ? await HostedPage({ params }) : createElement(PageRenderer, { page: child ? childPage : root });
      return renderHtml(await Layout({ params, children: body }));
    },
    close() { navigation.deregister(); loader.deregister(); },
  };
}
