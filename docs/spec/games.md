# AppAI — Games
Publish an original browser game on your own host with an AppAI page, SEO shell and optional application for /games.
Previous: [Universal App](https://appai.info/spec/apps)
API base: `https://appai.info`; auth: `Authorization: Bearer appai_sk_YOUR_KEY`.

## Publish a game in one minute

| Step | Action |
|---|---|
| 1. Host | Deploy the game yourself to GitHub Pages, Cloudflare Pages, Vercel or Netlify. AppAI does not host, build or upload game files. Allow embedding from `https://appai.info`; see [framing headers](https://appai.info/spec/tools#wrapped-tool-publishing-checks). |
| 2. Authorize | Follow [device authorization](https://appai.info/spec/api#authentication) in the overview. Reuse your key; never put it in game files. |
| 3. Compose | Use `template: "GAME"` and one `game` section. `GAME` renders `title` as the page H1 and `tagline` below it; do not add a hero. Other templates may also contain `game`, with a hero or named profile-header supplying their H1. |
| 4. Preview | `POST /api/v1/pages?dryRun=true` with the complete body below, or start with the [GAME example](https://appai.info/spec/examples/game.example.json). Replace example URLs, logo and copy; inspect `valid`, `errors`, `warnings`, `sanitizedContent`. Fix errors and warnings, then preview again. |
| 5. Publish | `POST /api/v1/pages` with the same body and `isPublished: true`. For an existing slug use `?dryRun=true&upsert=true`, then `?upsert=true`. Partial updates use `PATCH /api/v1/pages/{slug}?locale=en`. |
| 6. Visit | Game page URLs currently use `/p/{slug}`; they will later move to `/games/{slug}` with redirects from `/p/{slug}`. No new game URL is required today. |

Complete, valid request body (replace these demo assets and the game URL):

```json
{
  "slug": "little-pattern-trail",
  "template": "GAME",
  "locale": "en",
  "title": "Little Pattern Trail",
  "tagline": "A short original pattern puzzle to play while waiting for food.",
  "metaDescription": "Spot repeating shapes together on one phone at a restaurant or in a waiting room. Free browser play with no download.",
  "themeColor": "#A5B4FC",
  "themeColorSecondary": "#67E8F9",
  "fontFamily": "Space Grotesk",
  "darkMode": true,
  "isPublished": true,
  "content": {
    "logo": "https://appai.info/spec/examples/placeholder-logo.png",
    "sections": [{
      "type": "game",
      "order": 0,
      "data": {
        "gameUrl": "https://little-pattern-trail.pages.dev/",
        "backgroundColor": "#0F172A",
        "description": "Find the repeating shapes and tap the next one. Take turns explaining each pattern with your child while waiting for food.",
        "genre": "Puzzle",
        "orientation": "portrait",
        "aspectRatio": "9:16",
        "players": { "min": 1, "max": 2 },
        "controls": ["touch"],
        "howToPlay": ["Look at the repeating shapes.", "Tap the next shape.", "Take turns, or pause whenever you need."],
        "ageRating": "all",
        "cover": { "url": "https://appai.info/spec/examples/placeholder-screen.svg", "alt": "Colorful shape trail", "width": 1200, "height": 630 },
        "listInGames": true,
        "faq": [{ "question": "What games can we play while waiting for food?", "answer": "Try a short pattern trail together on one phone. Pause when your meal arrives." }]
      }
    }]
  }
}
```

Publish four variants with the same slug: `en` first (default), then `zh-TW`, `zh-CN`, `es`. Translate page copy, instructions, FAQ and metadata; pass each locale through dry-run. Use `Noto Sans TC` / `Noto Sans SC` for the Chinese pages. Choose optional additional languages only when the user requests them. See the [overview](https://appai.info/spec) for logo/style and privacy/terms guidance.

## What you can build

| Allowed | Not allowed |
|---|---|
| Original browser puzzles, educational games, party games and your own presentation of public-domain rules | Cloning existing games, names, artwork or distinctive presentation |
| Local computation and assets you own or may redistribute | Calling paid AI services during play |
| Anonymous play; optional AppAI identity | Collecting personal information |
| A focused, playable experience | External tracking scripts or advertising scripts |
| Family-friendly play | Real-money gambling, adult content or requiring an executable download |

## game

Each section is `{ "type": "game", "order": 0, "data": { ... } }`. Fields below belong in `data`. `gameUrl` and `howToPlay` are required for every game section. The listing column marks additional fields required when applying for `/games`; missing listing fields produce warnings. Text lengths are character limits; strings must be non-empty when supplied.

| Field | Format / limit | Required for /games |
|---|---|---|
| `gameUrl` | Required; HTTPS URL, max 2048; host matches `*.github.io`, `*.pages.dev`, `*.vercel.app`, `*.netlify.app` | Yes |
| `heading` | Optional H2, 1–200 characters; game name in JSON-LD defaults to page `title` | No |
| `description` | 1–2000 characters; visible, specific summary | Yes |
| `genre` | 1–100 characters, e.g. `Puzzle` | Yes |
| `orientation` | `portrait`, `landscape`, `any`; default `any`; describes preferred orientation, does not lock the device | Yes |
| `aspectRatio` | `width:height`, each integer 1–99, e.g. `9:16`; default `9:16` for portrait, otherwise `16:9`; resize messages may adjust height | Yes |
| `players` | `{ "min": 1, "max": 2 }`; integers 1–16, min ≤ max; room-code play supports 2–4 | Yes |
| `controls` | 1–3 unique strings from `touch`, `keyboard`, `gamepad` | Yes |
| `howToPlay` | Required; array of 1–10 strings, each 1–500 characters | Yes |
| `ageRating` | `all`, `7+`, `12+` | Yes |
| `cover` | `{ "url": "https://...", "alt": "...", "width": 1200, "height": 630 }`; URL max 2048, alt 1–200; optional width/height integers 1–10000 | Yes |
| `listInGames` | Boolean, default false; true = **apply for inclusion in /games**, pending review | — |
| `identity` | Boolean, default false; only true requests an iframe-tool session | No |
| `access` | Optional `login` or `admin`, same section gate as iframe-tool | No |
| `faq` | Optional array, max 20 `{question, answer}` pairs; question 1–300, answer 1–2000 (Markdown supported) | No |
| `leaderboards` | Optional array, max 10; unique `id` (1–40 lowercase letters/digits/hyphens), `name` (1–100), `sortOrder` (`asc` or `desc`), optional `unit` (1–40); no other keys. Format warnings only; stored declarations do not create boards | No |
| `id`, `backgroundColor` | Shared section anchor/background fields | No |

Invalid game URLs or field formats (including more than 10 steps) block publishing. Dry-run also returns warnings for an unsupported host, missing H1, missing how-to-play, missing description, incomplete listing application or malformed leaderboards; warnings may accompany `valid: false`. Leaderboard declaration errors alone do not block publishing. Slugs reserved by the existing games catalog are unavailable, including `river-crossing`, `guess-duel`, `werewolf`, `covers`, `profile`, `boards`.

## Parameters and messages

| Direction | Contract |
|---|---|
| AppAI → iframe URL | `locale` (current hosted-page BCP 47 code), `color` (theme hex), `theme=dark` only in dark mode. Ignore unsupported locales gracefully. |
| Game → parent | `parent.postMessage({ type: "ready" }, "https://appai.info")` when ready |
| Game → parent | `parent.postMessage({ type: "resize", height: 720 }, "https://appai.info")`; finite pixel heights clamp to 200–4000 |
| Parent → game, identity opt-in only | `{ type: "appai:session", token, expiresAt }` via postMessage on load and renewal. After sign-in the parent reissues and resends the session; when the parent stays open, returning focus refreshes it without reloading the game. |
| Game → parent, identity opt-in only | `parent.postMessage({ type: "appai:session-request" }, "https://appai.info")` requests the current session |
| Game → its own backend | Send the token as `X-AppAI-Session: <token>`; never put it in game API URLs or public storage. `game` does not add the token to its iframe URL. |
| Backend → AppAI | `POST /api/v1/tools/sessions/introspect` with JSON `{ "token": "<token>", "origin": "https://your-game.pages.dev" }`; same identity semantics as [iframe-tool](https://appai.info/spec/tools#identity-what-each-rung-can-learn-about-the-visitor). A game session is not a room-seat token. |

Check both `event.origin === "https://appai.info"` and `event.source === parent` before accepting parent messages. Without `identity: true`, no session is issued. With opt-in, anonymous visitors can receive an active session with `user: null`. Identity exposes an opaque user id, organization and `isAdmin`, not name/email. The iframe keeps the existing iframe-tool sandbox and permissions. Fullscreen play expands the current game without changing its URL or resetting its state.

## Room-code multiplayer

**Only approved games may call the room API.** Publishing or applying for `/games` does not grant access. Use the existing rooms implementation; an externally hosted game must wait for its supported origin/access to be enabled. Room creation currently requires AppAI sign-in and a same-origin AppAI cookie; `X-AppAI-Session` does not replace that cookie. Approved external origins can join, poll, start and move using room-seat tokens. See [room behavior and errors](https://appai.info/spec/tools#room-code-multiplayer-rooms-api).

| Endpoint | Request | Success |
|---|---|---|
| `POST /api/rooms` | Signed-in creator; `{ "game": "my-game", "seats": 2, "state": {}, "turn": 0 }` | `201 { code, seat: 0, token, room }` |
| `POST /api/rooms/{code}/join` | `{}` | `200 { seat, token, room }` |
| `GET /api/rooms/{code}?since={version}` | `Authorization: Bearer <room token>` | `{ changed: true, seat, room }` or `{ changed: false, version, seats }` |
| `POST /api/rooms/{code}/start` | Host seat 0; `Authorization: Bearer <room token>`; at least 2 players present | `{ room }` |
| `POST /api/rooms/{code}/moves` | `Authorization: Bearer <room token>`; `{ "version": 3, "move": {}, "state": {}, "nextTurn": 1, "end": false }` | `{ room }` |

| Public rule | Value |
|---|---|
| Players | 2–4; `seats` defaults to 2; seat indices start at 0 |
| Game id | 1–40 lowercase letters, digits or hyphens |
| State | ≤ 8 KB JSON (8192 bytes), object or array; public information only |
| One move | ≤ 1 KB JSON (1024 bytes); never send secret answers or private cards |
| Turns | Use the latest room version; handle `version_conflict` by reading the returned room. Clients validate game rules. |
| Poll | Every 1–1.5 seconds when visible, 15 seconds when hidden; obey `Retry-After` on 429 |
| Credentials | Store each room-seat token per room, never in a URL; no publisher API key in the game |

## Size and performance

These are **recommended values**, not publishing validators.

| Recommendation | Target |
|---|---|
| First load | ≤ 5 MB total |
| Mobile layout | No horizontal scrolling at 375px |
| Audio | Do not autoplay audible content |
| Interruptions | Support pause so a family can stop when food arrives or their turn is called |

## Review and listing

| Action / state | Visible result |
|---|---|
| Publish with `isPublished: true` | Immediately live at `/p/{slug}`; absent from `/games` |
| Set `listInGames: true` | Application is pending; API returns `gamesListing: "requested"`. The request is saved in page JSON; it does not change the games catalog. |
| Review approved | Eligible for inclusion in `/games`; publishing alone never implies approval |
| Review rejected | A reason is provided; revise the game and apply again |

This publishing contract saves applications only. Review decisions, notifications and listing management are separate; there is no review workflow endpoint in this topic.

## SEO writing

| Element | Write it this way |
|---|---|
| H1 | One clear game name: `GAME` uses page `title`. Other templates need one hero or named profile-header. |
| Description | Say what players do, device/players and the short play context. Include how-to-play in the page, outside the iframe. |
| Cover | Recommended 1200×630 with meaningful alt text; also set `ogImage` if a different sharing image is needed |
| Structured data | Automatic `VideoGame`: name, description, genre, Web browser platform, play mode, player range, age audience, language and hosted page URL. `faq` reuses the `FAQPage` mechanism. No platform free Offer is attached. |
| FAQ | Answer real parent questions; use only phrases that describe the game accurately, without repeating keywords mechanically |

Parent search contexts: **games to play while waiting in line**, **games to play at a restaurant**, **games to play at dinner table**, **games to play while waiting for food**, **waiting room games**, **free online games for kids**. Chinese intent: 等餐、排隊、看診時跟孩子玩的免費益智小遊戲.

| Example FAQ question | Useful answer content |
|---|---|
| What games can we play at a restaurant while waiting for food? | Explain short rounds, one-phone controls and how to pause |
| Is this a waiting room game for parents and kids? | Explain quiet play, age suitability and whether sound can be muted |
| Is this a free online game for kids? | State the actual cost and browser/no-download behavior |

## Leaderboards

Coming soon

All topics: [Overview](https://appai.info/spec) · [Authorization & API](https://appai.info/spec/api) · [Style & logo](https://appai.info/spec/style) · [Theme](https://appai.info/spec/theme) · [Typography](https://appai.info/spec/typography) · [Pages](https://appai.info/spec/pages) · [Sections](https://appai.info/spec/sections) · [Multi-language & multi-page](https://appai.info/spec/i18n) · [Tools](https://appai.info/spec/tools) · [Universal App](https://appai.info/spec/apps) · [Games](https://appai.info/spec/games)
