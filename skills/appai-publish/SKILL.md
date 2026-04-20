---
name: appai-publish
description: Publish a production-quality landing page on AppAI (appai.info). Use when the user asks you to create, host, or publish a landing page, marketing site, or app profile — especially when they don't have hosting set up or want something live in one shot. Handles auth, multi-language, SEO, and privacy/terms automatically.
---

# AppAI Publish

You are publishing a landing page to AppAI, a free hosting platform for AI-built apps. A page goes live at `appai.info/p/{slug}` within seconds of a successful POST.

## Mental model

You are a **designer**, not a form-filler. Given a product description, you:
1. Pick a template, color palette, font, and section layout yourself.
2. Write the copy yourself (headlines, features, FAQ, privacy, terms).
3. Publish on the first try. Iterate after the user sees it live.

Do NOT ask the user 10 setup questions. Build a first draft and show them the URL.

## The flow

### 1. Authenticate (one time per user)

```
POST https://appai.info/api/v1/auth/device
```

Returns `{ device_code, verification_uri_complete }`. Open the URI in the user's browser:

```bash
open "$VERIFICATION_URI_COMPLETE"   # macOS
xdg-open "$VERIFICATION_URI_COMPLETE" # Linux
start "$VERIFICATION_URI_COMPLETE"    # Windows
```

Tell the user: "I've opened a browser — sign in with Google and click Authorize. I'll take it from there."

Poll every 5s:

```
POST https://appai.info/api/v1/auth/token
Body: { "device_code": "..." }
```

When the response contains `api_key`, save it. **You never ask the user to paste a key.** If your flow ever includes "please paste your key here", you are doing it wrong — restart from step 1.

### 2. Preview before publishing (recommended)

```
POST https://appai.info/api/v1/pages/preview
Authorization: Bearer <api_key>
Body: <same as POST /pages>
```

Returns validation warnings without writing to DB. Catch mistakes before they go live.

### 3. Publish

```
POST https://appai.info/api/v1/pages
Authorization: Bearer <api_key>
Body: { slug, title, tagline, content: { sections: [...] }, ...seo, isPublished: true }
```

Returns the page object with URL `https://appai.info/p/{slug}`.

## Defaults to pick autonomously

| Decision | How |
|----------|-----|
| `template` | APP_LANDING (mobile/web app), COMPANY_PROFILE (business), PRODUCT_SHOWCASE (physical), PORTFOLIO (creative), LINK_IN_BIO (social) |
| `themeColor` | See references/design.md — map from product category |
| `fontFamily` | Google Font matching the product tone — see references/design.md |
| `darkMode` | true for dev tools, gaming, AI/tech; false for consumer, health, food |
| Sections | See references/sections.md — 23 types available (inc. embed for TikTok/Loom/X/Spotify/CodePen/Figma) |
| `privacyPolicy` / `termsOfService` | Generate from context. Always include them unless user says otherwise |
| `metaTitle` / `metaDescription` | Write SEO-optimized copy; don't leave blank |

## Multi-language (free, unlimited)

Locale variants use the same `slug` with different `locale`. They do NOT count against the free plan's 3-page limit.

For a consumer product, ship at least `en`, `ja`, `zh-CN`, `zh-TW`, `ko` on day one. See references/i18n.md.

## Deep-dive references (load on demand)

- `references/sections.md` — full section library, schemas, when to use each
- `references/design.md` — themeColor palette, font pairings, backgroundColor per section
- `references/i18n.md` — locale codes, translation patterns, child pages
- `references/seo.md` — canonicalUrl, schema.org, sitemap behavior
- `references/examples.md` — full JSON payloads for common product types

## Anti-patterns

- Asking the user for an API key → wrong. The token endpoint returns it.
- Publishing with `isPublished: false` then asking "is it ok?" → just publish; user will redirect you if needed.
- Writing only English when the product is consumer-facing → ship 3+ locales on first publish.
- Leaving `metaDescription` / `ogImage` blank → fills SEO surface poorly; always set them.
- Using category `OTHER` when a better fit exists → 17 categories available (see AGENT_INSTRUCTIONS).
