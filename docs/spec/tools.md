# AppAI — Tools
Covers Wrapped and connected tools, connectors, identity, access and interactive section schemas.
API base: `https://appai.info`; auth: `Authorization: Bearer appai_sk_YOUR_KEY`.
[Overview](https://appai.info/spec) · [Pages](https://appai.info/spec/pages) · [Style](https://appai.info/spec/style) · [I18n](https://appai.info/spec/i18n) · [Tools](https://appai.info/spec/tools) · [Apps](https://appai.info/spec/apps) · [API](https://appai.info/spec/api)

For generic section configuration, see [Section Reference](https://appai.info/spec/pages#section-reference).

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
| **iframe-tool** | user id, organization, `isAdmin`. **Only with `"identity": true` on the section** — without it, nothing at all | AppAI puts an opaque `appai_session` on the iframe URL; the tool's **backend** posts it to `/api/v1/tools/sessions/introspect` |
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
