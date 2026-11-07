# AppAI — Style & logo
Check the logo, then choose a theme and text size.
Previous: [Authorization & API](https://appai.info/spec/api) · Next: [Theme](https://appai.info/spec/theme)
API base: `https://appai.info`; auth: `Authorization: Bearer appai_sk_YOUR_KEY`.

## How to choose

1. Check the [logo rules](https://appai.info/spec/style#logo) below; supply a logo before publishing.
2. Choose a light or dark kit in [Theme](https://appai.info/spec/theme); copy its colors, font and darkMode together; use the kit's suggested `backgroundColors` for section `data.backgroundColor` when provided; otherwise leave it unset. Exception: `cta` ignores `backgroundColor` and always uses `themeColor`.
3. Choose text size, contrast and role overrides in [Typography](https://appai.info/spec/typography); use the kit font for en/es, Noto Sans TC for zh-TW and Noto Sans SC for zh-CN.

### Logo


**“no logo” means you make one.** If the user has no logo, create a simple square 512×512 PNG following the Logo rules, upload it with `POST /api/v1/upload`, then publish. Agents MUST supply a logo. Non-blocking platform warnings are a fallback, not permission to skip it.

**Agents MUST provide a logo for every root page:** square PNG, 512×512 recommended, 1024×1024 accepted, app-icon style with its own background color. Set `content.logo` (or hero `data.logo` / `headerLogo`) to an HTTPS URL or same-origin `/path`. For local files, upload with `POST /api/v1/upload` and use the returned URL. Missing or non-HTTPS logos produce `warnings` on create/upsert, PUT, PATCH and dry-run. Child pages inherit the root header logo and need no separate logo. `heroImage` does not count for directory cards or the missing-logo warning; the header still falls back to it. Dry-run warns to replace the placeholder with the real logo and `https://color-bench-demo.pages.dev` with your deployed tool URL wherever that value appears.

Create a simple SVG with a solid background and initial/shape, then convert: `rsvg-convert -w 512 -h 512 logo.svg -o logo.png`; on macOS `qlmanage -t -s 512 -o . logo.svg` then `sips -s format png -z 512 512 logo.svg.png --out logo.png`; or ImageMagick. Upload the resulting PNG.

| Context | Uses | Fallback |
|---------|------|----------|
| Header / Favicon | `headerLogo` | primary logo |
| Hero section | hero `data.logo` | primary logo |
| App cards | `headerLogo` → `content.logo` → hero `data.logo` | -- |


All topics: [Overview](https://appai.info/spec) · [Authorization & API](https://appai.info/spec/api) · [Style & logo](https://appai.info/spec/style) · [Theme](https://appai.info/spec/theme) · [Typography](https://appai.info/spec/typography) · [Pages](https://appai.info/spec/pages) · [Sections](https://appai.info/spec/sections) · [Multi-language & multi-page](https://appai.info/spec/i18n) · [Tools](https://appai.info/spec/tools) · [Universal App](https://appai.info/spec/apps)
