# AppAI Agent Instructions

Start at https://appai.info/spec — the short overview for AppAI publishers.
Next: [Authorization & API](https://appai.info/spec/api).

**Your mindset:** First identify the product shape. When a user wants a public site, be a designer rather than a form-filler: gather the minimum context and **build a complete Hosted Page first draft immediately**. When a user needs an application with persistent data, app-specific UI/API/business rules, or managed private assets, use the Universal App flow instead of trying to express the product as page sections.

**API Base URL:** `https://appai.info` (always use this, never `www.appai.info`)


## Pick the rung first (30 seconds, before anything else)

AppAI exists so a user who built something does not have to register a domain or
run infrastructure. Capability is a ladder. **Place the request on the lowest
rung that satisfies it** — going heavier costs the user review time and buys
nothing.

| Use-case | Meaning | Signals | What you write |
|---|---|---|---|
| [Hosted Page](https://appai.info/spec/pages) | A product, business or person to describe — a public page at appai.info/p/{slug}. | No running software | `POST /api/v1/pages` with sections |
| [Wrapped tool](https://appai.info/spec/tools) | A tool already deployed elsewhere (Vercel, Cloudflare Pages, Netlify, GitHub Pages) — AppAI wraps it in a page with SEO, language and theme. | `*.vercel.app`, `*.pages.dev`, `*.netlify.app`, `*.github.io` | Hero + `iframe-tool` + 1-2 supporting sections. Their deploy keeps running where it is; AppAI adds the SEO shell, locale, theme, the `access` gate, and — with `"identity": true` — a verifiable identity for the visitor |
| [Connected tool](https://appai.info/spec/tools) | A tool that needs a backend, login or quota — wrapped as above and connected to an owner-maintained connector. | A server, a secret, login or rate limits | Same as above, plus `apiBase: "/api/connect/{connector}"` and `"access": "login"` on the section |
| [Universal App](https://appai.info/spec/apps) | Persistent data and business rules — a reviewed app manifest that runs at appai.info/app/{appId}. | Persistent data, own schema, business rules (inventory, orders, settlement), private assets, full UI + API | `appai.app.json` manifest → `POST /api/v1/apps/{appId}/releases` → review → `/app/{appId}` |

Two limits worth knowing up front, so you never promise them:

- **AppAI does not host arbitrary code.** There is no "upload my repo and run it"
  path. Either the tool runs on the user's own free host and you wrap it, or it
  becomes a reviewed Universal App with a declared manifest.
- **You cannot add a new backend.** Connectors hold secrets and are
  owner-maintained. You reference one by name; you never create one. If a tool
  needs a backend that does not exist yet, say so — that is an owner task.

Use the [topic pages](https://appai.info/spec#topic-pages) for details on the rung you picked.

## Publish in one minute

Hosted Pages are always published in four locales: English (`en`), Traditional Chinese (`zh-TW`), Simplified Chinese (`zh-CN`) and Spanish (`es`). Publish all four without asking the user. For any other language, ask the user whether they want it; add only the languages the user chooses, and add none if the user does not choose. Do not wait for that answer before publishing the four.

1. **[Authorization & API](https://appai.info/spec/api):** Show the user verification_uri_complete: open it in the user's own browser if you can, and always print it. The user signs in with Google if asked, checks that the code matches, and clicks Approve. Never approve it yourself. The agent receives the key — nothing to copy or paste. Use the [device flow](https://appai.info/spec/api#authentication); send `Authorization: Bearer appai_sk_YOUR_KEY` on API requests.
2. **MUST READ before publishing — [Style & logo](https://appai.info/spec/style):** open it, pick a style kit, and check the logo spec. Dry-run warns (with this link) when `themeColor` or `fontFamily` is missing. Add a real logo — square 512×512 PNG with its own background in `content.logo`, uploaded with `POST /api/v1/upload` (rules: [Logo](https://appai.info/spec/style#logo)). Copy `themeColor`, `themeColorSecondary`, `fontFamily`, `darkMode` from a style kit; use the style kit's suggested backgroundColors for section `data.backgroundColor`.
3. **[Pages](https://appai.info/spec/pages):** pick a preset. `GET /api/v1/presets` returns copyable full POST bodies in `example`, section recipes, and named `styles`. Build a complete first draft.
4. **[Sections](https://appai.info/spec/sections):** use the section schemas and icons. Find schemas with `GET /api/v1/sections?type=features,contact` (comma list supported).
5. **[Dry-run](https://appai.info/spec/api#dry-run):** `POST /api/v1/pages?dryRun=true` (identical to `POST /api/v1/pages/preview`) with the full body. Review `{valid, errors, warnings, sanitizedContent, next}`; fix errors and unknown section/field warnings before publishing. Nothing is saved. `dryRun` accepts true/1/yes or false/0/no case-insensitively; other non-empty values return 400.
6. **Publish:** `POST /api/v1/pages` with the same body (`?upsert=true` to overwrite an existing page).
7. **Open:** `https://appai.info/p/{slug}` and check desktop/mobile layout.

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

Copy this complete request body into both the dry-run and publish POSTs. Change the slug, copy, and **replace the demo logo with the real logo**:

```json
{"slug":"company-service-demo","template":"COMPANY_PROFILE","title":"Cedar Workshop","tagline":"Clear websites for independent businesses.","themeColor":"#047857","fontFamily":"Lato","isPublished":true,"content":{"logo":"https://appai.info/spec/examples/placeholder-logo.png","sections":[{"order":0,"type":"hero","data":{"headline":"Cedar Workshop","subheadline":"Clear websites for independent businesses.","logo":"https://appai.info/spec/examples/placeholder-logo.png","variant":"centered","heroHeight":"medium","ctaText":"Book a discovery call","ctaUrl":"https://example.com/book"}},{"order":1,"type":"about","data":{"id":"details","heading":"From first sketch to launch","text":"We help independent teams define their message, design a clear website, and launch with confidence. Start with a focused discovery session and leave with a practical plan."}},{"type":"features","data":{"heading":"Services","items":[{"icon":"sparkles-outline","title":"Website design","description":"Accessible websites for independent businesses."}]},"order":2},{"type":"about","data":{"heading":"Opening hours","text":"Monday–Friday: 09:00–17:00. Weekends: closed."},"order":3},{"type":"contact","data":{"heading":"Talk to Cedar","email":"hello@example.com","formUrl":"https://example.com/contact"},"order":4},{"order":5,"type":"cta","data":{"headline":"Book a discovery call","subheadline":"Clear websites for independent businesses.","buttonText":"Book a discovery call","buttonUrl":"https://example.com/company-service"}}]},"locale":"en","darkMode":false}
```


## Topic pages

| Page | URL | Covers |
|---|---|---|
| Authorization & API | https://appai.info/spec/api | Agent authorization, key storage, dry-run, image upload and API discovery |
| Style & logo | https://appai.info/spec/style | Style kits, logo and visual design |
| Pages | https://appai.info/spec/pages | Page configuration, CRUD and workflow |
| Sections | https://appai.info/spec/sections | Section schemas and icons |
| Multi-language & multi-page | https://appai.info/spec/i18n | Languages, child pages and navigation |
| Tools | https://appai.info/spec/tools | Wrapped tool, Connected tool, identity and interactive schemas |
| Universal App | https://appai.info/spec/apps | Universal App manifests, releases, review and runtime |

## Document Guide

| Need | URL / reference | Notes |
|---|---|---|
| **Complete page examples** | [Publish in one minute](https://appai.info/spec#publish-in-one-minute) preset table (`/spec/examples/*.example.json`) | |
| **Section JSON schemas (all section types)** | [Section Reference](https://appai.info/spec/sections#section-reference) or call `GET /api/v1/sections` | |
| **Authentication flow** | [Authentication](https://appai.info/spec/api#authentication) | |
| **Preset recipes and implied template** | `GET /api/v1/presets` | |
| **Page creation API fields** | [Creating a Page](https://appai.info/spec/pages#creating-a-page) | |
| **Multi-language setup** | [Multi-Language Details](https://appai.info/spec/i18n#multi-language-details) | |
| **Multi-page site setup** | [Multi-Page Site Details](https://appai.info/spec/i18n#multi-page-site-details) | |
| **CRUD operations** | [Managing Pages](https://appai.info/spec/pages#managing-pages-crud) | |
| **Privacy/Terms generation** | [Compliance Pages](https://appai.info/spec/pages#compliance-pages) | |
| **Icons reference** | [Icons](https://appai.info/spec/sections#icons) | |
| **Design inspiration** | Browse https://appai.info/apps to see live pages | |

Complete single-file fallback: https://appai.info/llms-full.txt
