---
name: appai-publish
description: Start at https://appai.info/spec — publish Hosted Pages, Wrapped tools, Connected tools, and Universal Apps on AppAI with device authorization, style and logo selection, validation, and the appropriate publishing flow.
---

# AppAI Publish

Start at https://appai.info/spec — choose the simplest use-case that fits, build a first draft with minimum context, then iterate. The live specification is the source of truth; use https://appai.info/llms-full.txt as the complete single-file fallback.

| Use-case | Meaning |
|---|---|
| [Hosted Page](https://appai.info/spec/pages) | A product, business or person to describe — a public page at appai.info/p/{slug}. |
| [Wrapped tool](https://appai.info/spec/tools) | A tool already deployed elsewhere (Vercel, Cloudflare Pages, Netlify, GitHub Pages) — AppAI wraps it in a page with SEO, language and theme. |
| [Connected tool](https://appai.info/spec/tools) | A tool that needs a backend, login or quota — wrapped as above and connected to an owner-maintained connector. |
| [Universal App](https://appai.info/spec/apps) | Persistent data and business rules — a reviewed app manifest that runs at appai.info/app/{appId}. |

AppAI does not host arbitrary code or provide an unrestricted upload-and-run path. Tools keep running on their existing host; Universal Apps require platform review. Agents cannot add new backends or connectors: reference an existing owner-maintained connector, and tell the user when an owner must supply one.

## Authorization for every use-case

Follow [Authorization & API](https://appai.info/spec/api). Read `APPAI_API_KEY` from the environment first, then check for a securely stored key outside the working tree. Reuse a valid key; discard a rejected stored key and run device flow.

1. Request a code with `POST https://appai.info/api/v1/auth/device`.
2. Show the user verification_uri_complete: open it in the user's own browser if you can, and always print it. Also print the returned `user_code` so the user can compare it with the approval page. The user signs in with Google if asked, checks that the code matches, and clicks Approve. Never approve it yourself. The agent receives the key — nothing to copy or paste.
3. Poll `POST https://appai.info/api/v1/auth/token` using the returned device code at the returned `interval`; on `slow_down`, adopt the new `interval`. Follow the API topic's stopping rules for denial, expiry and invalid codes.

Never ask the user to paste a key. Keep the received key only in memory or outside the working tree (conventionally `~/.config/appai/credentials.json` with mode `0600`), never in the project, including environment files. See [key storage](https://appai.info/spec/api#where-the-key-goes-afterwards). API requests send `Authorization: Bearer <key>`. Do not print credentials. Use `https://appai.info` as the API base, never the www host.

## Hosted Page flow

1. **Authorize** using the flow above.
2. **MUST READ https://appai.info/spec/style before publishing** to pick a style kit and check the logo requirements, then read [Theme](https://appai.info/spec/theme) and [Typography](https://appai.info/spec/typography) to choose text size, text contrast and optional per-role overrides. Take `themeColor`, `themeColorSecondary`, `fontFamily` (Chinese variants: `Noto Sans TC`/`Noto Sans SC`), and `darkMode` from that kit, and use the style kit's suggested backgroundColors. Use the kit’s `fontFamily` for `en` and `es`, `Noto Sans TC` for `zh-TW`, and `Noto Sans SC` for `zh-CN`; for other CJK languages chosen by the user, choose the matching font (e.g. `Noto Sans JP` for Japanese). Keep `themeColor`, `themeColorSecondary`, `darkMode` and the kit’s suggested backgroundColors the same across variants. If the user has no logo, create a simple square 512×512 PNG following the Logo rules, upload it with `POST /api/v1/upload`, then publish. A missing logo only warns and never blocks publishing. Replace demo assets. When choosing a different kit than the example’s, replace all kit values together: `themeColor`, `themeColorSecondary`, `fontFamily`, `darkMode`, and every section `backgroundColor`. Child pages use the same kit, with fonts per the language rule. Without a drawing tool, make the 512×512 logo from a simple SVG (solid background plus an initial or simple shape), convert it to PNG with `rsvg-convert -w 512 -h 512 logo.svg -o logo.png` (or sips, ImageMagick, or a headless browser screenshot), then upload.
3. **Page:** read [Pages](https://appai.info/spec/pages), choose a preset through `GET /api/v1/presets`, and build a complete first draft. Each preset returns `example`, a complete POST body ready to send directly to dry-run; replace demo copy, logo and links, and write `metaDescription`, `privacyPolicy` and `termsOfService` per locale before publishing. Use the current `/spec/examples/*.example.json` bodies linked from the [overview](https://appai.info/spec#publish-in-one-minute), such as [company-service](https://appai.info/spec/examples/company-service.example.json), rather than remembered payloads. For person sites, start at [Person site recipe](https://appai.info/spec/pages#person-site-recipe).
4. **Sections:** read [Sections](https://appai.info/spec/sections) and discover current schemas and icons through `GET /api/v1/sections`. Interactive sections are detailed in [Tools](https://appai.info/spec/tools). Do not invent section types or fields. Use `cta` only on landing-type pages: app, product, SaaS, company/service, event and hiring. Do not add it to PERSON/profile, link-in-bio, portfolio, card-wall or wrapped-tool pages.
5. **Dry-run:** send the full body to `POST /api/v1/pages?dryRun=true`, following [dry-run guidance](https://appai.info/spec/api#dry-run). Check validity, errors, warnings and sanitized content. Fix errors and unknown section/field warnings; dry-run again after changes. For an existing slug+locale, use `POST /api/v1/pages?dryRun=true&upsert=true`; without `upsert=true`, preview warns that the page already exists. Nothing is saved, and dry-run does not check every publishing constraint.
6. **Publish:** send the same validated body to `POST /api/v1/pages` with `isPublished: true`. To update an existing page, use `POST /api/v1/pages?upsert=true` after the dry-run with `?dryRun=true&upsert=true`. Partial updates remain `PATCH /api/v1/pages/{slug}?locale=xx`. Use the [Pages CRUD guidance](https://appai.info/spec/pages#managing-pages-crud) for updates or intentional replacement.
7. **Open** `https://appai.info/p/{slug}`, check desktop/mobile layout, and give the user the live URL. Iterate with PATCH as requested.

Hosted Pages are always published in four locales: English (`en`), Traditional Chinese (`zh-TW`), Simplified Chinese (`zh-CN`) and Spanish (`es`). Publish all four without asking the user. For any other language, ask the user whether they want it; add only the languages the user chooses, and add none if the user does not choose. Do not wait for that answer before publishing the four.

Publish `en` first; `en` is the default locale. Then publish `zh-TW`, `zh-CN`, and `es`. Send each locale as its own POST request with the same slug and `locale`; dry-run every locale body before publishing it. Publish child pages (`my-app-faq`, `my-app-contact`, `my-app-delete-account`, …) in all four locales with `parentSlug`. Put translated privacy policy and terms in each variant’s `privacyPolicy` / `termsOfService`, not in child pages. Later updates target a locale with `?locale=`, e.g. `PATCH /api/v1/pages/{slug}?locale=zh-TW`. See [Multi-language & multi-page](https://appai.info/spec/i18n). Prefix every child slug with its root slug because `(slug, locale)` is unique across the whole platform; an unprefixed `contact` can collide with another user’s page.

Infer the page shape and copy from the user's product and audience. Ask only for missing product facts, specific branding, whether to add languages beyond the four defaults, or genuine tradeoffs. Do not invent pricing, experience, testimonials, metrics or contact details. Keep copy and compliance text grounded in the supplied facts.

## Tools

Read [Tools](https://appai.info/spec/tools) before configuring a Wrapped tool or Connected tool, then use the Hosted Page flow for its surrounding page. Use `iframe-tool` for the user's deployed tool, [`embed`](https://appai.info/spec/sections#embed) for media posts, and `tool` for form-input-to-backend processing. Check the topic's supported hosts, identity, access and connector requirements before promising behavior. A Connected tool uses an existing owner-maintained connector; a missing backend is an owner task.

## Universal App

Read [Universal App](https://appai.info/spec/apps) and authorize as above. Add `appai.app.json` at the app root; `package.json` must define `test` and `typecheck` scripts. Publish an immutable source package as the primary publishing input, excluding secrets and build output. A Git repository is optional provenance.

Request a private upload intent with `POST /api/v1/apps/{appId}/release-packages`, retain `uploadId`, upload the exact package bytes, and compute their SHA-256 digest. Submit the matching manifest through `POST /api/v1/apps/{appId}/releases` with `source: { type: "package", uploadId, digest, sizeBytes }`.

Keep the `PENDING` receipt and `releaseId`: it awaits AppAI platform review. An AppAI administrator starts the managed pipeline; the app's `test`, `typecheck`, and declared build command must pass in isolation. Poll `GET /api/v1/apps/{appId}/releases/{releaseId}`. Launch at `https://appai.info/app/{appId}` only after `APPROVED` and an `ACTIVE` production deployment.

AppAI supplies the isolated runtime at `https://{appId}.appai.info` with a one-time identity handoff. Agents cannot choose a runtime domain. Follow the topic's runtime identity, account header and logout contract. Never submit organizationId, credentials, runtime URLs, raw SQL or secrets.

## Guidance to load when relevant

- [Design judgment](references/design.md): selecting a visual direction.
- [Section judgment](references/sections.md): keeping a page focused.
- [Examples](references/examples.md): adapting current examples.
- [Languages and child pages](references/i18n.md): translation and navigation judgment; configuration is at [Multi-language & multi-page](https://appai.info/spec/i18n).
- [SEO judgment](references/seo.md): choosing a primary site and writing useful metadata.
- [Universal App publishing](references/universal-apps.md): package upload and release details.
