**Read-only SEO audit — APPAI**

Audited checkout `ed21f71` = `origin/main`; games branch `origin/claude/games-hub-64` at `5898c3f`, using `git show` and three-dot `git diff`. No files modified. Findings are source-based; database content and deployed responses were not crawled. `B:` references identify files/lines on the games branch.

**A. Surface metadata**

Shared behavior:

- Platform locales: `en`, `ja`, `ko`, `zh-CN`, `zh-TW`, `de`, `fr`, `es`, `hi`. English uses unprefixed URLs; `/en/...` redirects to `/...`. Cookie/browser detection can redirect unprefixed requests to another locale. [routing.ts:3](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/i18n/routing.ts:3)
- Platform routes have **no explicit HTML hreflang metadata**, but next-intl middleware supplies HTTP `Link` alternates for all nine locales plus `x-default`. Hosted pages and static games bypass that middleware behavior. [middleware.ts:179](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/middleware.ts:179); [next-intl documentation](https://next-intl.dev/docs/routing/configuration#alternatelinks-hreflang).
- Root metadata supplies one English title/description, with no canonical, OpenGraph, Twitter, or robots setting. The locale layout only validates locale and loads translations. [root layout:12](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/layout.tsx:12), [locale layout:5](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/[locale]/layout.tsx:5)

| Surface | `<title>` and description | Canonical / hreflang | OpenGraph / Twitter |
|---|---|---|---|
| Homepage `/[locale]` | Inherits English root metadata; no page override. | No canonical. Nine locales + `x-default` through HTTP headers. | Neither configured. |
| `/[locale]/tools` | Same root metadata. Route only renders the tools directory. [tools:5](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/[locale]/tools/page.tsx:5) | No canonical; middleware alternates. **No `/tools/<id>` route exists**; hosted tool views use `/p/...`. | Neither. |
| `/[locale]/apps` | Same root metadata, including filtered `?kind=`/`?category=` variants. [apps:6](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/[locale]/apps/page.tsx:6) | No canonical; middleware alternates. | Neither. |
| `/[locale]/websites` | Same root metadata, including `?type=personal` and category filters. [websites:5](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/[locale]/websites/page.tsx:5) | No canonical; middleware alternates. | Neither. |
| `/spec`, `/spec/<topic>`, `/spec/examples/*` | Route handlers return plain text, JSON, JS, or images; **no HTML title/meta description**. [spec:7](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/spec/route.ts:7), [topics:5](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/spec/[topic]/route.ts:5) | None; locale-free. | None. |
| Games hub `/[locale]/games` **B** | `copy.metaTitle` / `copy.metaDescription`. English title: “Games — play free original brain games on AppAI”. Only English and two Chinese copies; six locales fall back to English. `B:src/app/[locale]/games/page.tsx:7`; `B:src/lib/games-catalog.ts:70,212` | No canonical or HTML alternates; middleware supplies nine-locale + `x-default` HTTP alternates, including English-copy fallback pages. | OG title/description only; no image, URL, locale, or explicit type. No Twitter configuration. |
| `/p/<slug>` and child pages | `metaTitle || title`; `metaDescription || tagline`. [hosted page:131](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/p/[...segments]/page.tsx:131) | Publisher `canonicalUrl` or generated page URL. HTML alternates for actual published variants + `x-default`; not automatically nine locales. | Both emitted; shared title/description/image, OG locale/type/URL, Twitter card chosen by image availability. |
| `/p/<slug>/privacy`, `/terms` | Metadata function returns `{}` for stored originals: **generic platform title/description**. [hosted page:63](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/p/[...segments]/page.tsx:63) | No canonical or HTML hreflang, despite sitemap policy alternates. | Neither. |
| `/p/<slug>/tools/<order>` | Section heading + root title; section description. [hosted page:69](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/p/[...segments]/page.tsx:69) | No canonical/alternates; `noindex,nofollow`. | Neither. |
| `/app/<appId>` and nested paths | Successful requests redirect; unavailable state inherits root metadata. [launcher:23](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/universal-apps/launcher.tsx:23) | No canonical, alternates, or explicit noindex. Locale-free. | Neither. |
| Related public listing `/[locale]/apps/<id>` | Localized hosted-page copy or app name/tagline; title adds “ - AppAI”. [app detail:28](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/[locale]/apps/[id]/page.tsx:28) | **Every locale canonicalizes to English `/apps/<id>`**; middleware still advertises all locales. | Both emitted, optional logo image. English OG URL unnecessarily contains `/en/`, which redirects. |

**Individual static game pages — branch**

These are independent HTML documents, so they inherit **none** of the root metadata or JSON-LD.

| Game | Initial HTML metadata | Headings and visible copy |
|---|---|---|
| `/games/river-crossing/` | Title: “過河謎題 · River Crossing”. Description: “A handmade 3D river-crossing logic puzzle. Three challenges, one little boat.” OG title/description/type present; no image/URL, Twitter, canonical, hreflang, robots, or JSON-LD. Initial `lang=zh-TW`. `B:public/games/river-crossing/index.html:1` | **0 initial H1s**; canvas + empty app container. JS menu creates one H1, “River Crossing”; intro “A little boat. A handful of friends. A clever way across.” is abstract. Gameplay replaces it with H2; modal headings are H2. `B:public/games/river-crossing/assets/index-Bl9h_YrC.js:1,4229` |
| `/games/guess-duel/` | Title: “Guess Duel · 猜數字對決”. **No description**, canonical, hreflang, OG, Twitter, robots, or JSON-LD. Initial `lang=en`. `B:public/games/guess-duel/index.html:1` | **0 initial H1s**. JS home creates one H1 “Guess Duel”, then H2 player settings and optional H3 scores. Intro “A little logic. A lovely rivalry.” is abstract; “1A2B” adds a concrete game term. Other screens replace headings. `B:public/games/guess-duel/assets/index-B1S2PtUH.js:16,22,33,64` |
| `/games/werewolf/` | Title: “狼人殺”. Chinese description explicitly describes Werewolf, player counts, and hosting modes. No canonical, hreflang, OG, Twitter, robots, or JSON-LD. Initial `lang=zh-TW`. `B:public/games/werewolf/index.html:2,8` | **0 initial H1s**. JS home creates one H1; other screens mainly start at H2. English title becomes “Werewolf”; intro describes app/person hosting. JS changes document title/lang but leaves the Chinese meta description. `B:public/games/werewolf/src/app.js:184,197,642`; `B:public/games/werewolf/src/i18n.js:214` |

**Headings, structured data, and indexability**

“Global graph” below means root `Organization` + `WebSite` + platform `WebApplication`, with nested `ImageObject` and `Offer`. It appears on App Router HTML pages, including hosted pages. [root layout:47](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/layout.tsx:47)

| Surface | H1 count / heading order / search copy | JSON-LD and indexability |
|---|---|---|
| Homepage | **1 H1** → H2 sections → H3 cards/steps. H1 is abstract; intro contains concrete “free landing page”, “privacy policy”, “terms of service”, and “No domain needed”. [home:59](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/[locale]/page.tsx:59) | Global graph + `FAQPage` matching nine visible FAQs. No `SearchAction` or breadcrumbs. No noindex. [home:248](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/[locale]/page.tsx:248) |
| Tools directory | **1 H1**, “Tools”; intro mentions media download/subtitle workflows. App cards use H3 directly after H1, skipping H2. | Global graph only; no directory `ItemList`/`CollectionPage` or breadcrumbs. Indexable; filter query URLs lack canonical control. |
| Apps directory | **1 H1**, default “Explore AppAI”; intro mentions websites, tools, applications. `?kind=apps` changes H1 to “Apps”. Cards can skip H2. | Same as tools. |
| Websites directory | **1 H1**, “Websites” or “Personal pages”; concrete intro: personal sites, portfolios, public project pages. Personal cards use H2; ordinary AppCards use H3. | Same as tools. Directory evidence: [PlatformDirectory:130](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/components/PlatformDirectory.tsx:130), [AppCard:76](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/components/AppCard.tsx:76), [directory copy:22](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/directory-copy.ts:22). |
| Spec endpoints | **0 HTML H1s**; Markdown `#` headings are plain text. Concrete publishing/API instructions. | No JSON-LD, robots meta, or `X-Robots-Tag` in handlers. Crawlable text resources. |
| Games hub **B** | **1 H1**, “Games to play together” → three H2 game names → H3 “How to play”. Intro has concrete logic-puzzle, number-duel, family-party-game phrases. `B:src/app/[locale]/games/page.tsx:29,60,81` | Global graph only; no game `ItemList`, `VideoGame`, breadcrumbs, or FAQ schema. No noindex. |
| Static games **B** | Initial H1 count **0** for all three; JS-dependent content as above. | No JSON-LD, including `VideoGame` or breadcrumbs. No explicit indexing restriction. |
| Hosted roots/children | **Data-dependent, not guaranteed one H1.** Each hero emits H1; profile header emits H1 when named. No hero/profile can mean zero; repeats can mean multiple. Sections follow publisher ordering. Copy can be concrete or purely branded. [renderer:345](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/templates/shared/PageRenderer.tsx:345), [HeroSection:62](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/templates/app-landing/sections/HeroSection.tsx:62), [EditorialSections:86](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/templates/sections/EditorialSections.tsx:86) | Global graph + content/template-derived graph detailed below. Published originals indexable; automatically converted Chinese variants are `noindex,follow`; missing/unpublished pages 404. |
| Hosted legal pages | **1 H1**, “Privacy Policy” or “Terms of Service”; policy body is plain preserved text, not semantic Markdown headings. [hosted page:347](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/p/[...segments]/page.tsx:347) | Global graph + `WebPage` + `BreadcrumbList`. Originals indexable; converted Chinese versions noindex. |
| Hosted fullscreen tool | **0 wrapper H1s**; gated state uses H2. | Global graph only; explicit `noindex,nofollow`. |
| Universal launcher | No rendered content on success; unavailable state has **1 H1**, generic runtime messaging. | Global graph on rendered errors; no app-specific schema/noindex. Valid-looking unavailable IDs return rendered content rather than calling `notFound()`. |
| Public app detail | **1 H1** app name; optional H2 screenshots. Search specificity depends on tagline. | Global graph + `SoftwareApplication`; **wrong schema URL `${baseUrl}/${id}`**, missing `/apps/`. Hardcoded free Offer may be inaccurate. [app detail:96](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/[locale]/apps/[id]/page.tsx:96) |

`WebSite` exists, but **no `SearchAction` is emitted**. There is no corresponding text-search route in these surfaces; adding a fictional search action would be wrong.

**URL behavior and duplication**

| Area | Finding |
|---|---|
| Platform prefixes | Public English URLs are `/`, `/tools`, `/apps`, etc.; `/en/...` adds a redirect. Slash normalization plus locale normalization can add successive hops. Unprefixed URLs can also redirect by language preference. [middleware:197](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/middleware.ts:197); [next-intl behavior](https://next-intl.dev/docs/routing/configuration#localeprefix-as-needed). |
| Directory queries | Category/kind/type variants are crawlable with identical metadata and no canonical/noindex policy; arbitrary ignored parameters add duplicates. [PlatformDirectory:108](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/components/PlatformDirectory.tsx:108) |
| Games **B** | `/games` uses intl; `/games/*` bypasses it. Rewrite maps `/games/:slug` → `/games/:slug/index.html`. Links use **no trailing slash** and append `?locale=en/zh-TW` or Werewolf `?lang=en/zh`. Bare path, language query, and direct `index.html` have no canonical consolidation. `/ja/games/<id>` has no implemented game route. `B:src/middleware.ts:173`; `B:next.config.ts:108`; `B:src/lib/games-catalog.ts:217` |
| Hosted URLs | Independent of platform prefixes: `/p/slug` is that page’s default locale, **not necessarily English**; other locales use `/p/slug/ja`. Root browser detection can redirect to a nondefault variant unless an `appai_locale` cookie exists. [hosted page:261](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/p/[...segments]/page.tsx:261) |
| Launcher | Anonymous `/app/id` → `/login?callbackUrl=...`; login may then undergo intl normalization. Authenticated launch redirects to runtime callback. [launcher:29](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/universal-apps/launcher.tsx:29) |

**B. Sitemap and robots**

| URL set | Current sitemap coverage |
|---|---|
| Platform | `/`, `/apps`, `/websites`, `/tools`, **`/login`**. One `<loc>` each, with nine locale alternates + `x-default`; localized URLs are **not separate `<loc>` entries**. [sitemap:14](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/sitemap.ts:14) |
| Hosted roots | All published database locale rows, using each row’s default/nondefault path; published sibling alternates + `x-default`. [sitemap:52](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/sitemap.ts:52) |
| Hosted children | Included when a published root slug exists; grouped by parent/child slug. **Does not verify that the parent supports each child locale.** [sitemap:60](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/sitemap.ts:60) |
| Privacy/terms | Included for root rows containing policy text; alternates only for siblings with that policy. `x-default` only when the default sibling has it. [sitemap:96](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/sitemap.ts:96) |
| Public app detail | Approved apps without `hostedPageSlug`; one English `<loc>` with all nine alternates + `x-default`. Hosted-linked app details remain accessible but are omitted. [sitemap:151](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/sitemap.ts:151) |
| Games **B** | Adds **only `/games`**, weekly, priority 0.7, with nine alternates + `x-default`. None of the three playable game URLs is included. `B:src/app/sitemap.ts:19` |
| Omitted | `/spec/*`, llms endpoints, fullscreen tool views, `/app/*`, filter URLs, and nonexistent `/tools/*` children. Excluding fullscreen/launcher URLs is appropriate. |

Additional findings:

- Static `lastModified` is `new Date()` at regeneration, not actual content modification time; hosted/app entries use database `updatedAt`. Sitemap revalidates hourly; publishing triggers index revalidation. [sitemap:8,32](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/sitemap.ts:8), [revalidate-seo:7](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/revalidate-seo.ts:7)
- No sitemap pagination, `generateSitemaps`, URL-count guard, or byte-size guard. Published queries are unbounded. Protocol limits are **50,000 URLs / 50 MB uncompressed per sitemap**. [sitemap:170](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/sitemap.ts:170); [protocol](https://www.sitemaps.org/protocol.html).
- Hosted pages with an external `canonicalUrl` are still included under their AppAI URLs; the query does not select/check canonical targets. [sitemap:54](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/sitemap.ts:54)
- Robots allows `/` for everyone and explicitly lists AI/search/social crawlers. Disallows only `/api/`, `/dashboard/`, `/admin/`, `/auth/`; publishes sitemap and host from `NEXTAUTH_URL` or production fallback. [robots:41](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/robots.ts:41)
- Those patterns do **not** cover `/login`, `/app/*`, or locale-prefixed auth URLs such as `/ja/auth/device`. Robots exclusion also does not substitute for noindex on rendered internal pages.

**C. `llms.txt` and `llms-full.txt`**

| Endpoint | Content and game coverage |
|---|---|
| `/llms.txt` | Describes Hosted Page, Wrapped tool, Connected tool, Universal App; authorization, publishing, languages, style, endpoints, and topic links. Appends up to **500 published root locale rows**, grouped by slug, with title/tagline/locales/section types/update date; excludes child listings. [route:13](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/llms.txt/route.ts:13), [route:83](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/llms.txt/route.ts:83) |
| Games in `/llms.txt` | No games hub, named games, static `/games/*` hosting workflow, or rooms API instructions. “Gaming” appears only as a style-kit fit; iframe-tool preset and tools topic are mentioned. Its advertised “29 section types” list also omits `iframe-tool` itself. [route:125,208](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/llms.txt/route.ts:125) |
| `/llms-full.txt` | Serves `AGENT_INSTRUCTIONS.md` verbatim as text, not a full-site content dump. [route:7](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/llms-full.txt/route.ts:7) |
| Games in full spec | Includes iframe tools, gaming permissions, and substantive **room-code multiplayer API** instructions. No games hub catalogue or agent API for uploading static games to `public/games`. [instructions:1141](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/AGENT_INSTRUCTIONS.md:1141), [instructions:1190](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/AGENT_INSTRUCTIONS.md:1190) |
| Branch effect | Games branch changes neither llms endpoint nor the full instructions. Its standalone tip lacks main’s rooms API files: branch is 3 main commits behind / 12 branch commits ahead. Preserve main’s rooms implementation when integrating. |

**D. Hosted-page SEO controls and locale correctness**

| Agent-controlled input | Renderer behavior |
|---|---|
| `title` ≤200, `tagline` ≤500 | Metadata fallbacks; legacy content becomes a hero using these values. |
| `metaTitle` ≤200, `metaDescription` ≤500 | Override document/social title and description. Optional; no minimum quality/keyword requirement. |
| `ogImage`, `heroImage`, `headerLogo`, content images | OG image fallback: `ogImage` → hero image → profile avatar → project screenshot/icon → first screenshot. Header logo controls icons, not the complete social-image fallback. |
| `canonicalUrl` | Overrides canonical and OG URL, including external marketing sites. Does not redirect visitors or rewrite JSON-LD/hreflang/sitemap targets. |
| `locale`, `parentSlug`, `isPublished` | Determine variants, child routes, and publication. Locale validation accepts regex-valid codes beyond the 30 advertised locales. |
| `content.sections` | Controls hero/profile H1, intro, headings, FAQs, downloads, contact/business data, and project lists. |
| Default language | First created variant becomes default; authenticated `POST /api/v1/pages/:slug/set-default?locale=...` changes it. |
| Not exposed | No supported top-level robots/noindex, arbitrary JSON-LD, custom hreflang map, independent OG/Twitter titles/descriptions, Twitter handle, or game-schema fields. |

Sources: [page validation:41](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/validations/page.ts:41), [image fallback:22](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/hosted-page-seo.ts:22), [create default:210](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/api/v1/pages/route.ts:210), [set-default:6](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/api/v1/pages/[slug]/set-default/route.ts:6).

Hosted JSON-LD is **partly template-specific, primarily section-driven**:

| Trigger | Emitted types / issue |
|---|---|
| Default | `WebPage`, language, dates, image, platform publisher/site references. |
| Any `download` section | `SoftwareApplication`, detected iOS/Android, generic category, **hardcoded free Offer**. Browser games/tools without downloads stay `WebPage`; legacy synthesized downloads are not detected here. |
| Root `PERSON` + profile name | `ProfilePage` with `Person`, avatar, sameAs links. |
| Company/contact conditions | Adds `LocalBusiness` and optional `OpeningHoursSpecification`. |
| Project-card sections | Adds `ItemList` / `ListItem`. |
| Child page | Adds `BreadcrumbList`; legal pages separately emit breadcrumbs. |
| Nonempty FAQ section | Independently emits `FAQPage` / `Question` / `Answer`; correctly present, not missing. |
| Game content | No `VideoGame` inference or supported game-specific schema. |

Sources: [hosted-page-seo:31](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/hosted-page-seo.ts:31), [child breadcrumbs:403](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/p/[...segments]/page.tsx:403), [FAQ schema:30](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/templates/app-landing/sections/FaqSection.tsx:30).

Locale/duplicate-content findings:

- Root and child metadata advertise their respective **published** variant sets, with the default mapped to an unqualified URL and `x-default`. Auto-converted Chinese variants are noindex and excluded from those published sets. [metadata:99](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/p/[...segments]/page.tsx:99)
- **Child alternates can point to 404s:** renderer resolves the parent in the explicit locale first; a child translation is unreachable through that locale path if the parent translation is missing. Sitemap checks only that some parent variant exists. [renderer:293](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/p/[...segments]/page.tsx:293)
- **Parent/child defaults can disagree:** metadata builds the child canonical using the child’s default flag, while JSON-LD `pageUrl` uses the resolved parent’s default flag; explicit child locale URLs can therefore disagree across canonical and schema. [metadata:134](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/p/[...segments]/page.tsx:134), [pageUrl:303](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/p/[...segments]/page.tsx:303)
- `/p/slug?lang=ja` **does not select Japanese**: the renderer never reads that query parameter. It renders/redirects by path, cookie, and browser preference. Canonical strips the query, mitigating duplication; explicit `/p/slug/<default-locale>` also renders duplicate content canonicalized to `/p/slug`, without a redirect.
- External canonical overrides leave local hreflang, sitemap, and JSON-LD URLs unchanged, creating inconsistent signals.

**E. Current English homepage strings**

| Element | Exact current value | Source |
|---|---|---|
| `<title>` | “AppAI - AI App Hosting Platform” | [root layout:13](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/layout.tsx:13) |
| Meta description | “Publish AI-built hosted pages and database-capable Universal Apps. AppAI provides review, identity, and managed capabilities.” | [root layout:15](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/app/layout.tsx:15) |
| H1 | “Your AI App deserves” **[line break]** “a home on the web” | [en.json:16](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/messages/en.json:16) |
| Visible intro | “Built an app with AI? Get a free landing page, privacy policy, and terms of service. No domain needed. Let your AI Agent set it up in 30 seconds.” | [en.json:18](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/messages/en.json:18) |

The English messages contain homepage hero/FAQ strings, but **no localized homepage metadata source**. The concrete intro is stronger for search intent than the H1.

**F. Existing game capabilities on main**

| Capability | Actual implementation |
|---|---|
| Native game template/section | **None.** Templates: APP_LANDING, COMPANY_PROFILE, PRODUCT_SHOWCASE, PORTFOLIO, LINK_IN_BIO, PERSON. `GAMES` is a category, not a template or renderer. [validation:52,103](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/validations/page.ts:52) |
| Wrapped games | `iframe-tool` supports externally deployed interactive tools/mini-games, descriptive landing copy, identity opt-in, and fullscreen shell. [registry:550](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/template-registry.ts:550) |
| Allowed iframe sources | HTTPS subdomains of **`*.vercel.app`, `*.pages.dev`, `*.netlify.app`, `*.github.io` only**; arbitrary custom domains and AppAI’s own `/games/*` are not accepted. Hostname check does not separately restrict port. [allowlist:13](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/iframe-tool-allowlist.ts:13) |
| Sandbox | `allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox`; no top-navigation token. |
| `allow=` | Inline: `fullscreen; clipboard-write; gamepad; accelerometer; gyroscope`; disabling fullscreen removes that permission only. Fullscreen shell’s false case instead removes the whole `allow` attribute. [inline:140](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/templates/sections/IframeToolSection.tsx:140), [fullscreen:38](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/templates/sections/IframeToolFrame.tsx:38) |
| Height | Default **600px**, clamped **200–4000px**; origin-checked resize postMessage updates height. Fullscreen shell fills viewport. [inline:40](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/templates/sections/IframeToolSection.tsx:40) |
| Locale/theme/identity | Adds `locale`, `color`, optional `theme=dark`; identity opt-in supplies short-lived `appai_session` for the tool’s backend to introspect. This token is **not** room-creation authentication. [URL builder:67](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/iframe-tool-allowlist.ts:67) |

Rooms API:

| Endpoint | Authentication / external-origin access |
|---|---|
| `POST /api/rooms` | AppAI signed-in browser session required; no API-key or iframe-identity-token creation path. Returns creator seat token. [rooms:301](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/rooms.ts:301), [session adapter:19](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/rooms-server.ts:19) |
| `POST /api/rooms/<code>/join` | No login/API key; room code claims an available seat and returns its token. |
| `GET /api/rooms/<code>?since=...` | Seat `Authorization: Bearer <token>` required; no anonymous public spectator read. |
| `POST .../start` | Creator’s seat-0 bearer token; at least two joined players. |
| `POST .../moves` | Seat bearer token, current version, turn checks; clients supply public state/moves. Server does not validate game-specific rules. |

Sources: [join:339](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/rooms.ts:339), [seat auth:250](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/rooms.ts:250), [poll:370](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/rooms.ts:370), [moves:389](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/rooms.ts:389), [start:443](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/rooms.ts:443).

- CORS allows exact origins `https://appai.info`, `https://www.appai.info`, `https://kycgrayson.github.io`, plus `ROOMS_ALLOWED_ORIGINS`; development allows HTTP localhost/127.0.0.1. Other supplied origins receive 403. Requests without Origin are accepted subject to endpoint auth. [rooms-cors:2](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/rooms-cors.ts:2), [rooms:271](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/rooms.ts:271)
- Preflight allows GET/POST/OPTIONS and Content-Type/Authorization; responses expose Retry-After and use no-store. **No `Access-Control-Allow-Credentials`**, so approved external browser games can join/play with seat tokens but cannot use credentialed cross-origin room creation. [rooms:129](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/rooms.ts:129)
- Database-backed limits: creation **20/hour + 40/day/account**, **60/hour/network**; joins **30/10min/network**; moves/start share **300/10min/network**. Middleware adds per-IP/action **600/min polling**, **60/min writes**; OPTIONS bypasses it. [limits:29](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/rooms.ts:29), [middleware:86](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/middleware.ts:86)
- Generic 2–4-player public-state relay: 8 KiB state, 1 KiB move, six-character codes; hidden answers/cards must stay client-side. [rooms:4](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/src/lib/rooms.ts:4)

Headers/framing:

- Global `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` prevent **all AppAI pages, including branch static games, from being embedded**, even by AppAI itself. Branch adds no exception. [next.config:16,92](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/next.config.ts:16)
- CSP `frame-src` permits self, many deployment hosts, and media providers; this is broader than the four-host iframe-tool renderer allowlist. [next.config:51](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/next.config.ts:51)
- CSP allows same-origin/inline/eval scripts, HTTPS connections, selected font hosts, HTTPS media; camera/microphone/geolocation are disabled by Permissions-Policy. Middleware adds routing/rate limiting, not framing exceptions. [next.config:28](/Users/grayson-mac-studio/GitHub/APPAI-wt-67/next.config.ts:28)

**Prioritized gaps**

| Priority | Gap → one-line fix |
|---|---|
| **P0** | **None confirmed** from source inspection; no demonstrated site-wide indexing block. |
| **P1** | Shared English homepage/directory metadata and missing canonicals → add localized route metadata with normalized self-canonicals and complete social previews. |
| **P1** | Static games have empty initial content, missing SEO fields/schema/sitemap entries → generate crawlable game landing HTML with one H1, concrete intro, canonical, descriptions, social cards, `VideoGame`, and sitemap records. |
| **P1** | Game URL/query/index.html duplicates → choose canonical play/language URLs and redirect aliases while keeping language-specific signals consistent. |
| **P1** | Hosted child alternates can 404 or disagree with schema URLs → validate parent-locale reachability and use one shared root/child URL builder everywhere. |
| **P1** | Hosted legal pages inherit platform metadata → emit policy-specific localized title, description, canonical, and actual policy alternates. |
| **P1** | Public app schema URL is wrong; all locales canonicalize to English → fix `/apps/<id>` schema URLs and align locale canonicals, OG URLs, and alternates. |
| **P1** | Launcher/error/auth surfaces lack indexing policy → add noindex to internal launcher/error/login pages and remove login from sitemap. |
| **P1** | Games branch lacks main’s rooms implementation → integrate onto current main without replacing its room API, CORS, or polling limits. |
| **P2** | Directory filters create uncontrolled crawl variants → define indexable filters and canonical/noindex behavior for the rest. |
| **P2** | Sitemap has synthetic modification dates, no size controls, external-canonical conflicts → use real dates, canonical-aware inclusion, and sharded sitemaps. |
| **P2** | Hosted H1 count/order is unconstrained → add publish-preview warnings for missing/repeated H1s and skipped heading levels. |
| **P2** | Game/docs discovery is incomplete → document owner-managed static games, list the hub/games in llms discovery, and link rooms guidance from the short endpoint. |
| **P2** | Schema is coarse and offers are always free → add accurate product/game classification and publisher-controlled pricing where needed; add breadcrumbs/list schema where applicable. |
| **P2** | Hosted external canonical leaves conflicting local signals → coordinate canonical, hreflang, sitemap inclusion, and JSON-LD URL policy. |
| **P2** | Six games/directory locales serve English copy → translate supported variants or advertise only genuinely localized equivalents. |
| **P2** | Native games cannot be wrapped inside AppAI → if embedding is intended, introduce a narrowly scoped same-origin framing policy and matching renderer support. |