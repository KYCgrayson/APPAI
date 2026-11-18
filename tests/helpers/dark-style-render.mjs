import { createElement } from 'react';
import { fixtureDb, registerHostedRenderLoader, registerHostedNavigationState, registerHostedHeaders } from './hosted-render-loader.mjs';
import { renderHtml } from './render-html.mjs';
import { page } from '../fixtures/pr5-pages.ts';

export async function darkStyleRenderer() {
  const loader = registerHostedRenderLoader();
  const headers = registerHostedHeaders();
  const state = { open: false, user: null };
  const navigation = registerHostedNavigationState(state);
  const { default: Layout } = await import('../../src/app/p/[...segments]/layout.tsx');
  const { default: HostedPage } = await import('../../src/app/p/[...segments]/page.tsx');
  const { PageRenderer } = await import('../../src/templates/shared/PageRenderer.tsx');
  return {
    /**
     * @param {any} kit
     * @param {{ mode?: boolean | string, child?: boolean, childMode?: boolean | string, policy?: string, open?: boolean, signedIn?: boolean, demo?: boolean, short?: boolean, childKit?: any, rootLogo?: string, headerLogo?: string, heroLogo?: string, heroImage?: string, childLocales?: boolean, actualRoute?: boolean }} options
     */
    async render(kit, { mode = kit.darkMode, child = false, childMode = mode, policy = "", open = false, signedIn = false, demo = false, short = false, childKit = kit, rootLogo, headerLogo, heroLogo, heroImage, childLocales = false, actualRoute = false } = {}) {
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
      if (short) root.content.sections = root.content.sections.slice(0, 1);
      if (rootLogo !== undefined) root.content.logo = rootLogo;
      if (headerLogo !== undefined) root.headerLogo = headerLogo;
      if (heroImage !== undefined) root.heroImage = heroImage;
      if (heroLogo !== undefined) root.content.sections.unshift({ type: 'hero', order: -1, data: { logo: heroLogo, headline: 'Fixture' } });
      const childContent = { ...root.content, sections: root.content.sections.map((section, index) => ({ ...section,
        data: { ...section.data, ...(section.data.backgroundColor ? { backgroundColor: childKit.backgroundColors[index % childKit.backgroundColors.length] } : {}) },
      })) };
      const childPage = { ...root, content: childContent, themeColor: childKit.themeColor, id: 'child', slug: 'fixture-contact', parentSlug: root.slug, title: 'Contact', darkMode: childMode === 'omitted' ? undefined : childMode };
      fixtureDb.rows = [root, { ...root, id: 'zh-root', locale: 'zh-TW', isDefault: false }, childPage];
      if (childLocales) fixtureDb.rows.push({ ...childPage, id: 'zh-child', locale: 'zh-TW', isDefault: false });
      const params = Promise.resolve({ segments: [root.slug, ...(policy ? [policy] : child ? [childPage.slug] : [])] });
      const body = policy || actualRoute ? await HostedPage({ params }) : createElement(PageRenderer, { page: child ? childPage : root });
      return renderHtml(await Layout({ params, children: body }));
    },
    close() { navigation.deregister(); headers.deregister(); loader.deregister(); },
  };
}
