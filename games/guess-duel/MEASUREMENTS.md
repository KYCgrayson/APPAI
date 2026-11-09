# Measurements

Production output from `npm run build` (Node 24.22.2; Vite 8.3.6).
Gzip uses Node `zlib.gzipSync`, default settings.

| File | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| dist/index.html | 490 | 351 |
| dist/assets/index-B6554p3U.css | 9647 | 2907 |
| dist/assets/index-DU4xroP1.js | 58088 | 21795 |
| **Total** | **68225** | **25053** |

## Tests

44 tests pass with Node's built-in test runner. Round 2 adds receiver-sensitive fetch,
v4 credentials/start/errors/origins, hostile state rejection, skip and conflict rebasing,
waiting-screen gating, non-JSON errors, blocked storage and expiry, audio failure,
keyboard scope, relay rematch identity, and full relay URL budget coverage.

## AI guesses

Normal difficulty; 200 seeded random secrets per length, seeded RNG injected into each guess.

| Digits | Secrets | Average guesses | Maximum | Limit |
| --- | ---: | ---: | ---: | ---: |
| 3 | 200 | 5.425 | 8 | 10 |
| 4 | 200 | 5.525 | 8 | 10 |

The worst-case relay fixture has 20 guesses per player, four digits, both reveals,
and names 爸爸 / 小朋友: 319 fragment characters, 355 including
`https://appai.info/games/guess-duel/`. Binary hashes/salts and 18-bit history entries
keep it below the 400-character full-URL target. QR error correction is L.
Long custom names or URL query parameters can increase the total.
No live rooms service was contacted.

## Browser checks
