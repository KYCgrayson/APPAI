# AppAI — Style & logo
Check the logo, then choose a theme and text size.
Previous: [Authorization & API](https://appai.info/spec/api) · Next: [Theme](https://appai.info/spec/theme)
API base: `https://appai.info`; auth: `Authorization: Bearer appai_sk_YOUR_KEY`.

1. [Pick a theme](https://appai.info/spec/theme): colors, backgrounds and ready-made style kits.
2. [Pick text size](https://appai.info/spec/typography): font, overall size, contrast and optional role overrides.

Copy `themeColor`, `themeColorSecondary`, `fontFamily` (Chinese variants: `Noto Sans TC`/`Noto Sans SC`) and `darkMode` together from a style kit; use the style kit's suggested backgroundColors. Use the kit’s `fontFamily` for `en` and `es`, `Noto Sans TC` for `zh-TW`, and `Noto Sans SC` for `zh-CN`; for other CJK languages chosen by the user, choose the matching font (e.g. `Noto Sans JP` for Japanese). Keep `themeColor`, `themeColorSecondary`, `darkMode` and the kit’s suggested backgroundColors the same across variants.

### Visual Design Capabilities

Moved to [Theme](https://appai.info/spec/theme#visual-design-capabilities).

## Hero variants

Moved to [Theme](https://appai.info/spec/theme#hero-variants).

### Logo


If the user has no logo, create a simple square 512×512 PNG following the Logo rules, upload it with `POST /api/v1/upload`, then publish. A missing logo only warns and never blocks publishing.

**Every root page should provide a logo (strong recommendation; publishing is never blocked):** square 512x512 PNG, app-icon style with its own background color. Set `content.logo` (or hero `data.logo` / `headerLogo`) to an HTTPS URL or same-origin `/path`. For local files, upload with `POST /api/v1/upload` and use the returned URL. Missing or non-HTTPS logos produce `warnings` on create/upsert, PUT, PATCH and dry-run. Child pages inherit the root header logo and need no separate logo. `heroImage` does not count for directory cards or the missing-logo warning; the header still falls back to it. Dry-run warns to replace the placeholder with the real logo and `https://color-bench-demo.pages.dev` with your deployed tool URL wherever that value appears.

| Context | Uses | Fallback |
|---------|------|----------|
| Header / Favicon | `headerLogo` | primary logo |
| Hero section | hero `data.logo` | primary logo |
| App cards | `headerLogo` → `content.logo` → hero `data.logo` | -- |


All topics: [Overview](https://appai.info/spec) · [Authorization & API](https://appai.info/spec/api) · [Style & logo](https://appai.info/spec/style) · [Theme](https://appai.info/spec/theme) · [Typography](https://appai.info/spec/typography) · [Pages](https://appai.info/spec/pages) · [Sections](https://appai.info/spec/sections) · [Multi-language & multi-page](https://appai.info/spec/i18n) · [Tools](https://appai.info/spec/tools) · [Universal App](https://appai.info/spec/apps)
