import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import ts from 'typescript';

/** Load main's actual source in a separate module namespace, using fixture DB/auth. */
export function registerMainHostedBaseline(ref = 'main', fixtureImports = []) {
  const root = new URL('../../', import.meta.url);
  // Virtual files stay under the repo so bare imports find the installed deps.
  const prefix = new URL(`.hosted-${ref}/`, root).href;
  const sources = new Map();
  const source = path => {
    if (!sources.has(path)) {
      try {
        sources.set(path, execFileSync('git', ['cat-file', 'blob', `${ref}:${path}`], {
          cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
        }));
      } catch { return undefined; }
    }
    return sources.get(path);
  };
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith(prefix)) return { url: specifier, shortCircuit: true };
      if (context.parentURL?.startsWith(prefix) && !['@/lib/db', '@/lib/auth', ...fixtureImports].includes(specifier)) {
        const path = specifier.startsWith('@/') ? `src/${specifier.slice(2)}`
          : specifier.startsWith('.') ? decodeURIComponent(new URL(specifier, context.parentURL).href.slice(prefix.length)) : null;
        if (path) for (const suffix of ['', '.ts', '.tsx']) {
          if (source(path + suffix) !== undefined) return { url: prefix + path + suffix, shortCircuit: true };
        }
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (!url.startsWith(prefix)) return next(url, context);
      const path = decodeURIComponent(url.slice(prefix.length));
      const input = source(path);
      if (input === undefined) throw new Error(`Missing main baseline: ${path}`);
      if (path.endsWith('.json')) return { format: 'json', source: input, shortCircuit: true };
      return { format: 'module', shortCircuit: true, source: ts.transpileModule(input, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      }).outputText };
    },
  });
  return { layoutUrl: prefix + 'src/app/p/[...segments]/layout.tsx', moduleUrl: path => prefix + path, deregister: () => hooks.deregister() };
}

/** Root diffs may remove AppAI and aria-current only; never rewrite classes. */
export function normalizeRootHeaderAdditions(header) {
  return header.replace(/ aria-current="page"/g, '')
    .replace(/<a\b[^>]*class="hidden md:inline-flex min-h-11[^>]*href="\/"[^>]*>[\s\S]*?<\/a>/, '')
    .replace(/<li><a\b[^>]*href="\/"[^>]*>AppAI<\/a><\/li>/, '');
}

/** Remove only the approved #71 navigation deltas, preserving all other HTML. */
export function normalizeHostedNavigationChanges(html, url) {
  html = normalizeHostedBreadcrumbChanges(html, url);
  const nonRoot = /\/(?:f0-faq|privacy|terms)$/.test(url);
  html = html.replace(/<header\b[\s\S]*?<\/header>/, header => {
    const rootHref = header.match(/<a\b[^>]*href="([^"]+)"/)[1];
    header = normalizeRootHeaderAdditions(header);
    // Compact spacing is approved only on non-root pages. Root spacing must
    // compare byte-for-byte with main, without a class-rewriting escape hatch.
    if (nonRoot) header = header
      .replace(' dir="ltr" data-cramped=', ' data-cramped=')
      .replace('mx-auto px-4 md:px-6 py-3 flex items-center gap-0 md:gap-6', 'mx-auto px-6 py-3 flex items-center gap-6')
      .replace('flex items-center gap-1 md:gap-3 min-w-0', 'flex items-center gap-3 min-w-0')
      .replace('flex items-center gap-1 md:gap-4 ml-auto', 'flex items-center gap-4 ml-auto')
      .replace('w-11 h-11 md:w-10 md:h-10 md:-mr-2 rounded-md', 'w-10 h-10 -mr-2 rounded-md');
    // Unwrap the Home icon + branding group, retaining the original name link.
    header = header.replace(/<div class="flex min-w-0 shrink items-center gap-[01] md:gap-2 md:shrink-0 group-data-\[cramped=true\]\/chrome:!shrink"><a\b[^>]*aria-label="[^"]*"[^>]*><svg\b[\s\S]*?<\/svg><\/a>(<a\b[\s\S]*?<\/a>)<\/div>/, '$1');
    header = header.replace(/<a\b[^>]*aria-label="[^"]*"[^>]*class="inline-flex h-11 w-11[^>]*>[\s\S]*?<\/a>/, '')
      .replace(/<div class="hidden min-\[400px\]:flex items-center">(<(?:a|div)\b[\s\S]*?<\/(?:a|div)>)<\/div>/, '$1');
    if (nonRoot) {
      // Main's old Home occupies a nav slot; the branch moves it before branding.
      const isHome = anchor => anchor.includes(`href="${rootHref}"`) && />(Home|首頁|首页)<\/a>$/.test(anchor);
      header = header.replace(/<li>(<a\b[^>]*>[\s\S]*?<\/a>)<\/li>/g, (item, anchor) => isHome(anchor) ? '' : item);
      header = header.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/g, nav => nav.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, anchor => isHome(anchor) ? '' : anchor));
      header = header.replace(/<nav\b[^>]*><\/nav>|<ul><\/ul>/g, '');
    }
    // Localized UI labels are an intended difference; keep their surrounding HTML.
    header = header.replace(/aria-label="(?:開啟選單|打开菜单)"/g, 'aria-label="Open menu"')
      .replace(/aria-label="(?:關閉選單|关闭菜单)"/g, 'aria-label="Close menu"')
      .replace(/>(?:語言|语言)<\/div>/g, '>Language</div>');
    return header;
  });
  return html.replace(/<footer\b[\s\S]*?<\/footer>/, footer => footer
    .replace('href="/apps"', 'href="/"')
    .replace(/<span aria-hidden="true" class="text-gray-300">\|<\/span><span>[^<]*<\/span>/, ''));
}

/** Undo only #91's non-root breadcrumb addition/replacement for archived hashes.
 * Root HTML is returned byte-for-byte; dedicated render tests check the new trail.
 */
export function normalizeHostedBreadcrumbChanges(html, url) {
  const trail = html.match(/<nav\b[^>]*data-breadcrumb="hosted"[^>]*>[\s\S]*?<\/nav>/)?.[0];
  if (!trail) return html;
  const names = [...trail.matchAll(/title="([^"]*)"/g)].map(match => match[1]);
  const href = trail.match(/<a\b[^>]*href="([^"]*)"/)?.[1];
  html = html.replace(trail, '');
  if (/\/(privacy|terms)$/.test(url)) {
    const legacy = `<nav class="flex items-center gap-2 text-sm text-gray-500 mb-6 md:mb-8 flex-wrap"><a href="${href}" class="hover:text-gray-900 truncate max-w-[60%]">${names[0]}</a><span class="text-gray-300">/</span><span class="text-gray-900">${names[1]}</span></nav>`;
    html = html.replace(/(<div class="max-w-3xl mx-auto py-10 md:py-16 px-4 sm:px-6">)/, `$1${legacy}`);
  }
  return html;
}
