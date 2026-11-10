# Measurements

Production output from `npm run build` (Node 24.22.2; Vite 8.3.6).
Gzip uses Node `zlib.gzipSync`, default settings.

| File                           | Raw bytes | Gzip bytes |
| ------------------------------ | --------: | ---------: |
| dist/index.html                |       490 |        351 |
| dist/assets/index-SW1paRGv.css |     10801 |       3148 |
| dist/assets/index-Dzi_RZGe.js  |     63404 |      23852 |
| **Total**                      | **74695** |  **27351** |

## Tests

80 tests pass with Node's built-in test runner. Round 5 adds fourteen regression tests covering
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
This script is optional and is separate from the 80 Node tests.

The browser script could not execute here: Chrome exited during launch in the sandbox.
The Vite listener also failed with EPERM, and the installed Playwright has no WebKit executable.
No fresh browser or real-device pass is claimed. The script passed Node syntax checking;
the 80 Node tests, TypeScript/Vite build and Prettier checks passed.
