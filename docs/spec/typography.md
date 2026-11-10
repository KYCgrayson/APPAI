# AppAI — Typography
Choose a font, overall text size, heading contrast and optional role overrides.
Previous: [Theme](https://appai.info/spec/theme) · Next: [Pages](https://appai.info/spec/pages)
API base: `https://appai.info`; auth: `Authorization: Bearer appai_sk_YOUR_KEY`.

- **Custom fonts:** Each locale variant stores its own page-level `fontFamily`, loaded from Google Fonts and rendered as `"<font>", sans-serif`. There is no automatic CJK font selection. Use the kit’s `fontFamily` for `en` and `es`, `Noto Sans TC` for `zh-TW`, and `Noto Sans SC` for `zh-CN`; for other CJK languages chosen by the user, choose the matching font (e.g. `Noto Sans JP` for Japanese). Keep `themeColor`, `themeColorSecondary`, `darkMode` and the kit’s suggested backgroundColors the same across variants. Start from a [style kit](https://appai.info/spec/theme) before choosing a font.

All three layers are optional. Omitted settings, or `textSize: "md"` with `textContrast: "normal"` and no overrides, preserve existing section typography exactly. Send settings at page level or under `content`; they persist in content JSON. Top-level values take precedence. PUT/upsert replace content; PATCH merges content and preserves sections. An overrides object replaces the previous overrides; send `{}` to clear it.

- `textSize`: xs (75%), sm (87%), md (100%), lg (115%), xl (132%), 2xl (152%), 3xl (175%), 4xl (200%).
- `textContrast`: low reduces heading/display to 80%, normal keeps 100%, high increases them to 125%. Caption/card/body are unchanged.
- `typography`: optional caption, card, body, heading, display values using the same eight steps. Each override selects that role’s size independently of textSize; contrast still applies to heading/display. Unset roles follow textSize and textContrast.
- Roles: caption = notes/meta; card = card text; body = paragraphs; heading = section titles; display = hero/first-screen title.

## Sizes in pixels

<!-- typography-table -->
| Step | Scale | Caption | Card | Body | Heading | Display |
|---|---|---|---|---|---|---|
| xs | 75% | 10.5 | 12 | 12 | 28.8 / 36 / 45 | 36 / 45 / 56.25 |
| sm | 87% | 12.18 | 13.92 | 13.92 | 33.41 / 41.76 / 52.2 | 41.76 / 52.2 / 65.25 |
| md | 100% | 14 | 16 | 16 | 38.4 / 48 / 60 | 48 / 60 / 75 |
| lg | 115% | 16.1 | 18.4 | 18.4 | 44.16 / 55.2 / 69 | 55.2 / 69 / 86.25 |
| xl | 132% | 18.48 | 21.12 | 21.12 | 50.69 / 63.36 / 79.2 | 63.36 / 79.2 / 99 |
| 2xl | 152% | 21.28 | 24.32 | 24.32 | 58.37 / 72.96 / 91.2 | 72.96 / 91.2 / 114 |
| 3xl | 175% | 24.5 | 28 | 28 | 67.2 / 84 / 105 | 84 / 105 / 131.25 |
| 4xl | 200% | 28 | 32 | 32 | 76.8 / 96 / 120 | 96 / 120 / 150 |
<!-- /typography-table -->

These are **reference element** desktop sizes in pixels, not fixed sizes applied to every element. Heading/display cells show **low / normal / high** contrast. References are hero h1 (text-6xl, 60px desktop / text-4xl, 36px mobile; the centered hero uses md:text-7xl, 72px), section h2 (text-5xl, 48px desktop / text-3xl, 30px mobile), body and card copy (16px), and caption (text-sm, 14px). Every tagged element multiplies its own existing Tailwind size by the same role percentage; responsive classes keep their breakpoints. Untagged elements and Markdown headings receive no typography rules. A tagged element without a text size class uses its inherited 16px base.

Below 640px, the multiplier becomes `1 + (factor - 1) × damping`: damping is 0.35 for display, 0.5 for heading, and 0.75 for other roles. Body/card elements have a 14px mobile floor. From 640–1023px, all roles use an intermediate multiplier of `1 + (factor - 1) × 0.75`; desktop ≥1024px uses the full factor. The extreme 4xl/high hero is 54.9px on mobile (150–180px desktop depending on hero height and variant; the table uses the 60px reference, while the default centered hero uses 72px). The xs/low body reference is 12px desktop / 14px mobile. Every tagged element uses overflow-wrap:anywhere and min-width:0 when typography is active. Enlarged heading/display also use line-height 1.2 and automatic hyphenation. Warnings combine both viewports into one message per path for body below 14px or headings/display smaller than body; publishing remains allowed. Dry-run returns reference sizes in `typography` and `typographyMobile`, plus warnings. Real create, upsert, PUT and PATCH responses also return warnings.

Each page sets its own typography, theme color and font family in the section renderer; child pages do not inherit these settings from the root. Shared navigation chrome has its own root-page styling.

## Recipes

Tool page, compact (body override keeps small text readable):
```json
{"textSize":"sm","textContrast":"low","typography":{"body":"md"}}
```
General:
```json
{"textSize":"md","textContrast":"normal"}
```
Elderly/health: use xl or 2xl, normal contrast, and keep body at least 18px (xl gives 21.12px desktop / 19.84px mobile):
```json
{"textSize":"xl","textContrast":"normal","typography":{"body":"xl"}}
```
Dashboard/kiosk:
```json
{"textSize":"lg","textContrast":"high"}
```

All topics: [Overview](https://appai.info/spec) · [Authorization & API](https://appai.info/spec/api) · [Style & logo](https://appai.info/spec/style) · [Theme](https://appai.info/spec/theme) · [Typography](https://appai.info/spec/typography) · [Pages](https://appai.info/spec/pages) · [Sections](https://appai.info/spec/sections) · [Multi-language & multi-page](https://appai.info/spec/i18n) · [Tools](https://appai.info/spec/tools) · [Universal App](https://appai.info/spec/apps) · [Games](https://appai.info/spec/games)
