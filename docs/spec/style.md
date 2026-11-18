# AppAI — Style & logo
Check the logo, then choose a theme and text size.
Previous: [Authorization & API](https://appai.info/spec/api) · Next: [Theme](https://appai.info/spec/theme)
API base: `https://appai.info`; auth: `Authorization: Bearer appai_sk_YOUR_KEY`.

## How to choose

1. Check the [logo rules](https://appai.info/spec/style#logo) below; supply a logo before publishing.
2. Choose a light or dark kit in [Theme](https://appai.info/spec/theme); copy its colors, font and darkMode together; use the kit's suggested `backgroundColors` for section `data.backgroundColor` when provided; otherwise leave it unset. Exception: `cta` ignores `backgroundColor` and always uses `themeColor`.
3. Choose text size, contrast and role overrides in [Typography](https://appai.info/spec/typography); use the kit font for en/es, Noto Sans TC for zh-TW and Noto Sans SC for zh-CN.

### Heading colour

Set `content.headingColor` to `"dark"` for neutral headings; omit it or use `"theme"` to retain today's theme styling. Accepted by POST/upsert, PUT, PATCH and dry-run; stored in content JSON. Child pages inherit the root setting unless they set their own (`"theme"` opts out). Invalid values return a validation error at `content.headingColor`.

```json
{"themeColor":"#0369A1","darkMode":false,"content":{"headingColor":"dark","sections":[{"type":"hero","data":{"headline":"Ocean studio"}},{"type":"about","data":{"heading":"Our work","text":"Built with care."}}]}}
```

This affects rendered H1–H6 headings, including Markdown, while links, buttons and accents retain their theme colours. Normal light/dark surfaces use near-black/light text respectively. Explicit `#rgb`/`#rrggbb` backgrounds and theme-filled CTA/download sections select neutral black/white for AA contrast; centered hero media keeps white headings over its dark overlay. Unparsed explicit colours (such as names, `rgb(...)` or alpha hex) retain that section’s theme heading behaviour instead of forcing neutral headings. Custom CSS and externally embedded documents are outside this setting.

### Logo

Pages without a logo show a generated letter tile and are listed after pages with a logo (within each homepage section; featured stays first).


**“no logo” means you make one.** If the user has no logo, create a simple square 512×512 PNG following the Logo rules, upload it with `POST /api/v1/upload`, then publish. Agents MUST supply a logo. Non-blocking platform warnings are a fallback, not permission to skip it.

**Agents MUST provide a logo for every root page:** square PNG, 512×512 recommended, 1024×1024 accepted, app-icon style with its own background color. Set `content.logo` (or hero `data.logo` / `headerLogo`) to an HTTPS URL or same-origin `/path`. For local files, upload with `POST /api/v1/upload` and use the returned URL. Missing or non-HTTPS logos produce `warnings` on create/upsert, PUT, PATCH and dry-run. Child pages inherit the root header logo and need no separate logo. Their favicon uses their own valid logo when supplied, otherwise the root header logo (including its dark-mode preference); a child `heroImage` photo does not replace it. OG/Twitter images remain independent. `heroImage` does not count for directory cards or the missing-logo warning; the header still falls back to it. Dry-run warns to replace the placeholder with the real logo and `https://color-bench-demo.pages.dev` with your deployed tool URL wherever that value appears.

Header/footer follow the displayed page: children use their own `darkMode`; privacy/terms documents use light chrome. Dark chrome and empty page space use the first dark section background (with a safe dark fallback); drawer surfaces use the next distinct dark background. A separate dark-coloured `headerLogo` for light headers will not override an existing primary logo on dark chrome.

Create a simple SVG with a solid background and initial/shape, then convert: `rsvg-convert -w 512 -h 512 logo.svg -o logo.png`; on macOS `qlmanage -t -s 512 -o . logo.svg` then `sips -s format png -z 512 512 logo.svg.png --out logo.png`; or ImageMagick. Upload the resulting PNG.

| Context | Uses | Fallback |
|---------|------|----------|
| Light header / Favicon | `headerLogo` | `content.logo` → hero `data.logo` → `heroImage` |
| Dark header | root `content.logo` → hero `data.logo` | `headerLogo` → `heroImage` |
| Hero section | hero `data.logo` | primary logo |
| Directory cards / App detail / admin App list | Existing App `logoUrl` → `headerLogo` → `content.logo` → hero `data.logo` | First grapheme on `themeColor` (invalid/missing: slate `#334155`), with AA-contrast black/white text on directory cards; App detail/admin retain their existing missing-logo placeholder; never `heroImage` |


All topics: [Overview](https://appai.info/spec) · [Authorization & API](https://appai.info/spec/api) · [Style & logo](https://appai.info/spec/style) · [Theme](https://appai.info/spec/theme) · [Typography](https://appai.info/spec/typography) · [Pages](https://appai.info/spec/pages) · [Sections](https://appai.info/spec/sections) · [Multi-language & multi-page](https://appai.info/spec/i18n) · [Tools](https://appai.info/spec/tools) · [Universal App](https://appai.info/spec/apps) · [Games](https://appai.info/spec/games)
