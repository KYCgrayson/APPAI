# AppAI platform design rules

Applies to home, `/websites`, `/tools`, `/apps`, `/games`, `/spec`,
admin/dashboard, auth, and hosted-page header/footer/language controls.
Read before changing platform UI; review with the numbered checklist below.
Baseline: `b105e44` (ops #22). This document changes no UI.

Publisher content, embedded tools and game canvases keep their own identity;
their API contract remains in `docs/spec/`. Do not apply platform cyan to every
hosted page or replace its theme kit. Shared chrome is in scope.
Rules below govern new work. Existing exceptions are recorded in the appendix;
they are follow-up work, not permission to repeat them or silently restyle a page.

## Principles

- Lead with the task: directory cards expose name, purpose and destination; one primary action per action group.
- Use the existing surface family: dark public discovery, light management/auth, page-derived hosted chrome.
- Make hierarchy with size, weight and spacing before adding colour, shadows or decoration.
- Reuse shared header, card, logo, breadcrumb and icon components; do not fork their markup for one route.
- Keep content readable: AA contrast, bounded text width, useful labels, and no page overflow at 375px.
- Show real product identity: supplied logos first, deterministic letter tiles only as a fallback.
- Design every state and locale: keyboard, empty/error/loading, long names and CJK are part of the component.

### Benchmarks and what we take from them

These are principles interpreted for AppAI, not imported assets, copy or tokens.
The repo sources below determine all implementation values.

| Benchmark | Principle contributed | AppAI application |
|---|---|---|
| [Linear — Quality](https://linear.app/quality) | Deliberate details and a coherent product experience | Reuse shared chrome; fix inconsistent states instead of adding decoration. |
| [Vercel — Geist](https://vercel.com/geist/introduction) | Consistent components and accessible colour hierarchy | Neutral surfaces, restrained borders, repeatable type and spacing roles. |
| [Apple / App Store — app icons](https://developer.apple.com/design/human-interface-guidelines/app-icons) | Simple, recognizable identity at small sizes | A readable 48px directory logo, one shape/initial, no miniature screenshot as a logo. |

## Color tokens

Use the existing Tailwind v4 utilities below. They resolve through the installed
theme; do not substitute Tailwind v3 hex approximations. There is no platform
`brand` variable. `--primary` in `globals.css` is neutral, not cyan.

| Role | Public discovery | Management/auth | Source |
|---|---|---|---|
| Canvas | `bg-gray-950 text-gray-100` | `bg-gray-50`, white content surfaces | `PlatformDirectory.tsx`, dashboard/admin layouts |
| Card | `bg-gray-900` | `bg-white` | `AppCard.tsx`, dashboard page |
| Subtle panel | `bg-gray-900/50` or existing `/60` | `bg-gray-100` / `bg-gray-50` | Home FAQ, directory filters, dashboard |
| Heading | `text-white` / `text-gray-100` | `text-gray-900` or inherited `text-foreground` | Cards, games, globals |
| Body | `text-gray-300` | `text-gray-700` / `text-gray-600` | Games, dashboard |
| Secondary text | `text-gray-400` | `text-gray-600`; `text-gray-500` only after contrast check | Directory, dashboard |
| Dividers/card borders | `border-gray-800`; hover `border-gray-700` | `border-gray-200` or semantic `border-border` | Cards, login, globals |
| Public accent | `text-cyan-400`; active nav/link `text-cyan-300` | Keep neutral controls; `text-blue-600` for existing work-area links | Home/header, dashboard |
| Existing cyan fills | `bg-cyan-600`, hover `bg-cyan-500` | Not the default work-area fill | Home, account controls; contrast exception D03 |
| Game accent | `text-emerald-300` / `text-emerald-400`; `game.accent` for Play | Not a second platform brand | Game hub/detail, `games-catalog.ts` |
| Success | Label plus `text-green-600`, `bg-green-50` on light | Same | Device auth, settings |
| Error/destructive | Label plus `text-red-600`; semantic `--destructive` if using semantic controls | Same | Device auth, dashboard actions |
| Warning/beta | `text-amber-300 border-amber-500/40` on dark | `bg-amber-50 text-amber-900` on light | Games, device auth |
| Neutral status | `text-gray-300 border-gray-600` on dark | `bg-gray-100` with readable dark text | Games, dashboard pages |

Semantic tokens already defined in `src/app/globals.css`:

| Token group | Light | `.dark` |
|---|---|---|
| `--background` / `--foreground` | `oklch(1 0 0)` / `oklch(0.145 0 0)` | `oklch(0.145 0 0)` / `oklch(0.985 0 0)` |
| `--card`, `--popover` / their foregrounds | `oklch(1 0 0)` / `oklch(0.145 0 0)` | `oklch(0.205 0 0)` / `oklch(0.985 0 0)` |
| `--primary` / `--primary-foreground` | `oklch(0.205 0 0)` / `oklch(0.985 0 0)` | `oklch(0.922 0 0)` / `oklch(0.205 0 0)` |
| `--secondary`, `--muted`, `--accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` |
| `--border` / `--input` | Both `oklch(0.922 0 0)` | White at 10% / 15% |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |

Public pages use explicit gray utilities; they are not a site-wide `.dark`
toggle. Do not assume switching a semantic variable changes these pages.
Prefer the dominant gray family within each surface; do not introduce slate/zinc
alternatives for an equivalent role. Publisher theme colours remain separate.

### Hosted dark surfaces (#41)

| Contract | Existing value / implementation |
|---|---|
| Scope | `data-hosted-dark="true"`; rules in `src/templates/shared/hosted-chrome.css` |
| Canvas/header/footer | `--hosted-chrome-bg`: first ordered six-digit hex section background with luminance ≤ 0.1; fallback `#111827` |
| Drawer/inset surface | `--hosted-chrome-surface`: next distinct eligible background, otherwise the canvas |
| Foreground / muted | `#f3f4f6` / `#d1d5db`; hover white |
| Borders | Header/footer `#374151`; mapped inner borders `#4b5563` |
| Active language pill | `#f3f4f6` background/border, `#111827` text |
| Theme link | `--page-theme-link-light` / `--page-theme-link-dark` from `proseThemeVariables()` |
| Ownership | Displayed child controls dark mode and dark surfaces; privacy/terms chrome is light |
| Short pages | `min-h-screen flex flex-col`, `main.flex-1`; no white gap below a dark page |
| Kit examples | Midnight `#0F172A` / `#1E293B`; ember `#1C1917` / `#292524`; keep warm kits warm |

### Contrast gate

Require [WCAG AA text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html):
4.5:1 for normal text; 3:1 for large text (at least 24 CSS px regular or
18.67 CSS px bold). Essential control boundaries, state indicators and focus
indicators need [3:1 against adjacent colours](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
Decorative card dividers need not carry that meaning on their own.

Measure computed foreground/background, including opacity, hover and overlays.
A token's presence in this repo is not evidence that every pairing passes.
For opaque publisher fills, reuse `normalizeOpaqueHex()` and
`readableTextColor()`; preserve the contrast-adjusted hosted link helpers.
For new public filled controls, use an existing readable neutral pair
(`bg-gray-950 text-white`, hover `bg-gray-800`) if the cyan pairing fails;
keep cyan for the surrounding accent. Do not duplicate D03.

## Typography scale

Sizes below assume a 16px root. Use classes, not fixed inline pixel overrides.
Weights: normal 400, `font-medium` 500, `font-semibold` 600, `font-bold` 700.
Line heights are Tailwind defaults unless `leading-relaxed` (1.625) is specified.

| Role | Classes / weight | Size / line-height | Source |
|---|---|---|---|
| Home display | `text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-balance` | 36/40 → 48/48 → 60/60px | Home hero |
| Game title | `text-4xl sm:text-5xl font-bold tracking-tight` | 36/40 → 48/48px | Game hub/detail |
| Directory / public section H1–H2 | `text-3xl font-bold` | 30/36px | Directory, home sections |
| Work-area H1 | `text-2xl font-bold` | 24/32px | Dashboard, settings |
| Reading section H2 | `text-2xl font-semibold` | 24/32px | Game detail |
| Feature / empty-state heading | `text-xl font-semibold` | 20/28px | Directory empty state, games |
| Work-area section / hosted brand | `text-lg font-semibold` | 18/28px | Settings, hosted header |
| Directory card name | Inherited 16px, `font-semibold` | 16/24px | `AppCard.tsx` |
| Body | `text-base leading-relaxed` | 16/26px | Game introduction |
| Intro | `text-lg md:text-xl leading-relaxed` | 18/29.25 → 20/32.5px | Home hero |
| Card copy / nav / labels | `text-sm`; long descriptions add `leading-relaxed` | 14/20 or 14/22.75px | Directory, header, games |
| Metadata / badges | `text-xs`; label weight normal or medium | 12/16px | Publisher line, games badges |
| Identifiers / code | `font-mono text-sm`; numbers can use `tabular-nums` | 14/20px | Home snippets, settings, StatCard |

- Platform shell uses `font-sans antialiased`. Globals reference Geist variables,
  but root layout does not load Geist; do not claim it is installed (D06).
- Default to inherited platform fonts; no per-card display font or Google Font import.
- Keep body copy within `max-w-2xl` (672px); long reading sections/FAQ within
  `max-w-3xl` (768px). These are the maximum line-width containers, not full-page text at `max-w-6xl`.
- CJK hero keeps `[word-break:keep-all]`, intentional `<wbr />` opportunities
  and `text-balance`; other locales use `[overflow-wrap:anywhere]`. Test actual
  zh-TW/ja/ko strings at 375px; add valid break opportunities if an unbroken title overflows.
- Cards use `min-w-0 break-words`; reserve `truncate`/`line-clamp-2` for summaries,
  with full content reachable at the destination. Do not truncate field errors.
- Hosted content follows `docs/spec/typography.md`: kit font for en/es,
  Noto Sans TC/SC for zh-TW/zh-CN, matching CJK font for other requested locales.
  Its `textSize`, `textContrast` and role multipliers do not size platform chrome.

## Spacing & layout

Use the existing 4px spacing unit: 1/2/3/4/5/6/8/10/12/16/20 =
4/8/12/16/20/24/32/40/48/64/80px. Half steps already used for compact badges
(`px-1.5`, `py-0.5`) mean 6px/2px; do not invent arbitrary gaps.

| Context | Existing layout standard |
|---|---|
| Public shell / dashboard | `max-w-6xl mx-auto` (1152px); content `px-6` |
| Admin data area | `max-w-7xl mx-auto` (1280px), `py-8 px-6` |
| Game detail | `max-w-5xl` (1024px), `px-4 py-12 sm:px-6 sm:py-16` |
| Auth panel | `max-w-md w-full` (448px), `p-8`; allow outer mobile gutters (D09) |
| Home sections | `py-20 px-6`; entrances `py-16`; title-to-content `mb-8` |
| Directory | `px-6 pt-4 pb-8`; introduction `mb-8` |
| Directory grid | `grid gap-6 md:grid-cols-3`; one column below md |
| Game grid | `grid gap-6 md:grid-cols-2 lg:grid-cols-3` |
| Work-area grid | `grid md:grid-cols-3 gap-6`; supporting sections `md:grid-cols-2` |
| Card internals | `p-6`, identity row `gap-4`, metadata `mt-2`, description `mt-1` / `mt-2` |
| Form rhythm | `space-y-5` or grouped `gap-4`; label-to-control `gap-1` |

Breakpoints: sm 640px, md 768px, lg 1024px. At 375px, keep one column for
directory cards and stack CTA rows (`flex-col sm:flex-row`). Use the shared
header's `px-4 sm:px-6`, wrapping nav and `min-w-0` text containers.
Filters and locale chips wrap (`flex-wrap gap-2`); do not force one long row.

No document-level horizontal scroll at 375px or 1280px. Do not hide overflowing
text with a global `overflow-x-hidden`. Code and genuinely wide data tables may
scroll inside a labelled bounded region (`overflow-x-auto`), never the page.
At both widths, check `document.documentElement.scrollWidth <= clientWidth`.

## Components

### Buttons and links

| Role | Recipe already present | Rule |
|---|---|---|
| Primary work action | `bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800` | Text names the action; one primary per group; AA gate applies. |
| Public large action | `px-8 py-4 rounded-xl font-semibold transition-colors` | Use approved foreground/fill pairing; existing cyan has D03. |
| Secondary dark action | `border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white` | Same size as adjacent primary, no competing glow. |
| Game Play/details | `rounded-xl font-semibold text-gray-950`, `game.accent`, `hover:opacity-90` | Hub `min-h-12`; detail `min-h-14`; keep clear game name in accessible text. |
| Inline action | `text-cyan-300` on public dark; `text-blue-600 hover:underline` in work areas | Underline on hover/focus; inline prose links must be distinguishable without colour alone. |
| Disabled/loading | `disabled:opacity-50` plus native `disabled` and progress label | No second submission; explain status without relying on dimming. |

Use `<a>`/Link for navigation and `<button>` for actions. Do not nest buttons
inside a whole-card link. New standalone touch controls use at least `min-h-11`
(44px) and icon-only controls `w-11 h-11`; this is the AppAI target, not an AA size claim.

### Cards, images and logos

- Default card: `rounded-xl p-6`; dark `bg-gray-900 border border-gray-800`,
  hover `border-gray-700 transition-colors`; light `bg-white shadow-sm`.
- `rounded-xl` is dominant for cards. Globals set `--radius: 0.625rem` (10px):
  `rounded-md` = 8px, `rounded-lg` = 10px, `rounded-xl` = 14px,
  `rounded-2xl` = 18px. Do not assume stock Tailwind radii. Pills use `rounded-full`.
- Use `AppCard` for directory entries and `DirectoryLogo` for their identity.
  Keep name, two-line tagline, publisher and factual platform/category labels.
- Directory image: `w-12 h-12 rounded-xl object-cover` (48px).
  Fallback (#32): `w-12 h-12 shrink-0`, same radius, `text-lg font-bold`,
  centered first meaningful grapheme, subtle existing inset 1px white/12% edge.
- Reuse `firstGrapheme()` (CJK/combined characters safe), `directoryTileColors()`
  and `logosFirst()`. Invalid/missing theme colour becomes `#334155`; text is
  black/white chosen for AA. Never replace the fallback with a generic app emoji.
- Real logos precede fallback tiles; preserve featured/recent grouping and
  directory partition rules. Never use `heroImage` as the directory logo.
- Logo source order: valid App `logoUrl`, then page `headerLogo`, `content.logo`,
  hero `data.logo`. Hosted dark headers prefer root primary logo before `headerLogo`.
- Supply a square PNG with its own background for hosted root identity: 512×512
  recommended, 1024×1024 accepted; HTTPS or same-origin path. Follow `docs/spec/style.md`.
- Platform brand is `/appai-logo2.png`, `w-7 h-7` in headers; hosted logo `w-8 h-8`.
  Do not stretch photos into logos or add text-heavy placeholder art.
- Game covers keep `aspect-video`, declared 640×360 dimensions and `object-cover`;
  homepage thumbnails are 96×54. Reserve media space; meaningful images get alt,
  decorative images next to the same title use `alt=""`. Letter tiles are `aria-hidden`.

### Navigation, footer and language switcher

| Component | Required pattern |
|---|---|
| Public header | Reuse `PlatformHeader`/`PlatformHeaderView`: `sticky top-0 z-50`, `bg-gray-950/90 backdrop-blur-sm border-b border-gray-800`; wrap navigation below identity on mobile. |
| Breadcrumb | Reuse shared breadcrumb helpers; labelled nav, current item `aria-current="page"`, decorative separators hidden. Long trails must not widen the viewport. |
| Public footer | Reuse `PlatformFooter`: `border-t border-gray-800 py-8 px-6`, wrapping links, `flex-col sm:flex-row gap-4`. |
| Management | Keep English work-area navigation and `ManagementBreadcrumb`; use dashboard's wrapping layout for new navigation. |
| Platform language | Reuse native `LanguageSwitcher`: `text-sm rounded-md px-2 py-1`, accessible label, nine platform locales; compact mode `min-h-11 w-24 sm:w-auto`. |
| Hosted language | Reuse `LocaleLink` and drawer variants; hide switcher when there is only one reachable choice. Desktop `px-2 py-0.5 rounded`; light active `bg-gray-100 text-gray-900 font-medium`, dark active uses #41 inversion. |
| Hosted header | Keep `AdaptiveChrome` content-fit measurement, root 24px gutters, compact child `px-4 md:px-6`; non-root Home remains a 44×44 control. |
| Hosted drawer | Keep labelled toggle, `aria-expanded`, Escape close, scrollable `max-h-[calc(100vh-57px)] overflow-y-auto`; do not hide options to make them fit. |
| Hosted footer | Keep AppAI attribution, legal links and page-matched dark surface; no new promotional banner. |

Platform locales and hosted BCP 47 content variants are separate systems.
Use `pickByLocale` at their boundary. Preserve locale-aware destinations and
manual language preference. Visual selection also needs programmatic current
state; hosted language links currently lack it (D11).

### Forms, badges, empty states and icons

| Component | Standard |
|---|---|
| Input/select | Existing management pattern `border rounded-lg px-4 py-2` or `rounded-lg border bg-white p-2`; full-width stacked groups on mobile. Every field has a persistent associated label. |
| Multiline field | Feedback pattern `block w-full p-3 mt-1`, visible label, appropriate rows and length constraints; use the standard control radius when adding fields. |
| Validation | Explain the problem beside the field; associate help/error via `aria-describedby`, mark invalid fields, retain input; errors use `role="alert"`, success/progress `role="status"`. |
| Badges | `text-xs rounded-full px-2 py-0.5` for compact game states; `px-2 py-1` for management status. Use words, not just dots/colour; no invented “featured”/“verified” claims. |
| Empty directory | `py-20 text-center`, `text-xl font-semibold` heading and muted explanation. Distinguish no results from failed loading. |
| Empty work panel | `bg-white rounded-xl p-12 shadow-sm text-center`; explain filters/next action, as in dashboard pages. |
| Icons | Prefer `Icon` from `src/components/ui/Icon.tsx`: bundled Ionicons, default 20px, `currentColor`; use known names. Existing chrome outline SVGs and provider logos are allowed. |
| Icon semantics | Decorative icons hidden; standalone icons need accessible text/label. Use the existing 20px/24px chrome sizes; do not combine emoji, filled art and unrelated icon packs in one nav. |

## Motion & states

| State | Required behaviour / existing building block |
|---|---|
| Hover | `transition-colors` with the component's border/text/fill change; default duration 150ms. No lift/scale on every directory card. |
| Focus-visible | Games use `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`; hosted links use a 2px ring/offset. Choose the surface-appropriate colour and verify 3:1. |
| Pressed / active | Keep geometry stable; use the same readable palette, with text/current-state semantics. Nav uses `aria-current`; toggles need pressed/expanded semantics. No new active-only colour token is needed. |
| Disabled | Native disabled state plus existing opacity treatment; prevent activation, keep the reason readable outside the disabled control. |
| Loading | Keep the action label/progress message visible and retain layout; animation is supplementary. |
| Reduced motion | Honour `prefers-reduced-motion`; use the existing `editorial.module.css` pattern: enable transforms only under `no-preference`. No autoplay entrance sequences, parallax or required spinning feedback. |

Native focus must remain visible even when a component lacks a custom ring.
Never add `outline-none` without a visible replacement. Global reduced-motion
coverage is not implemented; existing auth spinner/FAQ rotation are D12.

## Accessibility checklist

- [ ] One meaningful page H1; subsequent headings express structure, not desired font size.
- [ ] Landmarks, native links/buttons/forms and labelled navigation preserve keyboard order.
- [ ] Every control has an accessible name; fields have labels, errors and status announcements.
- [ ] Focus is visible and not clipped/hidden by sticky chrome; drawer can be opened and dismissed by keyboard.
- [ ] Text meets 4.5:1 (large text 3:1); essential controls/focus meet 3:1 in every enabled state.
- [ ] Colour is accompanied by text, shape, underline or programmatic state; no colour-only selection.
- [ ] Images have appropriate alt; decorative tiles/icons are hidden; no UI words baked into images.
- [ ] At 375px, 1280px and 200% zoom: content reflows, controls remain reachable, document does not scroll horizontally.
- [ ] CJK/long translations, signed-in/out, empty/error/loading and reduced motion have been checked.
- [ ] New standalone targets are at least 44px; dense inline links remain usable without overlapping targets.

## Anti-patterns: the “AI-default look” to avoid

| Avoid | Repo-specific replacement |
|---|---|
| Gratuitous gradients, glowing blobs, rainbow sections | Solid gray surfaces. Existing home cyan and games emerald hero washes are localized exceptions; do not spread them to cards/forms. |
| Emoji as platform UI icons | Use bundled `Icon` or existing chrome SVGs. Publisher-supplied icons/graphemes can contain emoji; the hosted API still permits them. |
| Centering every heading, paragraph and control | Left-align directories, card content and work forms. Centering is reserved for the existing home hero, simple auth panels and empty states. |
| Giant shadows / floating every card | Border-led dark cards; `shadow-sm` on light panels. Reserve overlay shadows for overlays; old promotional/auth shadows are D04. |
| Random blues, purples or grays per section | Use the role table; game accents and factual platform badges are scoped exceptions, not a new palette for each card. |
| Generic “AI-powered” filler and fake metrics | Use the actual product name, short purpose, publisher and supported action/status. |
| Oversized titles, tiny unreadable metadata | Follow the type table; no new 10px badges or gray-600 body copy on dark cards (D02/D05). |
| Inconsistent rounding / nested pill containers | Cards `rounded-xl`, controls `rounded-lg`, status pills `rounded-full`; preserve explicit compact chrome recipes. |
| Screenshot/photo substitutes for identity | Use real square logos or the #32 grapheme tile; keep hero art separate. |
| Desktop squeezed onto a phone | Wrap filters/nav, stack grids/actions, use AdaptiveChrome; do not shrink all text or clip page overflow. |
| Turning `/spec` into another marketing page | It is `text/plain` Markdown served by route handlers. Keep headings, concise tables and absolute topic links; no visual shell or font CSS. |

## Review checklist

For each item record **Yes / No / N/A (reason)**. A No blocks acceptance for
new/changed UI unless the reviewer explicitly accepts a documented exception.
Unchanged appendix entries do not force unrelated cleanup in a PR.
Attach before/after screenshots at **375px and 1280px** for each changed page
family, with route, locale, mode and state labelled; use fictional fixture data.
For documentation-only diffs, mark visual items N/A and prove UI sources unchanged.

1. [ ] Is scope clear (platform, hosted chrome or publisher content), with the correct surface family retained?
2. [ ] Does the diff reuse shared components/helpers and avoid new parallel design tokens?
3. [ ] Do all colours match the role table, with computed AA checks for changed enabled text/control states?
4. [ ] Are heading/body/metadata sizes, weights, line heights and line-width limits from the type table?
5. [ ] Are container widths, gaps, padding and card/control radii consistent with their role?
6. [ ] At 375px and 1280px, do grids/nav/forms fit with no document horizontal scroll or clipped essential text?
7. [ ] Are long English and CJK names/translations usable, including zoom and signed-in account controls?
8. [ ] Do directory cards preserve logo precedence, 48px tiles, grapheme/contrast fallback and real-logo-first ordering?
9. [ ] Are primary/secondary actions clear, correctly semantic, keyboard reachable and appropriately sized?
10. [ ] Do hover, focus-visible, selected/pressed, disabled and loading states remain readable and stable?
11. [ ] Do forms have labels, usable validation and distinct success/error/loading/empty states?
12. [ ] Are icon/image semantics, heading order, landmarks and non-colour state cues checked?
13. [ ] Do header/footer, breadcrumbs and locale controls preserve destinations, current state and responsive wrapping?
14. [ ] For hosted chrome, are root/child, light/dark, policy, short-page and open-drawer cases correct under #41?
15. [ ] Does reduced motion remove nonessential movement while retaining status and functionality?
16. [ ] Does the diff avoid every relevant anti-pattern, or document a specific accepted exception?
17. [ ] Are labelled before/after 375px/1280px screenshots attached, with checks and limitations recorded?
18. [ ] Are spec source/generated output and both feature maps current when affected, with required commands reported?

## Known deviations (baseline, not fixed by this document)

Source locations below refer to `b105e44`; refresh them when a later task fixes
the issue. These are concrete observed inconsistencies, not a complete site audit.
Dominant choices: gray neutrals, `rounded-xl` cards, `rounded-lg` form controls,
12px minimum metadata and explicit readable state styling.

| ID | Source (`file:line`) | Deviation → follow-up standard |
|---|---|---|
| D01 | `src/app/[locale]/page.tsx:100`, `:142`; `src/app/[locale]/games/page.tsx:62`; `src/app/[locale]/login/page.tsx:26`; `src/app/[locale]/auth/device/page.tsx:85` | Cards use `rounded-2xl` or `rounded-lg` instead of dominant `rounded-xl`; align card roles in a dedicated UI task. |
| D02 | `src/components/AppCard.tsx:74`; `src/app/[locale]/page.tsx:85`; `src/components/PlatformFooter.tsx:15`; `src/components/admin/StatCard.tsx:12`; `src/app/[locale]/login/page.tsx:64` | Gray-600 on dark and gray-400 on white are low contrast; gray-500 footer copy also needs measurement. Use the readable secondary-text role. |
| D03 | `src/app/[locale]/page.tsx:53`, `:149`; `src/components/AccountControls.tsx:37`; `src/components/PlatformDirectory.tsx:72` | White normal-size text on cyan-600/500 fills is not a safe 4.5:1 pairing. Reuse readable neutral fills or validate a future accent fix; check hover too. |
| D04 | `src/app/[locale]/page.tsx:53`, `:119`, `:257`; `src/app/[locale]/login/page.tsx:26`; `src/app/[locale]/auth/device/page.tsx:85` | Promotional cyan shadows and auth `shadow-lg`/`shadow-md` exceed light panel `shadow-sm`; do not copy into new cards. |
| D05 | `src/components/AppCard.tsx:79`, `:82`, `:87`; `src/components/AccountControls.tsx:48` | 10px badges are below the 12px metadata standard. |
| D06 | `src/app/globals.css:11`, `:12`; `src/app/layout.tsx:85` | Sans/mono variables reference Geist without a font loader/definition in the root layout; verify computed font and define one intentional stack in a later task. |
| D07 | `src/app/admin/layout.tsx:20` | Admin header has a wide unwrapped row; adopt dashboard's wrapping pattern and verify 375px. |
| D08 | `src/app/dashboard/settings/page.tsx:106` | Key-name input relies on placeholder and the action row does not wrap; add an associated label and mobile stacking. |
| D09 | `src/app/[locale]/login/page.tsx:25`; `src/app/[locale]/auth/device/page.tsx:84` | Full-width auth card has no outer mobile gutter; keep `p-8` internally and use existing `px-4` outer spacing. |
| D10 | `src/components/LanguageSwitcher.tsx:21`; `src/components/PlatformHeaderView.tsx:69`; `src/app/p/[...segments]/MobileMenu.tsx:83` | Noncompact selector/nav and 40px root hamburger fall short of the new 44px standalone-control target; verify spacing and focus when updating them. |
| D11 | `src/app/p/[...segments]/LocaleLink.tsx:20`; `src/app/p/[...segments]/MobileMenu.tsx:154` | Hosted locale selection is visual without current-language semantics; desktop pills are also very small. Preserve #41 inversion while improving semantics/targets. |
| D12 | `src/app/[locale]/auth/device/page.tsx:148`; `src/app/[locale]/page.tsx:220` | Spinner and FAQ transform have no explicit reduced-motion alternative; reuse the existing no-preference gating approach. |
| D13 | `src/app/[locale]/feedback/form.tsx:17`, `:38` | Feedback uses plain `rounded` fields and a blue primary while work forms mostly use `rounded-lg` and neutral buttons; align roles without losing status semantics. |
| D14 | `src/components/AccountControls.tsx:36`, `:57` | Slate account text mixes with the dominant gray public palette; align equivalent roles and measure muted-link contrast. |

When fixing a deviation, include its ID, scoped screenshots and contrast/state
evidence. Remove the row only after verification; do not “fix” it by weakening
the rule. This documentation task leaves all listed UI unchanged.
