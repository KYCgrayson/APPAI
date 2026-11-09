# Measurements

Production output from `npm run build` (Node 24.22.2; Vite 8.3.6).
Gzip uses Node `zlib.gzipSync`, default settings.

| File                           | Raw bytes | Gzip bytes |
| ------------------------------ | --------: | ---------: |
| dist/index.html                |       490 |        352 |
| dist/assets/index-RF3gCm8u.css |      9790 |       2935 |
| dist/assets/index-B1S2PtUH.js  |     59925 |      22548 |
| **Total**                      | **70205** |  **25835** |

## Tests

56 tests pass with Node's built-in test runner. Round 3 adds ten regression tests covering
rejoin after a skip, double skips on reload and live polling, corrected state on the next move,
skip replay boundaries and truncated logs, room URLs, named secret-setting waits, specific
room errors, and seat-independent scores with preservation of existing score rows.
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
