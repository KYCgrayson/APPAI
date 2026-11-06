# AppAI — Theme
Choose theme colors, dark mode, section backgrounds and ready-made style kits.
Previous: [Style & logo](https://appai.info/spec/style) · Next: [Typography](https://appai.info/spec/typography)
API base: `https://appai.info`; auth: `Authorization: Bearer appai_sk_YOUR_KEY`.

| Style kit | themeColor | themeColorSecondary | fontFamily | darkMode | Suggested backgroundColors |
|---|---|---|---|---|---|
| indigo | #4F46E5 | #0891B2 | Inter | false | #FFFFFF, #EEF2FF |
| forest | #047857 | #B45309 | Lato | false | #FFFFFF, #ECFDF5 |
| editorial | #9F1239 | #57534E | Lora | false | #FFFBEB, #FFF1F2 |
| ocean | #0369A1 | #0F766E | Manrope | false | #FFFFFF, #F0F9FF |
| midnight | #A5B4FC | #67E8F9 | Space Grotesk | true | #0F172A, #1E293B |
| ember | #FDBA74 | #FCA5A5 | DM Sans | true | #1C1917, #292524 |

Use indigo for apps/SaaS; forest for nature and wellbeing; editorial for writing and portfolios; ocean for services and technical products; midnight for dark dashboards; ember for warm creative brands. Copy kit fields into the page request; backgrounds remain opt-in.

`themeColor` sets the primary accent; `themeColorSecondary` sets the secondary accent. When omitted, the secondary color is automatically derived from the primary.

### Visual Design Capabilities

- **Section backgrounds:** Any section can have a custom `backgroundColor`. Use tints of your themeColor for visual rhythm.
- **Hero backgrounds:** `backgroundColor` (solid color), `backgroundImage`, or `backgroundVideo`. Dark backgrounds auto-switch text to white.
- **Dark mode:** Set `darkMode: true` at page level. All sections, cards, borders adapt automatically.
- **Icons:** Three formats — Ionicons name (e.g. `globe-outline`), emoji, or image URL. Use one of `icons` (`GET /api/v1/sections`) or any emoji
- **Markdown:** Supported in: `about.text`, `faq.items[].answer`, `testimonials.items[].quote`, `team.items[].bio`, `schedule.items[].description`, `pricing.items[].description`, `cta.subheadline`, `form.description`


## Hero variants

| Type | What it does |
|---|---|
| `hero` | Headline banner. **Variants:** `centered` (default), `split` (text left, image right), `minimal` (compact). **Height:** `full`/`large`/`medium`/`small`. Supports `backgroundColor`, `backgroundImage`, `backgroundVideo`, secondary CTA. |

All topics: [Overview](https://appai.info/spec) · [Authorization & API](https://appai.info/spec/api) · [Style & logo](https://appai.info/spec/style) · [Theme](https://appai.info/spec/theme) · [Typography](https://appai.info/spec/typography) · [Pages](https://appai.info/spec/pages) · [Sections](https://appai.info/spec/sections) · [Multi-language & multi-page](https://appai.info/spec/i18n) · [Tools](https://appai.info/spec/tools) · [Universal App](https://appai.info/spec/apps)
