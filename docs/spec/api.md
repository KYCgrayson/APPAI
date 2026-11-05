# AppAI — API
Covers Authentication, API discovery, uploads and page preview endpoints.
API base: `https://appai.info`; auth: `Authorization: Bearer appai_sk_YOUR_KEY`.
[Overview](https://appai.info/spec) · [Pages](https://appai.info/spec/pages) · [Style](https://appai.info/spec/style) · [I18n](https://appai.info/spec/i18n) · [Tools](https://appai.info/spec/tools) · [Apps](https://appai.info/spec/apps) · [API](https://appai.info/spec/api)

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

# 2. Open verification_uri_complete in the user's browser. Print it too — you
#    cannot assume there is a browser on the machine you are running on.

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

### Preview without saving

**Preview without saving:** `POST /api/v1/pages/preview` (alias: `POST /api/v1/pages?dryRun=true`) — same body; HTTP 200 returns `{valid, errors: [], warnings: [], sanitizedContent, next}`. Always check `valid`; warnings do not block creation. Preview rejects an exact (slug, locale) owned by another organization; it does not check plan limits, parent existence or ownership of the parent root; POST does.

### Upload images

**Upload images:** `POST /api/v1/upload` with `multipart/form-data`, field `file`; allowed MIME types: `image/png`, `image/jpeg`, `image/jpg`, `image/gif`, `image/webp`, `image/svg+xml`; max 5 MB (5 × 1024² bytes). HTTP 201 returns `{url, filename, size, type}`; use the returned `url` as-is in image fields.
