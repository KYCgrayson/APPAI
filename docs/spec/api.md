# AppAI — Authorization & API
The agent obtains a key with the user's approval via device flow; covers key storage, dry-run, image upload and API discovery.
Previous: [Overview](https://appai.info/spec) · Next: [Style & logo](https://appai.info/spec/style)
API base: `https://appai.info`; auth: `Authorization: Bearer appai_sk_YOUR_KEY`.

## Authentication

Device authorization (RFC 8628). **The key is delivered to you by the token
endpoint. Never ask the user to paste a key — if your flow includes that step,
you are doing it wrong.**

```bash
# 1. Ask for a code.
curl -sX POST https://appai.info/api/v1/auth/device
# → { "device_code": "...", "user_code": "LMLT-SVTC",
#     "verification_uri_complete": "https://appai.info/auth/device?code=LMLT-SVTC",
#     "expires_in": 900, "interval": 5 }

# 2. Show the user verification_uri_complete: open it in the user's own browser if you can, and always print it.
#    Also print the returned `user_code` so the user can compare it with the approval page.
#    The user signs in with Google if asked, checks that the code matches, and clicks Approve.
#    Never approve it yourself.
#    The agent receives the key — nothing to copy or paste.

# 3. Poll until it answers.
curl -sX POST https://appai.info/api/v1/auth/token \
  -H 'content-type: application/json' \
  -d '{"device_code":"..."}'
# → { "status": "complete", "api_key": "...", "organization_id": "..." }
```

**Wait `interval` seconds between polls — the one the device response gave you,
not a number you picked.** Polling faster does not fail the request, it raises
your interval by five seconds *permanently* and answers `slow_down` with the new
value. Three impatient polls and you are waiting 20 seconds between attempts,
and the code expires in 15 minutes either way. On `slow_down`, adopt the
`interval` in the response and carry on.

While you wait, `POST /api/v1/auth/token` returns HTTP 400 with an `error`:

| `error` | Meaning | Do |
|---|---|---|
| `authorization_pending` | nobody has approved it yet | keep polling |
| `slow_down` | you polled too fast | take the new `interval`, keep polling |
| `access_denied` | the user declined | stop, and say so |
| `expired_token` | the 15 minutes ran out | stop; start over only if the user asks |
| `invalid_grant` | already used, or not a real code | stop; start over |

### Where the key goes afterwards

Not asking for a paste is only half of it. The key you receive authorises
publishing to the user's whole AppAI account, and **it must not come to rest
inside the project you are building.** A key written to `.env`, `.env.local`, a
config file, or any path under the repository is one `git add -A` from being
published, and agents do run `git add -A`.

Keep it outside the working tree — `~/.config/appai/credentials.json` with mode
`0600` is the conventional place — or hold it only in memory and authorise
again next time. Read `APPAI_API_KEY` from the environment first so CI can
supply one without any of this. If a stored key is ever rejected, discard it and
run the flow again rather than reporting an authentication failure to the user.

After authorization: Hosted Page → [Style & logo](https://appai.info/spec/style); Universal App → return to [Universal App](https://appai.info/spec/apps#natural-release-flow) for the release steps.

## Dry-run

Validate and preview the page before publishing with the same request body.

Publish: [send the validated body](https://appai.info/spec#publish-in-one-minute)

### Preview without saving

**Preview without saving:** `POST /api/v1/pages?dryRun=true` (identical to `POST /api/v1/pages/preview`) — same body; HTTP 200 returns `{valid, errors: [], warnings: [], sanitizedContent, next}`. Always check `valid`; warnings do not block creation. Preview rejects an exact (slug, locale) owned by another organization; it does not check plan limits, parent existence or ownership of the parent root; POST does.

For an existing slug+locale, dry-run with `POST /api/v1/pages?dryRun=true&upsert=true` (or `POST /api/v1/pages/preview?upsert=true`), then publish with `POST /api/v1/pages?upsert=true`. Without `upsert=true`, preview warns that the page already exists; publishing returns 409. Use `PATCH /api/v1/pages/{slug}?locale=xx` for partial updates.

Publish with `POST /api/v1/pages` using the same body and `isPublished: true` (`?upsert=true` to overwrite an existing page). Open `https://appai.info/p/{slug}` and check desktop/mobile layout.

## Upload images

**Upload images:** `POST /api/v1/upload` with `multipart/form-data`, field `file`; allowed MIME types: `image/png`, `image/jpeg`, `image/jpg`, `image/gif`, `image/webp`, `image/svg+xml`; max 5 MB (5 × 1024² bytes). HTTP 201 returns `{url, filename, size, type}`; use the returned `url` as-is in image fields.

## API discovery

`GET /api/v1/sections` returns section schemas and icons (`?format=jsonschema` for JSON Schema; `?type=features,contact` to filter). `GET /api/v1/presets` returns 10 copyable preset examples and 7 named style kits.


## Feedback

`POST /api/v1/feedback` uses the same Bearer API key as page publishing. Body: `{ "kind": "missing_feature", "message": "Describe what you need" }`. Kinds: `missing_feature`, `bug`, `docs`, `other`. Message: 10–4000 characters. Optional: `pageSlug`, `specUrl` (HTTP/HTTPS URL). Contact email comes from the organization's single user, otherwise its earliest ADMIN, otherwise its earliest user (creation time, then ID for ties); never from the body or response.

Limit: 20 submissions per key per rolling 24 hours; also 20 requests per IP per hour. Returns `201 {id}`, `400` invalid input, `401` missing/invalid key or unavailable account ownership, `429` quota exceeded. Both endpoints reject bodies over 16 KB with `413`. The public `/feedback` form requires both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in production; missing keys disable the form and return `503` from the web endpoint. Development may run without Turnstile. Web submissions have a database-enforced global cap of 200 per rolling 24 hours (`429` when exceeded), plus 5 requests per IP per hour. IP limits use process-local middleware buckets.

All topics: [Overview](https://appai.info/spec) · [Authorization & API](https://appai.info/spec/api) · [Style & logo](https://appai.info/spec/style) · [Theme](https://appai.info/spec/theme) · [Typography](https://appai.info/spec/typography) · [Pages](https://appai.info/spec/pages) · [Sections](https://appai.info/spec/sections) · [Multi-language & multi-page](https://appai.info/spec/i18n) · [Tools](https://appai.info/spec/tools) · [Universal App](https://appai.info/spec/apps)
