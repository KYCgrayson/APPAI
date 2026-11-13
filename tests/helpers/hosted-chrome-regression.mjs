/** Remove only the approved #71 navigation deltas, preserving all other HTML. */
export function normalizeHostedNavigationChanges(html, url) {
  const nonRoot = /\/(?:f0-faq|privacy|terms)$/.test(url);
  html = html.replace(/<header\b[\s\S]*?<\/header>/, header => {
    const rootHref = header.match(/<a\b[^>]*href="([^"]+)"/)[1];
    // Round 3 restores current-page semantics and only tightens mobile spacing.
    header = header.replace(/ aria-current="page"/g, '')
      .replace('mx-auto px-2 md:px-6 py-3 flex items-center gap-0 md:gap-6', 'mx-auto px-6 py-3 flex items-center gap-6')
      .replace('flex items-center gap-1 md:gap-3 min-w-0', 'flex items-center gap-3 min-w-0')
      .replace('flex items-center gap-0 md:gap-4 ml-auto', 'flex items-center gap-4 ml-auto')
      .replace('w-11 h-11 md:w-10 md:h-10 md:-mr-2 rounded-md', 'w-10 h-10 -mr-2 rounded-md');
    // Unwrap the new branding + Home group, retaining the original name link.
    header = header.replace(/<div class="flex min-w-0 shrink items-center gap-0 md:gap-2 md:shrink-0 group-data-\[cramped=true\]\/chrome:!shrink">(<a\b[\s\S]*?<\/a>)<a\b[^>]*>[^<]*<\/a><\/div>/, '$1');
    header = header.replace(/<a\b[^>]*class="hidden md:inline-flex min-h-11[^>]*href="\/"[^>]*>[\s\S]*?<\/a>/, '');
    header = header.replace(/<li><a\b[^>]*href="\/"[^>]*>AppAI<\/a><\/li>/, '');
    header = header.replace(/<a\b[^>]*aria-label="[^"]*"[^>]*class="inline-flex h-11 w-11[^>]*>[\s\S]*?<\/a>/, '')
      .replace(/<div class="hidden min-\[400px\]:flex items-center">(<(?:a|div)\b[\s\S]*?<\/(?:a|div)>)<\/div>/, '$1');
    if (nonRoot) {
      // Main's old Home occupies a nav slot; the branch moves it beside the name.
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
