# Measurements

Production output from `npm run build` (Node 24.22.2; Vite 8.3.6).
Gzip uses Node `zlib.gzipSync`, default settings.

| File                           | Raw bytes | Gzip bytes |
| ------------------------------ | --------: | ---------: |
| dist/index.html                |       490 |        349 |
| dist/assets/index-w8gp1_q1.css |     10909 |       3197 |
| dist/assets/index-D2vbT0ks.js  |     66699 |      24864 |
| **Total**                      | **78098** |  **28410** |

Served output rebuilt inside `games/guess-duel` with
`npx --offline vite build --base=/games/guess-duel/ --outDir ../../public/games/guess-duel --emptyOutDir`:

| File                                              | Raw bytes | Gzip bytes |
| ------------------------------------------------- | --------: | ---------: |
| public/games/guess-duel/index.html                |       522 |        359 |
| public/games/guess-duel/assets/index-w8gp1_q1.css |     10909 |       3197 |
| public/games/guess-duel/assets/index-D2vbT0ks.js  |     66699 |      24864 |
| **Total**                                         | **78130** |  **28420** |

Both tables were measured from the actual output on 2026-11-10 with Node 24.22.2
`zlib.gzipSync`. All twelve English/zh-TW loading, countdown, closed-room, recreation and missing-room
strings are present in the served JavaScript. Served HTML uses `/games/guess-duel/assets/`.

## Tests

109 tests pass with Node's built-in test runner, including the 102 tests from the previous round;
only expectations encoding the old clock, local expiry and missing-room behavior were updated.
Backlog #72 adds fourteen tests for skew in either direction and request latency, uncapped
remaining time, m:ss formatting, waiting-only expiry, Date-header calibration and resampling,
missing/invalid Date headers, localized loading and disabled controls, duplicate create/join
prevention, specific errors and retries, countdown ticks without screen replacement, poll expiry
resets, hiding the countdown on start, cleanup and recreation with the same names/digits/first
player, API 404/expired, failed recreation, already-expired responses, full unstarted rooms,
and stale poll failures after recreation. TypeScript/Vite and Prettier checks pass.

Round 2 adds eight regressions for zero countdowns while the server is already playing
(including hidden tabs), server-confirmed 404 closure with coalesced refreshes, immediate
refresh on returning to a visible tab, failed expiry checks, failed creation after an
unavailable lookup, expired links with and without saved credentials in both languages,
120-second starts across Date-header fractional phases and stable poll ticks, and guarded
display changes after clock corrections or a new expiry.

Backlog #72 round 3 adds seven regressions for typed missing-room codes in both languages
and corrected-code retries, gone saved seats, closure of the host's own waiting room,
strict minimum-RTT calibration including corrections under 1.5 seconds, a single upward
display correction per expiry, slow-create convergence and steady ticks, and the controller's
slow-create recovery without replacing the screen. The existing round 4 typed-join regression
again includes 404. Clock expectations that encoded frozen or premature ticks were updated.

Round 5 adds fourteen regression tests covering
automatic history selection for either seat, manual selection until the next event, batched
events and relay loads, named/counting segments, empty hints and newest-first history,
same-device handover and online guest auto-replies, stable note/history pointer presses,
peek holds across renders and release/cancel/blur, queued updates during busy submissions,
rules and failed auto-replies, and immediate recovery polls after sends, failures and skips.
Round 4's history regression now derives selection from the incoming move, without tapping.

Round 4 adds ten regression tests covering
meaningful poll/render decisions, unchanged polls and invalid moves, private entry drafts,
pointer/keyboard activation, controller drafts across polling and failed sends, host guess
132 → guest reply 1A2B in the selected opponent history, stale poll responses, pending-secret
wait messages, join failures with retained room codes, and invalid codes without fetching.
Controller tests execute the real controller and views with event/storage facades, without a DOM.
Round 3's skip/rejoin, room URL, waiting screen, room error and score migration regressions pass.
The existing reducer, AI, commitments, relay codec, rooms transport and storage tests also pass.

## AI guesses

Normal difficulty; 200 seeded random secrets per length, seeded RNG injected into each guess.

| Digits | Secrets | Average guesses | Maximum | Limit |
| ------ | ------: | --------------: | ------: | ----: |
| 3      |     200 |           5.425 |       8 |    10 |
| 4      |     200 |           5.525 |       8 |    10 |

The Node relay fixture has 20 guesses per player, four digits, both reveals,
and names 爸爸 / 小朋友: 319 fragment characters, 355 including
`https://appai.info/games/guess-duel/`. Binary hashes/salts and 18-bit history entries
keep it below the 400-character full-URL target. QR error correction is L.
Long custom names or URL query parameters can increase the total.
No live rooms service was contacted.

## Browser checks (2026-11-09)

Results supplied by the independent re-review using Playwright Chrome: zh-TW play screen,
eight guesses per player. These observations were supplied in REVIEW-2; no browser was used
for this round's changes.

| Viewport  | Keypad fully visible | Horizontal scroll | Keypad keys | Other buttons |
| --------- | -------------------- | ----------------- | ----------- | ------------- |
| 375×667   | Yes                  | None              | ≥64px       | ≥44px         |
| 390×844   | Yes                  | None              | ≥64px       | ≥44px         |
| 667×375   | Yes                  | None              | ≥64px       | ≥44px         |
| 844×390   | Yes                  | None              | ≥64px       | ≥44px         |
| 768×1024  | Yes                  | None              | ≥64px       | ≥44px         |
| 820×1180  | Yes                  | None              | ≥64px       | ≥44px         |
| 1024×1366 | Yes                  | None              | ≥64px       | ≥44px         |
| 1366×1024 | Yes                  | None              | ≥64px       | ≥44px         |
| 1440×900  | Yes                  | None              | ≥64px       | ≥44px         |

| Additional independent check                                     | Result                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Relay worst-case fragment: 20 guesses each, four digits, reveals | 321 characters                                                                 |
| Online full game                                                 | Verified against a mock of the rooms API v4; no real server (API not deployed) |
| Production `?api=https://evil.example`                           | No request sent to that origin                                                 |

No real phone has been tested yet.

Round 3 conceptual layout recheck, using the current CSS dimensions:

- The four-row keypad remains 274px tall (four 64px rows, three 6px gaps). Landscape content
  height after the header and padding is 303px at 667×375 and 318px at 844×390.
- Four visible landscape guess slots need 174px, including gaps; the left column provides
  about 352px and 455px respectively. Histories scroll in the remaining grid row.
- Portrait and larger layouts retain their 64px keypad rows and scrolling deduction area.
  All nine viewports have sufficient width for the keypad and four guess slots.
- The screen-reader live region is anchored at top/left zero, removing its one-pixel overflow
  below the app. Sound and hint labels now each have a 44px minimum height.
- Tests verify the named waiting screen contains no QR/share/start controls once both seats
  are filled; skip/rejoin and score-order changes are covered without a browser.

The Node relay fixture was remeasured at 319 fragment characters (355 for the full URL).
The independent 321-character observation above uses its own fixture. Fresh visual confirmation
of the layout changes remains a browser check; these dimension checks do not replace it.

Round 4: unchanged polls no longer replace the screen, keypad pointer input is delegated to
the stable app container, and status/notices share a reserved 48px row. Narrow screens show
the selected history directly; wider screens retain both histories. The Node controller tests
verify the guest automatically records and displays the host's 132 / 1A2B entry and keeps
both secret and guess drafts through relevant updates.

Fresh browser layout/touch checks could not run in this sandbox: the local Vite listener was
denied (EPERM), and headless Chrome exited during launch. The earlier viewport observations
above remain historical; Round 4 was verified with the Node tests and production build.

### Round 5 (2026-11-09)

Narrow histories now use two 44px segments with counts and a selected underline. The selected
list shows an empty hint or starts with its newest guess. Compact phone headings leave room
for the segments and newest row at 375×667; the keypad retains four fixed 64px rows and stays
anchored at the bottom. Wider layouts continue showing both history cards.

`tests/browser-round5.mjs` checks both languages, both code lengths and all nine viewports,
including empty/populated lists, the newest row inside the visible phone deduction area,
unchanged keypad coordinates, target sizes, and horizontal overflow. It serves the actual
production files through Playwright routes without a listener or external network requests.
This script is optional and is separate from the Node tests.

The browser script could not execute here: Chrome exited during launch in the sandbox.
The Vite listener also failed with EPERM, and the installed Playwright has no WebKit executable.
No fresh browser or real-device pass is claimed. The script passed Node syntax checking;
the 80 Node tests, TypeScript/Vite build and Prettier checks passed.

### Backlog #72 (2026-11-10)

Loading text occupies a reserved `min-height: 2em` row in the room lobby/closed screen.
The waiting countdown has a reserved row and tabular numerals; the one-second tick changes
only its text node. Countdown/loading rows are outside the secret/play screens, so they do
not change keypad coordinates. Existing keypad dimensions, scrolling containers and responsive
breakpoints are unchanged: four 64px rows plus three 6px gaps (274px); other buttons remain
at least 48px, history/note controls at least 44px. These are CSS dimension checks, not fresh
browser measurements.

The countdown uses the API's `expiresAt` without a two-minute cap. HTTP Date calibration
uses the request midpoint plus 500 ms for the header's whole-second truncation. Each readable
Date sample replaces the estimate when its RTT is strictly smaller than the previous minimum,
even for a correction under 1.5 seconds. Equal/slower responses and missing/invalid Date headers
retain the last calibration (or use local time before the first readable Date).
The display ceil-clamps expiry at the header's precision and starts a fresh 120-second room
at 2:00 across the tested header phases. It advances on whole elapsed seconds, preserving its
tick phase, without waiting for a corrected target to catch up. A better RTT estimate may
increase the display by at most one second once per expiry; other reads cannot increase or
skip displayed seconds. Elapsed hidden-tab time still counts, and a new expiry can resync it.
Expiry confirmation keeps the full precision of the API timestamp.

Deterministic three-second-create fixtures cover seven fractional header phases and client
clocks one hour ahead, one hour behind and aligned. A 40 ms first poll converges to within
one displayed second of the true expiry, with progressively faster polls afterward. During
the following ten seconds no display pause exceeds 1.2 seconds. A controller regression also
checks the 1:58 → 1:59 recovery and every subsequent one-second tick without screen replacement.

At zero, the host requests a fresh full snapshot (`since=-1`) and keeps its room credentials
while awaiting confirmation. Returning to a visible tab also requests an immediate snapshot.
Only API 404/expired errors or a fresh snapshot that is still waiting past its server-time
expiry close the room. A playing snapshot continues into the game. Failed checks retain the
token and URL and retry; concurrent refreshes are coalesced and stale-session results ignored.
Gone links or saved-seat lookups use the same closed screen with exactly one recreate button.
A 404 from a typed join retains the online panel and all six entered characters, restores
the controls, and shows “Room not found — check the code” / “找不到這個房間，請確認房號”.
Confirmed closure
stops polling, clears the old scoped/legacy token, private room data and `?room=`, and preserves
settings for one-tap creation of a new game and room code. Attempting creation after an
unavailable lookup preserves the unconfirmed room's token and URL if creation fails.

The existing browser matrix was attempted again with the installed Playwright and Chrome,
but Chrome exited during launch with SIGABRT/EPERM in the sandbox. No fresh viewport or
real-device pass is claimed. Rounds 2 and 3 used the controller/event facade and deterministic
transport/clock tests; the browser matrix was not rerun. All 109 Node tests, the TypeScript/Vite
build, served rebuild, served-string/base checks and Prettier checks pass. No live rooms
service was contacted.
