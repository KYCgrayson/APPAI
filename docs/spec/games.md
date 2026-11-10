# AppAI — Games
Build one standalone browser game, publish its AppAI page, and understand the current listing and multiplayer limits.
Previous: [Universal App](https://appai.info/spec/apps)
API base: `https://appai.info`; auth: `Authorization: Bearer appai_sk_YOUR_KEY`.

## One game = one standalone unit

A game is a playable program plus a page that explains it. Keep each game's name, description, instructions, FAQ and metadata together; a collection links to game pages rather than replacing them.

| Part | Responsibility and current status |
|---|---|
| Canonical game page | The intended route is `/games/{slug}`. **Implemented for AppAI's own games only.** Developer-published games currently have their canonical page at `/p/{slug}`. The external-game move to `/games/{slug}` and redirects from `/p/{slug}` are **planned, not implemented** (Package C). Do not announce a `/games` URL for a newly published external game. |
| Playable program | For a developer-published page, the game runs inside a `game` iframe on that page. The same static game URL can also be embedded elsewhere if its host permits it. AppAI's page is not the file to embed. |
| Hosting | Developers deploy their files to GitHub Pages, Cloudflare Pages, Vercel or Netlify. AppAI-built games may be checked-in static builds. The page API and image upload API do not accept game archives or build source. |
| AppAI-rendered content | Name/H1, tagline, description, cover, how-to and FAQ outside the frame; metadata, `VideoGame` and `FAQPage` markup. Search engines do not get the game's instructions from its canvas. |
| Publishing versus listing | A published page can be visited directly. `listInGames: true` saves an application, not an approval. New external `GAME` listings are unapproved under D62 and absent from the homepage until approved. |

## Publish a game in one minute

Use the same device authorization, dry-run and page API as [Publish in one minute](https://appai.info/spec#publish-in-one-minute).

| Step | Action |
|---|---|
| 1. Build and host | Export static files, deploy to an allowed HTTPS host and allow framing by `https://appai.info`. See [technical guide](https://appai.info/spec/games#technical-guide). |
| 2. Authorize | Follow [device authorization](https://appai.info/spec/api#authentication). Show the human the returned approval link and code; the human approves. Reuse the resulting key outside the repo; never put it in game files. |
| 3. Compose | Use `template: "GAME"` and a `game` section. `GAME` renders page `title` as H1 and `tagline` below it; do not add a hero. Other templates can contain `game`, but need their own H1. |
| 4. Preview | `POST /api/v1/pages?dryRun=true` with the complete body. Check `valid`, `errors`, `warnings`, `sanitizedContent`. Fix errors and unknown fields. The `leaderboards declarations are stored only` warning may remain if you intentionally include declarations. |
| 5. Publish | `POST /api/v1/pages` with the same body and `isPublished: true`. For an existing page use `?dryRun=true&upsert=true`, then `?upsert=true`. Partial updates use `PATCH /api/v1/pages/{slug}?locale=en`. |
| 6. Visit | Open `/p/{slug}` for an external game today. Apply for discovery with `listInGames: true`; read [review status](https://appai.info/spec/games#review-and-listing) before promising inclusion. |

Start with the [generic GAME example](https://appai.info/spec/examples/game.example.json), or follow the complete [Guess Duel walkthrough](https://appai.info/spec/games#worked-example-guess-duel).

## Technical guide

| Requirement | What to build |
|---|---|
| Technology | Static HTML5/JavaScript, canvas or WebGL. Frameworks that build to static files and engines exporting to the web can work if their export runs within this iframe contract. AppAI does not run a game server or install an engine for you. |
| Entry and assets | An `index.html` entry plus its scripts, styles and assets. Use relative asset paths so a deployment works under a subdirectory. No server is required for local game logic; optional room calls are separate. AppAI validates the game URL, not the contents of a build folder. |
| Allowed hosts | HTTPS on a subdomain of `github.io`, `pages.dev`, `vercel.app` or `netlify.app`. Custom domains and bare provider domains are not accepted by the game URL validator, even if a broader platform CSP would permit them. |
| Mobile | Provide touch controls for the actions you advertise. Include `<meta name="viewport" content="width=device-width, initial-scale=1">`. Test at 375px wide with no horizontal scrolling, in both inline and expanded play. These are submission guidance, not automated page-API checks. |
| Framing headers | The game host must allow AppAI in CSP `frame-ancestors`; do not send `X-Frame-Options: DENY` or `SAMEORIGIN`. See [framing checks](https://appai.info/spec/tools#wrapped-tool-publishing-checks). AppAI's own pages currently reject framing; use your static game URL for other embeds. |
| Inputs and storage | Handle touch and any advertised keyboard/gamepad controls. `allow-same-origin` keeps the game's own origin for resources and browser storage; it does not grant access to AppAI cookies or the parent DOM. Storage can still be limited by browser privacy settings. |
| Runtime behavior | Show usable loading/error states, let people stop between turns and avoid audible autoplay. Keep credentials, paid services and publisher keys out of the client bundle. |

A typical deployed directory is:

```text
site/
  index.html
  assets/
    game.js
    game.css
    sprites.png
```

### Iframe sandbox

The exact game sandbox is `sandbox="allow-scripts allow-same-origin"`. The permissions string is `allow="fullscreen 'none'; gamepad; accelerometer; gyroscope"`.

| Allows | Does not enable |
|---|---|
| JavaScript, static HTML/canvas/WebGL, game-origin assets and storage subject to browser policy | Forms, downloads, popups, popup escape or top-level navigation through sandbox permissions |
| Gamepad, accelerometer and gyroscope subject to browser support and permissions | Clipboard writing or native iframe fullscreen delegation |
| AppAI's expand/close control around the existing frame | Login or payment forms; these are prohibited content even if implemented as custom JavaScript controls |

AppAI fullscreen play is a page overlay that keeps the current frame mounted, URL and game state intact. It is not the browser Fullscreen API. The game's hostname and an AppAI password warning remain outside the frame.

## What you can build

| Allowed | Not allowed |
|---|---|
| Original browser puzzles, educational games, party games and your own presentation of public-domain rules | Cloning existing games, names, artwork or distinctive presentation |
| Local computation and assets you own or may redistribute | Calling paid AI services during play |
| Anonymous play; no game identity token currently | Collecting personal information |
| A focused, playable experience | External tracking scripts or advertising scripts |
| Play without entering credentials or payment details | Login or payment forms |
| Instructions about game controls | Asking users to paste or execute commands |
| Family-friendly play | Real-money gambling, adult content or requiring an executable download |

These are publishing rules. The iframe sandbox is not a content review or a guarantee that it can detect every prohibited behavior. Developer instructions and shell commands in this spec are for publishers, not prompts to show players inside a game.

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
| `cover` | `{ "url": "https://...", "alt": "...", "width": 1200, "height": 630 }`; URL max 2048, alt 1–200; optional width/height integers 1–10000. Loaded directly from this image host; visitors’ IP addresses are visible to that host | Yes |
| `listInGames` | Boolean, default false; true = **apply for inclusion in /games**, pending review | — |
| `identity` | Boolean, default false; validated and saved, but no game sessions are issued. `true` produces a warning that identity is not available for games until they are approved | No |
| `access` | Optional `login` or `admin`, same section gate as iframe-tool | No |
| `faq` | Optional array, max 20 `{question, answer}` pairs; question 1–300, answer 1–2000 (Markdown supported) | No |
| `leaderboards` | Optional array, max 10; unique `id` (1–40 lowercase letters/digits/hyphens), `name` (1–100), `sortOrder` (`asc` or `desc`), optional `unit` (1–40); no other keys. Format warnings only; stored declarations do not create boards | No |
| `id`, `backgroundColor` | Shared section anchor/background fields | No |

Invalid game URLs or field formats (including more than 10 steps) block publishing. Dry-run also returns warnings for an unsupported host, missing H1, missing how-to-play, missing description, incomplete listing application or malformed leaderboards; warnings may accompany `valid: false`. Leaderboard declaration errors alone do not block publishing. Slugs reserved by the existing games catalog are unavailable, including `river-crossing`, `night-bridge`, `water-pouring`, `tabletop-puzzles`, `guess-duel`, `werewolf`, `covers`, `profile`, `boards`.

## Parameters and messages

| Direction | Contract |
|---|---|
| AppAI → iframe URL | `locale` (current hosted-page BCP 47 code), `color` (theme hex), `theme=dark` only in dark mode. Ignore unsupported locales gracefully. |
| Game → parent | `parent.postMessage({ type: "ready" }, "https://appai.info")` when ready |
| Game → parent | `parent.postMessage({ type: "resize", height: 720 }, "https://appai.info")`; finite pixel heights clamp to 200–4000 |

Check both `event.origin === "https://appai.info"` and `event.source === parent` before accepting parent messages. Games currently receive no AppAI identity or session token, including with `identity: true`. The field is validated and stored; setting it to true warns. Game approval alone does not enable identity in the current code. Approval-gated identity is **planned, not implemented**; its payload and message contract are not specified yet. The existing `iframe-tool` session contract must not be assumed to work for `game`.

## Room-code multiplayer

**Only approved origins can call the room API from a browser.** Publishing or applying for `/games` does not grant browser access. The current built-in allowlist includes `https://appai.info`, `https://www.appai.info` and `https://kycgrayson.github.io`; the platform owner can configure extra exact origins. An allowed iframe host is not automatically an allowed room origin. Do not try to configure production origins through page JSON.

Room creation currently requires AppAI sign-in and a same-origin AppAI cookie; `X-AppAI-Session`, a publisher key or a game identity flag does not replace that cookie. Cross-origin CORS does not grant credentialed creation. Approved external origins can join, poll, start and move using room-seat bearer tokens. A supported external creation/authorization flow is a Package C dependency, not something a developer can enable in this payload. See [room behavior and errors](https://appai.info/spec/tools#room-code-multiplayer-rooms-api).

| Endpoint | Request | Success |
|---|---|---|
| `POST /api/rooms` | Signed-in creator; `{ "game": "my-game", "seats": 2, "state": {}, "turn": 0 }` | `201 { code, seat: 0, token, room }` |
| `POST /api/rooms/{code}/join` | `{}` | `200 { seat, token, room }` |
| `GET /api/rooms/{code}?since={version}` | `Authorization: Bearer <room token>` | `{ changed: true, seat, room }` or `{ changed: false, version, seats }` |
| `POST /api/rooms/{code}/start` | Host seat 0; bearer token; at least 2 joined players | `{ room }`; a full room already starts on join |
| `POST /api/rooms/{code}/moves` | Bearer token; `{ "version": 3, "move": {}, "state": {}, "nextTurn": 1, "end": false }` | `{ room }` |

| Public rule | Value |
|---|---|
| Seats | 2–4; defaults to 2; seat indices start at 0 |
| Game id | 1–40 lowercase letters, digits or hyphens; must start and end with a letter or digit |
| State | ≤ 8 KB JSON (8192 UTF-8 bytes), object or array; visible to all seats |
| One move | ≤ 1 KB JSON (1024 UTF-8 bytes); never send secret answers or private cards |
| Whole request body | ≤ 12 KB (12288 bytes), independently of state/move limits |
| Turns | Send the latest version; handle `version_conflict` by reading the returned room. Clients validate game rules; the room service stores public state and enforces seats, versions and turns. |
| Polling recommendation | Every 1–1.5 seconds when visible, 15 seconds when hidden; honor `Retry-After` on 429 |
| Credentials | Keep a separate room-seat token per room, never in a URL. Never send the publisher API key from game code. |

Minimal browser client for the implemented API. `createRoom` is for a signed-in **same-origin AppAI** context only; `joinRoom`, `readRoom` and `move` can run from an approved external origin. Do not run this creation function inside an external game iframe and expect AppAI's login cookie to be available.

```js
const roomsBase = "https://appai.info/api/rooms";
async function roomRequest(path, { body, token, credentials = "omit" } = {}) {
  const response = await fetch(roomsBase + path, {
    method: body === undefined ? "GET" : "POST",
    credentials,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.message || result.error);
    Object.assign(error, { status: response.status, result,
      retryAfter: response.headers.get("Retry-After") });
    throw error; // On 409, refresh from result.room; on 429, wait Retry-After.
  }
  return result;
}
function rememberSeat(code, result) {
  // Keep these on this device; share only the public room code.
  sessionStorage.setItem(`room:${code}`, JSON.stringify({
    token: result.token, seat: result.seat,
  }));
  return { code, token: result.token, seat: result.seat, room: result.room };
}
async function createRoom() {
  if (location.origin !== "https://appai.info") {
    throw new Error("Creation requires a signed-in same-origin AppAI context");
  }
  const result = await roomRequest("", {
    credentials: "same-origin",
    body: { game: "my-game", seats: 2, state: { turns: 0 }, turn: 0 },
  });
  return rememberSeat(result.code, result);
}
async function joinRoom(code) {
  const normalized = code.replace(/[\s-]/g, "").toUpperCase();
  const result = await roomRequest(`/${encodeURIComponent(normalized)}/join`, { body: {} });
  return rememberSeat(normalized, result);
}
async function readRoom(seat, since = 0) {
  return roomRequest(`/${encodeURIComponent(seat.code)}?since=${since}`, { token: seat.token });
}
async function move(seat, room, publicMove, nextPublicState) {
  return roomRequest(`/${encodeURIComponent(seat.code)}/moves`, {
    token: seat.token,
    body: { version: room.version, move: publicMove, state: nextPublicState,
      nextTurn: (seat.seat + 1) % room.seats.length, end: false },
  });
}
// Host, only in the authorized AppAI context: const host = await createRoom();
// Guest, on an approved origin: const guest = await joinRoom("ABCD23");
// const result = await readRoom(guest); // since=0 requests the complete state.
// If result.room.status === "playing" and result.room.turn === guest.seat,
// validate a legal move locally, then call move(guest, result.room, action, state).
// After a full two-seat room joins it is already playing. For a partially filled
// larger room, seat 0 may POST /{code}/start with its bearer token.
```

This sample does not create game rules or keep secrets for you. Guess Duel's real client also handles commitments, reveals, stale turns and reconnects; see its `src/net/rooms.ts` and `src/logic/` before adapting the transport.

## Size and performance

| Enforced limit | Code contract |
|---|---|
| Image upload | `POST /api/v1/upload`, multipart field `file`: maximum 5 × 1024² bytes (5 MiB). Images only: PNG, JPEG/JPG, GIF, WebP, SVG. It is not a ZIP, HTML or game upload endpoint. |
| Publish JSON | No explicit total game-build or page-body byte cap is implemented in the page publish/preview handlers. They parse JSON and enforce field schemas. Infrastructure may impose other request limits; those have not been verified here. Keep the payload to page metadata, never binary assets. |
| Text and arrays | The [game schema](https://appai.info/spec/games#game) limits URL/text lengths, how-to steps and FAQ items. Top-level title/metaTitle ≤200 characters, tagline/metaDescription ≤500. |
| Rooms | State 8192 bytes, move 1024 bytes, total body 12288 bytes, 2–4 seats. These are API checks, not recommendations. |
| Game download | AppAI does not upload or measure the externally hosted build, so there is no enforced game-download size limit in this flow. Your host may have its own limits. |

The following are **recommended budgets**, not publishing validators or measured claims about your game:

| Recommendation | Target |
|---|---|
| Initial game download | Aim for ≤5 MiB transferred; load optional scenes/audio later |
| Layout | No horizontal scrolling at 375px; touch controls for every required action |
| Audio and interruptions | No audible autoplay; let people stop between turns |

## Worked example: Guess Duel

This uses AppAI's actual `games/guess-duel` source, not an invented starter project. The same-device, computer-opponent and relay modes run as static files. The optional online-room mode depends on the room origin/access rules above; this walkthrough does not promise that mode on a new host.

### Repository layout and build

```text
games/guess-duel/
  index.html                 # Vite entry, viewport, module script
  package.json               # build: tsc --noEmit && vite build
  package-lock.json
  vite.config.ts             # base: './', target: es2020
  src/
    main.ts
    logic/                   # rules and secret commitments
    net/rooms.ts             # optional AppAI rooms transport
    ui/                      # controls, strings and local storage
  tests/
public/games/guess-duel/      # checked-in AppAI static build
public/games/covers/guess-duel.svg
```

From the repository root, with Node 24 and npm installed:

```bash
cd games/guess-duel
npm ci
npm test
npm run build
# dist/index.html plus dist/assets/ is the standalone deploy directory.
cp ../../public/games/covers/guess-duel.svg dist/cover.svg
npm run preview
```

Upload **the contents of `dist/`**, keeping `index.html` at the site root, to your own allowed host (for example a Cloudflare Pages project). Stop preview when finished. Do not upload `src/main.ts` as a browser script: Vite emits the runnable JavaScript. Host provisioning is outside the AppAI API. Use the real deployment URL below, and check both the URL and its framing headers:

```bash
export APPAI_GAME_ORIGIN='https://your-guess-duel.pages.dev'
export APPAI_GAME_SLUG='guess-duel-demo'
curl --fail-with-body -sSI "$APPAI_GAME_ORIGIN/"
curl --fail-with-body -sSI "$APPAI_GAME_ORIGIN/cover.svg"
```

`your-guess-duel.pages.dev` is a placeholder: deploy first and replace it. For AppAI maintainers, `bash scripts/sync-games.sh guess-duel` instead builds into `public/games/guess-duel/` with base `/games/guess-duel/`. That is the existing own-game static-build workflow, not a public upload API. External exports use Vite's relative `./` base and remain on the developer's host.

### Complete publish payload

The following body uses the same section shape as [game.example.json](https://appai.info/spec/examples/game.example.json), adapted to the real game. Download it as [guess-duel.example.json](https://appai.info/spec/examples/guess-duel.example.json). Replace the host, slug and demo logo. The broad API age category is `7+`; the written play recommendation is 8+. Do not add `leaderboards` or `identity` expecting them to enable a service.

```json
{
  "slug": "guess-duel-demo",
  "template": "GAME",
  "locale": "en",
  "title": "Guess Duel Beta",
  "tagline": "Hide a number and use A/B clues to deduce the other code.",
  "metaDescription": "Play Guess Duel free in your browser on one device, against the computer or by passing links between two phones. Recommended for ages 8+. Beta.",
  "themeColor": "#A5B4FC",
  "themeColorSecondary": "#67E8F9",
  "fontFamily": "Space Grotesk",
  "darkMode": true,
  "isPublished": true,
  "content": {
    "logo": "https://appai.info/spec/examples/placeholder-logo.png",
    "sections": [
      {
        "type": "game",
        "order": 0,
        "data": {
          "gameUrl": "https://your-guess-duel.pages.dev/",
          "description": "Choose a secret of three or four distinct digits. Take turns guessing: A means a correct digit in the correct position; B means a correct digit elsewhere. Play on one device, against the computer, or by passing links between two phones.",
          "genre": "Number deduction",
          "orientation": "any",
          "aspectRatio": "9:16",
          "players": {
            "min": 1,
            "max": 2
          },
          "controls": [
            "touch",
            "keyboard"
          ],
          "howToPlay": [
            "Choose three or four different digits as your secret; a leading zero is allowed.",
            "Take turns guessing. Use A for a correct digit in the correct position and B for a correct digit elsewhere.",
            "On a shared device, look away while the other player enters a secret. You can also choose the computer opponent or exchange relay links."
          ],
          "ageRating": "7+",
          "cover": {
            "url": "https://your-guess-duel.pages.dev/cover.svg",
            "alt": "Guess Duel number tiles and A/B clues",
            "width": 640,
            "height": 360
          },
          "listInGames": true,
          "faq": [
            {
              "question": "Can two people share one phone?",
              "answer": "Yes. Take turns and look away while the other person enters a secret or passes the privacy screen."
            },
            {
              "question": "Can I play alone?",
              "answer": "Yes. Choose the computer opponent. Three digits are a gentler start; four give you more to keep track of."
            },
            {
              "question": "Can we play on separate phones?",
              "answer": "Relay mode passes a link or QR code after a turn. Each device keeps its own secret. Room-code access depends on AppAI origin approval and is not promised by publishing this page."
            },
            {
              "question": "What age is it for?",
              "answer": "We suggest ages 8 and up, with help understanding the A/B clues. The 7+ metadata category is a broad rating; our play recommendation is 8+."
            }
          ],
          "backgroundColor": "#0F172A"
        }
      }
    ]
  }
}
```

### Authorize, upload assets, preview and publish

Use the [existing device flow](https://appai.info/spec/api#authentication) if you do not already have `APPAI_API_KEY` in your environment:

```bash
curl -sS -X POST https://appai.info/api/v1/auth/device
# Show the returned verification_uri_complete AND user_code to the human.
# The human signs in, checks the code and approves; the agent never approves.
# Set APPAI_DEVICE_CODE to the returned device_code, then poll at its interval:
curl -sS -X POST https://appai.info/api/v1/auth/token \
  -H 'Content-Type: application/json' \
  --data "{\"device_code\":\"$APPAI_DEVICE_CODE\"}"
# On authorization_pending, wait the returned interval before polling again.
# On slow_down, adopt its new interval. On complete, hold api_key as
# APPAI_API_KEY in memory/environment or secure storage outside the repo.
```

Prepare a real square 512×512 PNG as `game-logo.png` ([logo rules](https://appai.info/spec/style#logo)). Confirm the deployment's data practices with its owner and write `privacy.en.md` and `terms.en.md` before the publishing commands. For this game, distinguish local same-device play, relay secrets/notes kept on the device, public state carried in relay links, optional room requests, and requests to hosts serving assets. Include only behavior true of your deployment.

The following commands run in a scratch directory outside the repo. They require Node, curl, `APPAI_API_KEY`, the real `APPAI_GAME_ORIGIN`, a unique `APPAI_GAME_SLUG`, and those three local files. No credentials are saved in the JSON files.

```bash
(
set -eu
: "${APPAI_API_KEY:?Complete device authorization first}"
: "${APPAI_GAME_ORIGIN:?Set the deployed HTTPS game origin}"
: "${APPAI_GAME_SLUG:?Choose a unique non-reserved slug}"

curl --fail-with-body -sS -X POST https://appai.info/api/v1/upload \
  -H "Authorization: Bearer $APPAI_API_KEY" \
  -F 'file=@game-logo.png;type=image/png' > logo-upload.json

curl --fail-with-body -sS \
  https://appai.info/spec/examples/guess-duel.example.json > game-page.template.json

node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const body = JSON.parse(readFileSync('game-page.template.json', 'utf8'));
const upload = JSON.parse(readFileSync('logo-upload.json', 'utf8'));
if (!upload.url) throw new Error('Image upload did not return a URL');
const origin = new URL(process.env.APPAI_GAME_ORIGIN).origin;
body.slug = process.env.APPAI_GAME_SLUG;
body.content.logo = upload.url;
body.content.sections[0].data.gameUrl = `${origin}/`;
body.content.sections[0].data.cover.url = `${origin}/cover.svg`;
body.privacyPolicy = readFileSync('privacy.en.md', 'utf8');
body.termsOfService = readFileSync('terms.en.md', 'utf8');
writeFileSync('game-page.json', JSON.stringify(body, null, 2) + '\n');
JS

curl --fail-with-body -sS -X POST \
  'https://appai.info/api/v1/pages?dryRun=true' \
  -H "Authorization: Bearer $APPAI_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @game-page.json > game-preview.json

node --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
const preview = JSON.parse(readFileSync('game-preview.json', 'utf8'));
console.log(JSON.stringify({ valid: preview.valid, errors: preview.errors,
  warnings: preview.warnings, sanitizedContent: preview.sanitizedContent }, null, 2));
if (!preview.valid || preview.errors?.length || preview.warnings?.length) {
  throw new Error('Resolve the reported issues, then preview again before publishing');
}
JS

# After reviewing the successful preview, send exactly the same body:
curl --fail-with-body -sS -X POST https://appai.info/api/v1/pages \
  -H "Authorization: Bearer $APPAI_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @game-page.json > game-published.json

curl --fail-with-body -sS \
  "https://appai.info/api/v1/pages/$APPAI_GAME_SLUG?locale=en" \
  -H "Authorization: Bearer $APPAI_API_KEY"
)
```

Run the blocks in order and stop on a failed command; never continue to publishing after a failed preview. If updating an owned slug, use `?dryRun=true&upsert=true` for preview and `?upsert=true` for publish. Do not bypass a 409 for a slug owned by another organization.

The successful creation response is HTTP 201 and includes `gamesListing: "requested"` for this application. It does not mean approved. Open `https://appai.info/p/$APPAI_GAME_SLUG` in a browser (substitute the actual slug); the current route is `/p`, not `/games`.

Publish four variants with the same slug: `en` first (default), then `zh-TW`, `zh-CN`, `es`. Translate title, tagline, metadata, description, how-to, FAQ and cover alt text, previewing each complete body. Use `Noto Sans TC` / `Noto Sans SC` for the Chinese variants. Add other languages chosen by the owner. AppAI's own pages described below have nine locales; external pages have only the translations you publish.

For root variants, supply translated `privacyPolicy` and `termsOfService`. These fields are optional in API validation, but AppAI does not automatically write or provide game-specific policies. `/p/{slug}/privacy` and `/p/{slug}/terms` exist only when their respective fields are supplied. Confirm data practices before writing policies; do not copy claims from a different game's deployment. See [Compliance Pages](https://appai.info/spec/pages#compliance-pages).

### What the finished page shows

| Element | Result |
|---|---|
| Current external URL | `/p/guess-duel-demo`, or your chosen slug. It is the canonical page unless you deliberately supply another canonical URL. Leave `canonicalUrl` unset for this example. |
| Header | One H1 from `title`, with `tagline` below it |
| Main game section | Specific description and cover; a sandboxed frame loading your deployed game URL with locale/theme parameters |
| Expanded play | AppAI expand/close control, hostname and password warning; the existing frame remains mounted |
| Supporting text | Numbered how-to steps and four visible FAQ answers outside the game |
| SEO | Page metadata and automatic `VideoGame` / `FAQPage` markup. Player counts and broad age category come from the payload, not an inspection of gameplay. |
| Discovery | No automatic homepage or `/games` inclusion, no provisioned leaderboard and no game identity token |
| Planned URL | `/games/{slug}` for external games, with `/p/{slug}` redirects, is a future Package C change. Today `/games/guess-duel` is AppAI's own page, not the external example you just published. |

### Checklist before submitting

- [ ] Use an original game and assets you are allowed to publish; choose a slug outside the reserved catalog.
- [ ] Deploy static `index.html` and all relative assets to an allowed HTTPS host; check framing headers and direct asset loading.
- [ ] Test required touch actions at 375px, plus any advertised keyboard/gamepad controls, inline and expanded. Test errors and stopping between turns.
- [ ] Keep secrets, publisher keys, login/payment forms, advertising, tracking and paid AI calls out of the game.
- [ ] Add a real logo, cover and alt text; describe only implemented play modes, players and age guidance.
- [ ] Include description, genre, orientation, aspect ratio, players, controls, age category, cover and instructions before setting `listInGames: true`.
- [ ] Translate the published locale variants and owner-confirmed policies. Check metadata, how-to and at least four useful FAQ answers for this example.
- [ ] For rooms, confirm exact origin approval and the creation limitation; keep public state within 8 KB and moves within 1 KB.
- [ ] Preview every locale, fix issues, publish the same body and open the resulting `/p/{slug}` on desktop and mobile.
- [ ] Report the listing as requested/unapproved. Do not promise review timing, listing, identity or external leaderboard support.

## Review and listing

| Action / state | Implemented behavior |
|---|---|
| Publish `template: "GAME"`, `isPublished: true` | The page is directly reachable at `/p/{slug}`. D62 creates/resets its corresponding root App listing to `isApproved: false`; homepage App queries require approval. Updating a root GAME page also resets approval. |
| Set `listInGames: true` | Saves the request in page JSON and returns `gamesListing: "requested"`. It does not mutate the static games catalog, approve the App listing or enable APIs. |
| Homepage games strip and `/games` | Currently driven by the AppAI-owned catalog. A new external game is not added by publishing, even if a generic App approval field is changed elsewhere. |
| Identity | No AppAI game session is issued, regardless of `identity: true` or generic App approval. |

**Package C is planned, not built:** game-specific review decisions, listing management, supported external room creation/access, and migration of external canonical pages to `/games/{slug}`. There is no implemented game review submission/status/approval API or notification contract to call here. General App approval is not the planned game review workflow. We cannot promise approval timing, automatic homepage placement or rejection notifications. Keep the requested receipt and use the platform's published review process when it becomes available.

## Leaderboards

**Implemented for AppAI's own puzzle build:** server code registers nine verified boards under the API game id `river-crossing`, with keys `river:easy|medium|hard`, `bridge:easy|medium|hard`, `water:easy|medium|hard`. The three public puzzle pages share these identities. A run starts at `POST /api/games/river-crossing/runs`, finishes with moves at `/runs/{runId}/finish`, and is claimed at `/runs/{runId}/claim` using its run bearer token. Finishing replays puzzle actions on the server and checks a minimum elapsed time; claiming also requires AppAI sign-in. Read results at `GET /api/games/river-crossing/leaderboard?board=river:easy`. Nickname/profile and reporting code also exists. Availability depends on deployment and database configuration; this documentation does not assert a live-service test.

**External games:** `leaderboards` accepts/stores declarations and warns; it does not register a board, grant origin access or install a validator. An unknown board is rejected by the runtime API. There is no self-service external leaderboard provisioning or general score-validation contract yet. External leaderboard integration is **planned, not implemented**. Do not copy the own-game endpoints or replace their slug expecting a new leaderboard. Guess Duel has no board in the current registry.

## AppAI-owned pages and compatibility

| Page | Existing static build and startup selection |
|---|---|
| `/games/river-crossing` | `public/games/river-crossing/index.html`, `game=river` |
| `/games/night-bridge` | Same build, `game=bridge` |
| `/games/water-pouring` | Same build, `game=water` |
| `/games/guess-duel` | `public/games/guess-duel/index.html` |
| `/games/werewolf` | `public/games/werewolf/index.html` |
| `/games/tabletop-puzzles` | Page-only collection linking the three puzzles; no build or Play URL |

The hub and all these pages have authored copy in `en`, `es`, `zh-TW`, `zh-CN`, `ja`, `ko`, `de`, `fr`, `hi`: names, introductions, background, instructions, age/player labels, FAQ, metadata, breadcrumbs and footer navigation. Canonicals and sitemap alternates use the existing nine-locale platform helpers. The collection has `CollectionPage` markup; game pages have `VideoGame`, `FAQPage` and `BreadcrumbList`.

Own-game play uses locale-free `/games/{slug}/play`. A localized platform bar links to Game info, All games and AppAI home, with at least 44px link targets. It is injected into the existing static HTML, which stays top-level and same-origin. This own-game compatibility path is an exception to the external `game` iframe flow. The bar supports all nine locales; game builds retain their existing English/Traditional Chinese strings. Do not advertise nine-language gameplay based on translated page copy.

Previously shared own-game room, puzzle/challenge and leaderboard `claim` queries retain their full query when forwarded to play. Nonempty fragments, including Guess Duel's `#r=` relay state, forward in the browser; the server cannot see fragments. Language-only links stay on detail pages with matching Play links and query-free canonicals. With JavaScript disabled, a Play link remains available but fragment forwarding cannot run. Existing external `/p/` routing is unchanged. More detail: [own-game routing](https://github.com/KYCgrayson/APPAI/blob/main/docs/games/own-game-routing.md).

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

## Implementation references

The current contracts above were checked against these repository sources. Source presence does not verify production deployment or third-party host behavior.

| Contract | Source |
|---|---|
| Game schema, warnings, listing receipt and reserved slugs | [game-section.ts](https://github.com/KYCgrayson/APPAI/blob/main/src/lib/game-section.ts) |
| Allowed hosts and iframe URL parameters | [iframe-tool-allowlist.ts](https://github.com/KYCgrayson/APPAI/blob/main/src/lib/iframe-tool-allowlist.ts) |
| Sandbox, permissions and identity exclusion | [IframeToolSection.tsx](https://github.com/KYCgrayson/APPAI/blob/main/src/templates/sections/IframeToolSection.tsx) |
| Expanded frame and visible instructions/FAQ | [GameSection.tsx](https://github.com/KYCgrayson/APPAI/blob/main/src/templates/sections/GameSection.tsx) |
| Room handlers, state/move/body limits, turns and seats | [rooms.ts](https://github.com/KYCgrayson/APPAI/blob/main/src/lib/rooms.ts) |
| Browser origin rules and cookie authentication | [rooms-cors.ts](https://github.com/KYCgrayson/APPAI/blob/main/src/lib/rooms-cors.ts), [rooms-server.ts](https://github.com/KYCgrayson/APPAI/blob/main/src/lib/rooms-server.ts) |
| Image upload limit and accepted types | [upload route](https://github.com/KYCgrayson/APPAI/blob/main/src/app/api/v1/upload/route.ts) |
| Page schema and publish behavior | [page.ts](https://github.com/KYCgrayson/APPAI/blob/main/src/lib/validations/page.ts), [publish route](https://github.com/KYCgrayson/APPAI/blob/main/src/app/api/v1/pages/route.ts) |
| New GAME approval status and homepage filtering | [hosted-page-approval.ts](https://github.com/KYCgrayson/APPAI/blob/main/src/lib/hosted-page-approval.ts), [homepage](https://github.com/KYCgrayson/APPAI/blob/main/src/app/%5Blocale%5D/page.tsx) |
| Implemented boards and replay/claim behavior | [boards.ts](https://github.com/KYCgrayson/APPAI/blob/main/src/lib/games/boards.ts), [leaderboard.ts](https://github.com/KYCgrayson/APPAI/blob/main/src/lib/games/leaderboard.ts) |
| Worked example build and room client | [Guess Duel](https://github.com/KYCgrayson/APPAI/tree/main/games/guess-duel), [sync-games.sh](https://github.com/KYCgrayson/APPAI/blob/main/scripts/sync-games.sh) |

All topics: [Overview](https://appai.info/spec) · [Authorization & API](https://appai.info/spec/api) · [Style & logo](https://appai.info/spec/style) · [Theme](https://appai.info/spec/theme) · [Typography](https://appai.info/spec/typography) · [Pages](https://appai.info/spec/pages) · [Sections](https://appai.info/spec/sections) · [Multi-language & multi-page](https://appai.info/spec/i18n) · [Tools](https://appai.info/spec/tools) · [Universal App](https://appai.info/spec/apps) · [Games](https://appai.info/spec/games)
