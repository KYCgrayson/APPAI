# AppAI — Tools
Covers Wrapped tool and Connected tool configuration, connectors, identity, access and interactive section schemas, and the rooms API for room-code multiplayer games.
Previous: [Multi-language & multi-page](https://appai.info/spec/i18n) · Next: [Universal App](https://appai.info/spec/apps)
API base: `https://appai.info`; auth: `Authorization: Bearer appai_sk_YOUR_KEY`.

Use `simple-order` only for an order + payment flow with a supplied `notificationEmail`; for message orders, use a plain link following [Contact](https://appai.info/spec/pages#contact).

For generic section configuration, see [Section Reference](https://appai.info/spec/sections#section-reference).

### Interactive tools that need a backend, login, or quota

Some tool sections talk to a real backend and need login gating, per-user
quotas, or server-side secrets (e.g. `video-subtitle`). The platform handles
all of that declaratively — **you never write a proxy, table, or quota
logic**:

- **Backend calls** go through the generic connector proxy: set the section's
  `apiBase` to `"/api/connect/{connector}"`. The proxy injects server auth +
  the caller's identity, records usage, and enforces quota. Connectors are
  owner-defined in `src/lib/connectors/registry.ts` (they hold secrets, so
  they are not agent-writable); you reference one by name.
- **Login gating**: add `"access": "login"` to the section's `data`. Anonymous
  visitors get a platform sign-in prompt in place of the section. `"access":
  "admin"` is the same gate one step further: signing in is not enough, the
  visitor has to be an administrator of the site. Both gates also cover the
  fullscreen tool URL, so neither is a thing you can walk around.
  **A gated section still occupies its place on the page** — blocked visitors
  get a card saying which wall they hit, never a gap. The hero and FAQ around it
  are describing this tool; a hole where the tool should be reads as a broken
  page, not a closed door. So write the surrounding sections for everyone, and
  let the gate speak for itself.
- **Quota**: declared on the connector (`per user/ip`, `limit`, `window`);
  admins are exempt. Enforced automatically by the proxy.
- **Large files do not go through the proxy.** It reads the whole upstream
  response into memory to forward it. That is fine for JSON and a subtitle file
  and fatal for a video. A backend that returns big files must return a
  short-lived **signed URL** and let the browser fetch it directly; the proxy
  passes a 3xx straight through for exactly this.

If a tool needs a genuinely new backend, the **owner** adds one connector
entry; every reuse after that is pure section config. See
`docs/interactive-tools-architecture.md`.

### Identity: what each rung can learn about the visitor

A tool that asks the visitor to paste a key has failed, and so has the platform
that made it do that. AppAI signs people in once. How much of that identity
reaches your tool depends on the [rung](https://appai.info/spec#pick-the-rung-first-30-seconds-before-anything-else) — so **read this before you pick one**, not
after you have built the thing. Choosing `iframe-tool` and discovering later that
it cannot tell an admin from a stranger means rewriting, not patching.

| Rung | What the tool can know | How it gets it |
|---|---|---|
| Hosted Page | nothing | there is no tool to tell |
| **Wrapped tool** (`iframe-tool`) | user id, organization, `isAdmin`. **Only with `"identity": true` on the section** — without it, nothing at all | AppAI puts an opaque `appai_session` on the iframe URL; the tool's **backend** posts it to `/api/v1/tools/sessions/introspect` |
| Connected tool | the same, plus `X-AppAI-User` / `X-AppAI-Admin` injected on every proxied call | the connector proxy holds a server secret, which is what makes those headers worth anything |
| Universal App | a full runtime session; the `identity` capability additionally releases name and email | launch code → `POST /api/runtime/sessions/exchange` → `POST /api/runtime/sessions/introspect` |

Name and email are never released below the [Universal App rung](https://appai.info/spec#pick-the-rung-first-30-seconds-before-anything-else), because nothing
below it has a capability grant to release them with. An `iframe-tool` gets an
opaque user id, which is enough to recognise a returning user and to scope their
data, and not enough to build a mailing list.

Three rules that hold everywhere:

- **Never carry identity in a URL parameter you invented.** `?user=alice`,
  `?admin=1`, a JWT you signed yourself — the visitor can edit all of them. If
  identity matters, it comes from an AppAI introspection call and nowhere else.
- **Never trust an `X-AppAI-*` header** unless a shared bearer token already
  proved the request came from the proxy. A browser can send any header it likes.
- **Anonymous is an answer, not a failure.** `{"active": true, "user": null}`
  means "AppAI is talking to you, and nobody is signed in" — which is different
  from getting no token at all, and your tool decides what to do about it.

#### iframe-tool identity, end to end

Opt the section in:

```jsonc
{ "type": "iframe-tool", "order": 2, "data": {
    "heading": "Batch Console",
    "description": "...",
    "src": "https://acme-tools.vercel.app/console",
    "identity": true,          // default false; existing pages are unaffected
    "access": "admin"          // optional: who may see the section at all
}}
```

AppAI renders the frame at
`https://acme-tools.vercel.app/console?locale=…&color=…&appai_session=…`.
The tool's frontend reads `appai_session` and sends it to **its own backend**,
which asks AppAI who that is:

```bash
POST https://appai.info/api/v1/tools/sessions/introspect
Content-Type: application/json

{ "token": "<appai_session>", "origin": "https://acme-tools.vercel.app" }
```

```json
{
  "active": true,
  "user": { "id": "usr_...", "name": null, "email": null },
  "organization": { "id": "org_...", "name": "..." },
  "isAdmin": true,
  "page": { "slug": "batch-console", "section": 2 },
  "expiresAt": "2026-01-01T00:10:00.000Z"
}
```

- `origin` is your backend naming **itself**. That binding is what stops another
  tool embedded on the same page from replaying a visitor's token against you.
- The token is opaque, signed by AppAI and short-lived (10 minutes). A visitor
  who edits it in the URL gets `{"active": false}` — this is standard token
  introspection (RFC 7662), so verification is a call, never a parse.
- Long-running tools do not have to reload: AppAI reissues before expiry and
  posts the new token into the frame as
  `{ type: "appai:session", token, expiresAt }`. Listen for it (checking
  `event.origin === "https://appai.info"`), and if you ever find yourself
  without one, post `{ type: "appai:session-request" }` up to `parent` and you
  will be sent the current one.
- **This needs a backend of your own.** Introspection is server-to-server and
  sends no CORS headers, on purpose: a check a browser could skip is not a check.
  A purely static tool can display who is signed in, but it cannot enforce
  anything, and it should not pretend to.

### action
```json
{ "type": "action", "order": 18, "data": {
    "heading": "Actions",
    "items": [
      { "label": "Trigger Deploy", "url": "https://your-api.com/deploy", "method": "POST", "confirmText": "Are you sure?", "style": "primary" }
    ]
}}
```
Styles: `primary` (filled), `secondary` (outlined), `danger` (red).

### form
```json
{ "type": "form", "order": 19, "data": {
    "heading": "Contact us",
    "fields": [
      { "type": "email", "name": "email", "label": "Your email", "required": true },
      { "type": "textarea", "name": "message", "label": "Message", "required": true }
    ],
    "submitTo": "mailto:support@yourdomain.com",
    "submitLabel": "Send",
    "successMessage": "Thanks! We'll get back to you soon."
}}
```
Field types: `text`, `email`, `tel`, `textarea`, `select`. submitTo: `mailto:...` (client-side mail) or `https://...` (server-side webhook relay).

### media-downloader
```json
{ "type": "media-downloader", "order": 20, "data": {
    "heading": "Media Downloader",
    "description": "Download videos from 1000+ platforms.",
    "apiBase": "https://your-api.trycloudflare.com",
    "apiToken": "your_token"
}}
```
Requires a yt-dlp backend API with `POST /download` and `GET /file/{id}` endpoints.

### video-subtitle
```json
{ "type": "video-subtitle", "order": 21, "data": {
    "heading": "YouTube Subtitle Studio",
    "description": "Paste a link, get a translated, subtitled video.",
    "apiBase": "https://subtitle.myaiapp.uk/v1"
}}
```
Requires the Video Subtitle backend service implementing the AppAI Video Subtitle API (OpenAPI 3.1 — job kinds `transcribe` + `render`, AIP-151 LRO, RFC 7807 errors). MVP caps the trim window at 5 minutes and uses one embedded subtitle font (Noto Sans JP).

### tool
```json
{ "type": "tool", "order": 21, "data": {
    "heading": "PDF Merger",
    "description": "Merge multiple PDFs into one.",
    "apiBase": "https://your-api.com",
    "apiEndpoint": "/merge-pdf",
    "fields": [
      { "type": "file", "name": "files", "label": "Upload PDFs", "accept": ".pdf", "multiple": true, "maxSizeMB": 50 }
    ],
    "submitLabel": "Merge PDFs"
}}
```
Field types: `text`, `url`, `password`, `file` (with `accept`, `multiple`, `maxSizeMB`), `select`, `toggle` (button group with `options`). API should return `download_url`, `preview_url`, or `message`.

### pdf-viewer
```json
{ "type": "pdf-viewer", "order": 22, "data": {
    "heading": "PDF Viewer",
    "description": "View and unlock password-protected PDFs. Runs entirely in your browser."
}}
```
Fully client-side using pdf.js. No backend needed.

### iframe-tool
```json
{ "type": "iframe-tool", "order": 24, "data": {
    "heading": "Wheel Spinner",
    "description": "A weighted random picker for groups, raffles, and classroom warm-ups.",
    "features": ["Configurable segments", "Sound + haptics", "Works offline"],
    "src": "https://my-tools.vercel.app/wheel-spinner",
    "initialHeight": 720
}}
```
For embedding a tool deployed to a free static host. `src` host must be `*.vercel.app`, `*.pages.dev`, `*.netlify.app`, or `*.github.io` — anything else is rejected. `heading` and `description` are required (iframe content is invisible to crawlers — these get indexed). AppAI auto-passes `?locale=...&color=...&theme=dark` to the iframe so it can match the page. Every section also gets a chrome-less fullscreen URL at `/p/{slug}/tools/{order}` for sharing the tool standalone. The tool can opt-in to auto-resize via `parent.postMessage({type:'resize', height})`.

Two optional fields decide who may use it and what it is told about them:

- `"identity": true` adds an `appai_session` to the iframe URL, which the tool's own backend trades for the visitor's id, organization and `isAdmin` at `/api/v1/tools/sessions/introspect`. Default is false, and false means the tool learns **nothing** — do not try to make up for that with a URL parameter of your own, because visitors can edit those. See **Identity: what each rung can learn about the visitor**.
- `"access": "login"` or `"access": "admin"` gates the section itself; the fullscreen URL obeys the same gate.

### simple-order
```json
{ "type": "simple-order", "order": 25, "data": {
    "heading": "Place an order",
    "description": "Enter your items, complete payment, and the owner will confirm quantity and date by email.",
    "storeName": "Sunny Bakery",
    "notificationEmail": "orders@example.com",
    "paymentUrl": "https://line.me/R/ti/p/@yourline",
    "paymentHeading": "Please complete payment",
    "paymentInstructions": "After payment, submit this order. The shop owner will confirm quantity and date, then reply by email.",
    "currency": "TWD",
    "submitLabel": "I paid, send order",
    "successMessage": "Order sent. The owner will confirm quantity and date by email."
}}
```
For small shops that need an order request flow hosted entirely on AppAI. Customers type free-form line items, quantity, unit price, and preferred date. AppAI calculates subtotals and totals in the browser, shows the configured LINE/payment link, and sends an owner notification after the customer confirms payment. This does not automatically verify payment.

### Wrapped tool publishing checks
The tool stays on the user's host; AppAI does not build or deploy it. Before publishing run `curl -sI https://your-tool.vercel.app` (check the final response after redirects). Fix blocking headers on the user's host: remove X-Frame-Options DENY/SAMEORIGIN and set `Content-Security-Policy: frame-ancestors 'self' https://appai.info`. Preserve other CSP directives.

Minimal vercel.json:
```json
{"headers":[{"source":"/(.*)","headers":[{"key":"Content-Security-Policy","value":"frame-ancestors 'self' https://appai.info"}]}]}
```
Netlify `_headers`: under `/*`, add `  Content-Security-Policy: frame-ancestors 'self' https://appai.info`.
Cloudflare Pages `_headers`: under `/*`, add `  Content-Security-Policy: frame-ancestors 'self' https://appai.info`.

Sandbox: `allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox`. The existing scripts/same-origin model is restricted to allowlisted external hosts; no top navigation token. Permissions `allow`: `fullscreen; clipboard-write; gamepad; accelerometer; gyroscope`; `allowFullscreen:false` removes only fullscreen. Downloads generated in-browser and clipboard writes are permitted (browser permission/user activation rules still apply).

The iframe receives `?locale=` with the current hosted-page locale, normally `en`, `zh-TW`, `zh-CN`, `es` (any supplied BCP 47 locale is passed unchanged), plus `color` and `theme=dark` only in dark mode. If the tool isn't translated, ignore it; the AppAI page around it is still published in four locales.
Set canonicalUrl only for an app's own primary marketing site (e.g. a custom domain homepage), never the *.vercel.app tool URL embedded in iframe-tool.

### Room-code multiplayer (rooms API)
Turn-based games for 2–4 players, each on their own device. One device creates a room and shows a 6-character code, and the others type it in. No login and no API key are needed. The server keeps only **public** game state. Secrets such as a hidden answer or a hand of cards stay on the device that owns them and never go in `state` or `move`. The server does not check game rules, so every client must validate the moves it receives.

| Call | Request | Response |
|---|---|---|
| Create | `POST /api/rooms` `{ "game": "my-game", "seats": 2, "state": {}, "turn": 0 }` | `201 { code, seat: 0, token, room }` |
| Join | `POST /api/rooms/{code}/join` `{}` | `200 { seat, token, room }` · `409 room_full` |
| Poll | `GET /api/rooms/{code}?since={version}` + `Authorization: Bearer {token}` | `200 { changed: true, seat, room }` or `{ changed: false, version, seats }` |
| Move | `POST /api/rooms/{code}/moves` + `Authorization: Bearer {token}` `{ "version": 3, "move": {}, "state": {}, "nextTurn": 1, "end": false }` | `200 { room }` |

`room` = `{ code, game, version, state, turn, seats: [{ seat, joined, online, idleSeconds }], moves: [{ version, seat, move, skipped? }], lastMove, status: "waiting" | "playing" | "finished", expiresAt }`.

| Rule | Value |
|---|---|
| Code | 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`; input is case-insensitive, and spaces and `-` are ignored |
| `game` | 1–40 characters of `a-z`, `0-9`, `-` |
| Players | `seats` 2–4 (default 2). Seats fill in join order (0, 1, 2, 3). `turn` is a seat index, or `null` for no turn order (default 0) |
| Size | `state` ≤ 8 KB of JSON (object or array), `move` ≤ 1 KB, nesting ≤ 64 levels, no NUL characters |
| Moves | Compare-and-swap: `version` must equal the room's current version, and success increments it. Only the seat whose `turn` it is may move. Omit `nextTurn` to keep the turn; `end: true` finishes the room. Moves start once every seat has joined. `moves` holds the last 20, so read every entry with `version > since`, not just `lastMove` |
| Presence | Each poll marks your seat as seen. `online` means seen in the last 30 s; `idleSeconds` is the time since that seat was last seen |
| Timeout | When the seat whose turn it is has been idle for ≥ 120 s, any other seat may send `{ "version": v, "skip": true }` (optionally with a `move` note). The turn passes to the next seat, and the entry records `skipped`. A skip cannot carry `state`, `nextTurn` or `end`. A player who returns keeps their seat |
| Lifetime | A room that is not full expires 30 minutes after creation. A full room closes after 15 minutes with no polls or moves, and in any case 24 hours after creation. Afterwards it is `404 room_not_found` |
| Polling | Every 1–1.5 s while the page is visible; every 15 s while it is hidden, so the player is not marked idle. A closed app counts as idle. On `429`, wait for `Retry-After` |
| Token | Store it per room (e.g. `localStorage["room:{code}"]`) so a reload keeps the seat. Never put it in a URL. A wrong token gets the same `404` as a missing room |
| Origins | Browser calls are accepted from `https://appai.info`, `https://www.appai.info` and `https://kycgrayson.github.io`; other origins get `403 origin_not_allowed`. Ask the owner to add a game's origin |

Errors are `{ "error": code, "message": text }`:

| Status | Codes |
|---|---|
| 400 | `invalid_request` |
| 403 | `origin_not_allowed` |
| 404 | `room_not_found` |
| 409 | `room_full`, `room_not_ready`, `room_finished`, `version_conflict`, `not_your_turn` (the last two include the latest `room`) |
| 413 | `state_too_large` |
| 429 | `rate_limited` |
| 503 | `unavailable` |

Hidden-information pattern (e.g. guess-the-number): the guesser sends `move: { "guess": "1234" }, "nextTurn": 1`. The owner's device scores the guess locally and replies with `move: { "reply": "1A2B" }, "nextTurn": 0`. To prove the answer was fixed in advance, put `sha256(answer + salt)` in the initial `state` and reveal `salt` with `end: true`.

All topics: [Overview](https://appai.info/spec) · [Authorization & API](https://appai.info/spec/api) · [Style & logo](https://appai.info/spec/style) · [Theme](https://appai.info/spec/theme) · [Typography](https://appai.info/spec/typography) · [Pages](https://appai.info/spec/pages) · [Sections](https://appai.info/spec/sections) · [Multi-language & multi-page](https://appai.info/spec/i18n) · [Tools](https://appai.info/spec/tools) · [Universal App](https://appai.info/spec/apps)
