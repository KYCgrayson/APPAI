# AppAI Agent Instructions

You are an **AppAI publisher**. AppAI (appai.info) has two first-class publishing modes: **Hosted Pages** for professional, mobile-responsive public pages at `https://appai.info/p/{slug}`, and **Universal Apps** for full applications — including database-backed workflows — that launch at `https://appai.info/app/{appId}` after platform review.

**Your mindset:** First identify the product shape. When a user wants a public site, be a designer rather than a form-filler: gather the minimum context and **build a complete Hosted Page first draft immediately**. When a user needs an application with persistent data, app-specific UI/API/business rules, or managed private assets, use the Universal App flow instead of trying to express the product as page sections.

**API Base URL:** `https://appai.info` (always use this, never `www.appai.info`)


## Pick the rung first (30 seconds, before anything else)

AppAI exists so a user who built something does not have to register a domain or
run infrastructure. Capability is a ladder. **Place the request on the lowest
rung that satisfies it** — going heavier costs the user review time and buys
nothing.

| The user has / wants | Rung | What you write |
|---|---|---|
| A product to describe, no running software | **[Hosted Page](https://appai.info/spec/pages)** | `POST /api/v1/pages` with sections |
| A tool they already deployed (`*.vercel.app`, `*.pages.dev`, `*.netlify.app`, `*.github.io`) | **[Wrapped tool](https://appai.info/spec/tools)** | Hero + `iframe-tool` + 1-2 supporting sections. Their deploy keeps running where it is; AppAI adds the SEO shell, locale, theme, the `access` gate, and — with `"identity": true` — a verifiable identity for the visitor |
| A tool that needs a server, a secret, login, or rate limits | **[Connected tool](https://appai.info/spec/tools)** | Same as above, plus `apiBase: "/api/connect/{connector}"` and `"access": "login"` on the section |
| Persistent data, own schema, business rules (inventory, orders, settlement) | **[Universal App](https://appai.info/spec/apps)** | `appai.app.json` manifest → `POST /api/v1/apps/{appId}/releases` → review → `/app/{appId}` |

Two limits worth knowing up front, so you never promise them:

- **AppAI does not host arbitrary code.** There is no "upload my repo and run it"
  path. Either the tool runs on the user's own free host and you wrap it, or it
  becomes a reviewed Universal App with a declared manifest.
- **You cannot add a new backend.** Connectors hold secrets and are
  owner-maintained. You reference one by name; you never create one. If a tool
  needs a backend that does not exist yet, say so — that is an owner task.

Use the [topic pages](https://appai.info/spec#topic-pages) for details on the rung you picked.

## Publish in one minute

1. **Get a key:** use the device flow in [Authentication](https://appai.info/spec/api#authentication); send `Authorization: Bearer appai_sk_YOUR_KEY` on API requests.
2. **Pick a preset:** `GET /api/v1/presets` returns copyable full POST bodies in `example`, section recipes, and named `styles`.

| Type | Preset id | Example POST body |
|---|---|---|
| Mobile app | `app-landing` | [JSON](https://appai.info/spec/examples/app-landing.example.json) |
| SaaS | `saas-landing` | [JSON](https://appai.info/spec/examples/saas-landing.example.json) |
| Personal site | `profile` | [JSON](https://appai.info/spec/examples/profile.example.json) |
| Link hub | `link-in-bio` | [JSON](https://appai.info/spec/examples/link-in-bio.example.json) |
| Portfolio | `portfolio` | [JSON](https://appai.info/spec/examples/portfolio.example.json) |
| Event | `event` | [JSON](https://appai.info/spec/examples/event.example.json) |
| Company / service | `company-service` | [JSON](https://appai.info/spec/examples/company-service.example.json) |
| Product | `product` | [JSON](https://appai.info/spec/examples/product.example.json) |
| Hiring / job opening | `hiring` | [JSON](https://appai.info/spec/examples/hiring.example.json) |
| Wrapped tool | `iframe-tool` | [JSON](https://appai.info/spec/examples/iframe-tool.example.json) |

3. **MUST READ before publishing — [Style & logo](https://appai.info/spec/style):** open it, pick a style kit, and check the logo spec. Dry-run warns (with this link) when `themeColor` or `fontFamily` is missing.
4. **Brand it:** add a real logo — square 512×512 PNG with its own background in `content.logo`, uploaded with `POST /api/v1/upload` (rules: [Logo](https://appai.info/spec/style#logo)). Copy `themeColor`, `fontFamily`, `darkMode` from a [style kit](https://appai.info/spec/style); use its suggested backgrounds for section `data.backgroundColor`.
5. **Pre-flight:** `POST /api/v1/pages?dryRun=true` (alias: `POST /api/v1/pages/preview`) with the full body. Review `{valid, errors, warnings, sanitizedContent, next}`; fix errors and unknown section/field warnings before publishing. Nothing is saved. Find schemas with `GET /api/v1/sections?type=features,contact` (comma list supported). `dryRun` accepts true/1/yes or false/0/no case-insensitively; other non-empty values return 400.
6. **Publish:** `POST /api/v1/pages` with the same body (`?upsert=true` to overwrite an existing page).
7. **Open:** `https://appai.info/p/{slug}` and check desktop/mobile layout.

Copy this complete request body into both the dry-run and publish POSTs. Change the slug, copy, and **replace the demo logo with the real logo**:

```json
{"slug":"company-service-demo","template":"COMPANY_PROFILE","title":"Cedar Workshop","tagline":"Clear websites for independent businesses.","themeColor":"#047857","fontFamily":"Lato","isPublished":true,"content":{"logo":"https://appai.info/spec/examples/placeholder-logo.png","sections":[{"order":0,"type":"hero","data":{"headline":"Cedar Workshop","subheadline":"Clear websites for independent businesses.","logo":"https://appai.info/spec/examples/placeholder-logo.png","variant":"centered","heroHeight":"medium","ctaText":"Book a discovery call","ctaUrl":"https://example.com/book"}},{"order":1,"type":"about","data":{"id":"details","heading":"From first sketch to launch","text":"We help independent teams define their message, design a clear website, and launch with confidence. Start with a focused discovery session and leave with a practical plan."}},{"type":"features","data":{"heading":"Services","items":[{"icon":"sparkles-outline","title":"Website design","description":"Accessible websites for independent businesses."}]},"order":2},{"type":"about","data":{"heading":"Opening hours","text":"Monday–Friday: 09:00–17:00. Weekends: closed."},"order":3},{"type":"contact","data":{"heading":"Talk to Cedar","email":"hello@example.com","formUrl":"https://example.com/contact"},"order":4},{"order":5,"type":"cta","data":{"headline":"Book a discovery call","subheadline":"Clear websites for independent businesses.","buttonText":"Book a discovery call","buttonUrl":"https://example.com/company-service"}}]},"locale":"en","darkMode":false}
```


## Topic pages

Use this guide to choose a topic or jump directly to a reference.

## Document Guide

| Page / need | URL / reference | Covers |
|---|---|---|
| Pages | https://appai.info/spec/pages | Page configuration, sections, CRUD and workflow |
| Style | https://appai.info/spec/style | Style kits, logo and visual design |
| I18N | https://appai.info/spec/i18n | Languages, child pages and navigation |
| Tools | https://appai.info/spec/tools | Wrapped/connected tools, identity and interactive schemas |
| Apps | https://appai.info/spec/apps | Manifests, releases, review and runtime |
| Api | https://appai.info/spec/api | Auth, discovery, uploads and preview |
| **Complete page examples** | [Publish in one minute](https://appai.info/spec#publish-in-one-minute) preset table (`/spec/examples/*.example.json`) | |
| **Section JSON schemas (all section types)** | [Section Reference](https://appai.info/spec/pages#section-reference) or call `GET /api/v1/sections` | |
| **Authentication flow** | [Authentication](https://appai.info/spec/api#authentication) | |
| **Preset recipes and implied template** | `GET /api/v1/presets` | |
| **Page creation API fields** | [Creating a Page](https://appai.info/spec/pages#creating-a-page) | |
| **Multi-language setup** | [Multi-Language Details](https://appai.info/spec/i18n#multi-language-details) | |
| **Multi-page site setup** | [Multi-Page Site Details](https://appai.info/spec/i18n#multi-page-site-details) | |
| **CRUD operations** | [Managing Pages](https://appai.info/spec/pages#managing-pages-crud) | |
| **Privacy/Terms generation** | [Compliance Pages](https://appai.info/spec/pages#compliance-pages) | |
| **Icons reference** | [Icons](https://appai.info/spec/pages#icons) | |
| **Design inspiration** | Browse https://appai.info/apps to see live pages | |

## Old section → new page

| Old section | New URL |
|---|---|
| What You Can Build (read this first) | https://appai.info/spec/pages#what-you-can-build-read-this-first |
| Page-Level Configuration | https://appai.info/spec/pages#page-level-configuration |
| Directory classification | https://appai.info/spec/pages#directory-classification |
| 29 Section Types | https://appai.info/spec/pages#29-section-types |
| Auto-Generated Features | https://appai.info/spec/pages#auto-generated-features |
| How to Work with the User | https://appai.info/spec/pages#how-to-work-with-the-user |
| Your default workflow | https://appai.info/spec/pages#your-default-workflow |
| Page shape per intent | https://appai.info/spec/pages#page-shape-per-intent |
| Person site recipe | https://appai.info/spec/pages#person-site-recipe |
| What to decide yourself (do NOT ask the user) | https://appai.info/spec/pages#what-to-decide-yourself-do-not-ask-the-user |
| When to ask the user | https://appai.info/spec/pages#when-to-ask-the-user |
| Rules | https://appai.info/spec/pages#rules |
| Creating a Page | https://appai.info/spec/pages#creating-a-page |
| Compliance Pages | https://appai.info/spec/pages#compliance-pages |
| Managing Pages (CRUD) | https://appai.info/spec/pages#managing-pages-crud |
| Icons | https://appai.info/spec/pages#icons |
| Section Reference | https://appai.info/spec/pages#section-reference |
| profile-header | https://appai.info/spec/pages#profile-header |
| project-cards | https://appai.info/spec/pages#project-cards |
| entries | https://appai.info/spec/pages#entries |
| hero | https://appai.info/spec/pages#hero |
| video | https://appai.info/spec/pages#video |
| features | https://appai.info/spec/pages#features |
| screenshots | https://appai.info/spec/pages#screenshots |
| download | https://appai.info/spec/pages#download |
| pricing | https://appai.info/spec/pages#pricing |
| testimonials | https://appai.info/spec/pages#testimonials |
| faq | https://appai.info/spec/pages#faq |
| gallery | https://appai.info/spec/pages#gallery |
| team | https://appai.info/spec/pages#team |
| schedule | https://appai.info/spec/pages#schedule |
| sponsors | https://appai.info/spec/pages#sponsors |
| stats | https://appai.info/spec/pages#stats |
| contact | https://appai.info/spec/pages#contact |
| cta | https://appai.info/spec/pages#cta |
| links | https://appai.info/spec/pages#links |
| about | https://appai.info/spec/pages#about |
| embed | https://appai.info/spec/pages#embed |
| Link rel (SEO) | https://appai.info/spec/pages#link-rel-seo |
| Visual Design Capabilities | https://appai.info/spec/style#visual-design-capabilities |
| Logo | https://appai.info/spec/style#logo |
| Multi-Language (free, automatic) | https://appai.info/spec/i18n#multi-language-free-automatic |
| Multi-Page Sites | https://appai.info/spec/i18n#multi-page-sites |
| Multi-Language Details | https://appai.info/spec/i18n#multi-language-details |
| Multi-Page Site Details | https://appai.info/spec/i18n#multi-page-site-details |
| How the site nav is built (automatic) | https://appai.info/spec/i18n#how-the-site-nav-is-built-automatic |
| Compliance pages: recommended flags | https://appai.info/spec/i18n#compliance-pages-recommended-flags |
| Interactive tools that need a backend, login, or quota | https://appai.info/spec/tools#interactive-tools-that-need-a-backend-login-or-quota |
| Identity: what each rung can learn about the visitor | https://appai.info/spec/tools#identity-what-each-rung-can-learn-about-the-visitor |
| iframe-tool identity, end to end | https://appai.info/spec/tools#iframe-tool-identity-end-to-end |
| action | https://appai.info/spec/tools#action |
| form | https://appai.info/spec/tools#form |
| media-downloader | https://appai.info/spec/tools#media-downloader |
| video-subtitle | https://appai.info/spec/tools#video-subtitle |
| tool | https://appai.info/spec/tools#tool |
| pdf-viewer | https://appai.info/spec/tools#pdf-viewer |
| iframe-tool | https://appai.info/spec/tools#iframe-tool |
| simple-order | https://appai.info/spec/tools#simple-order |
| Universal apps | https://appai.info/spec/apps#universal-apps |
| Natural release flow | https://appai.info/spec/apps#natural-release-flow |
| Copyable database app example | https://appai.info/spec/apps#copyable-database-app-example |
| Database runtime contract | https://appai.info/spec/apps#database-runtime-contract |
| Required app authentication chrome and logout | https://appai.info/spec/apps#required-app-authentication-chrome-and-logout |
| Document Guide | https://appai.info/spec#document-guide |
| Authentication | https://appai.info/spec/api#authentication |
| Where the key goes afterwards | https://appai.info/spec/api#where-the-key-goes-afterwards |
| Pick the rung first (30 seconds, before anything else) | https://appai.info/spec#pick-the-rung-first-30-seconds-before-anything-else |
| Publish in one minute | https://appai.info/spec#publish-in-one-minute |

Complete text in one file: https://appai.info/llms-full.txt
