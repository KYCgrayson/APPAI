# AppAI — Style
Covers Style kits, visual design, colours, fonts, backgrounds, hero variants and logo rules.
API base: `https://appai.info`; auth: `Authorization: Bearer appai_sk_YOUR_KEY`.
[Overview](https://appai.info/spec) · [Pages](https://appai.info/spec/pages) · [Style](https://appai.info/spec/style) · [I18n](https://appai.info/spec/i18n) · [Tools](https://appai.info/spec/tools) · [Apps](https://appai.info/spec/apps) · [API](https://appai.info/spec/api)

| Style kit | themeColor | themeColorSecondary | fontFamily | darkMode | Suggested backgroundColors |
|---|---|---|---|---|---|
| indigo | #4F46E5 | #0891B2 | Inter | false | #FFFFFF, #EEF2FF |
| forest | #047857 | #B45309 | Lato | false | #FFFFFF, #ECFDF5 |
| editorial | #9F1239 | #57534E | Lora | false | #FFFBEB, #FFF1F2 |
| ocean | #0369A1 | #0F766E | Manrope | false | #FFFFFF, #F0F9FF |
| midnight | #A5B4FC | #67E8F9 | Space Grotesk | true | #0F172A, #1E293B |
| ember | #FDBA74 | #FCA5A5 | DM Sans | true | #1C1917, #292524 |

### Visual Design Capabilities

- **Section backgrounds:** Any section can have a custom `backgroundColor`. Use tints of your themeColor for visual rhythm.
- **Hero backgrounds:** `backgroundColor` (solid color), `backgroundImage`, or `backgroundVideo`. Dark backgrounds auto-switch text to white.
- **Dark mode:** Set `darkMode: true` at page level. All sections, cards, borders adapt automatically.
- **Custom fonts:** Set `fontFamily` at page level. Loaded from Google Fonts automatically. Start from a style kit in the table above. CJK: `Noto Sans TC` / `Noto Sans SC` / `Noto Sans JP`.
- **Icons:** Three formats — Ionicons name (e.g. `globe-outline`), emoji, or image URL. Use one of `icons` (`GET /api/v1/sections`) or any emoji
- **Markdown:** Supported in: `about.text`, `faq.items[].answer`, `testimonials.items[].quote`, `team.items[].bio`, `schedule.items[].description`, `pricing.items[].description`, `cta.subheadline`, `form.description`

### Logo

**Every root page should provide a logo (strong recommendation; publishing is never blocked):** square 512x512 PNG, app-icon style with its own background color. Set `content.logo` (or hero `data.logo` / `headerLogo`) to an HTTPS URL or same-origin `/path`. For local files, upload with `POST /api/v1/upload` and use the returned URL. Missing or non-HTTPS logos produce `warnings` on create/upsert, PUT, PATCH and dry-run. Child pages inherit the root header logo and need no separate logo. `heroImage` does not count for directory cards or the missing-logo warning; the header still falls back to it. Dry-run warns to replace the placeholder with the real logo and `https://color-bench-demo.pages.dev` with your deployed tool URL wherever that value appears.

| Context | Uses | Fallback |
|---------|------|----------|
| Header / Favicon | `headerLogo` | primary logo |
| Hero section | hero `data.logo` | primary logo |
| App cards | `headerLogo` → `content.logo` → hero `data.logo` | -- |

---

## Hero variants

| Type | What it does |
|---|---|
| `hero` | Headline banner. **Variants:** `centered` (default), `split` (text left, image right), `minimal` (compact). **Height:** `full`/`large`/`medium`/`small`. Supports `backgroundColor`, `backgroundImage`, `backgroundVideo`, secondary CTA. |
