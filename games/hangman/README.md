# Hangman — Word Guess

A gentle, local word guessing game for AppAI. Eight balloons lift a little basket;
wrong guesses pop balloons, and the basket lands softly when none remain. No
gallows, figures, dependencies, build step, runtime services or accounts.

## Run

From this directory, using Node 24 for the tests:

```sh
export PATH="$HOME/.local/node-v24.22.2-darwin-arm64/bin:$PATH"
npm run dev  # python3 -m http.server 5183
# Open http://localhost:5183/?lang=en
npm test     # node --test tests/*.test.mjs
```

This is a `static` game. `index.html` has the exact charset tag expected by the
existing sync script, and its stylesheet/module URLs are relative. The only site
link is `/games` on Home. This change does not modify the catalog, sync script,
site navigation or `public/`.

## Modes and rules

- **One player:** the computer chooses from 150 child-friendly words per language,
  with a category and short clue for every word. Pick a category and a length
  difficulty, or leave either unrestricted. A selection with no matching words
  shows a translated message; it does not silently change the filters. The picker
  avoids the immediately previous word when another matching word exists.
- **Two players, one device:** Player 1 types a secret and an optional clue using
  the selected word language. A password field and show/hide button keep it private.
  Choose a category on Home, or use the generic “Your word” category. The phone
  handoff is covered, and Player 2 presses Ready before any guessing keys appear.
- Each unused key is either correct (all matching occurrences open) or wrong
  (one balloon pops). Repeated and unsupported keys have no effect. Find all
  required letters/symbols to win; eight balloon costs without completing the word
  end the round. Finished rounds lock guessing.
- The category is always visible. Show Clue is free. A letter hint chooses an
  unguessed required key and costs exactly one balloon. A hint that completes the
  answer wins even if it uses the last balloon; otherwise that last cost ends the
  round. For compound scripts, a correct key can be one of several parts needed
  before a complete written unit appears.
- Wins, current streak and best streak count **the guesser's completed rounds**
  across both modes and languages. A loss resets the streak. Starting over or
  returning Home does not count a result. Two-player results name Player 2 on a
  win and Player 1 on a loss. There are no individual player profiles.

## Languages and reveal conventions

Complete menus and rules: English, Spanish, Traditional Chinese, Simplified
Chinese, Japanese, Korean, German, French and Hindi (Devanagari). An independent
word-language picker defaults to the menu language. Clues belong to the word
language; menus and feedback belong to the interface language.

The `lang` query parameter wins. Otherwise `navigator.languages` is considered in
preference order, matching exact locales and then primary subtags. `zh-Hant`,
`zh-HK`, `zh-MO` and `zh-TW` use Traditional Chinese; other Chinese variants use
Simplified Chinese. Unsupported preferences fall back to English. The interface
picker updates `?lang=` so reload keeps that choice. Changing interface language
during a round preserves the existing secret and its alphabet. `<html lang>` and
the document title follow the interface language.

| Word language | Guessing and display |
|---|---|
| en | A–Z, case insensitive; accents match their base letter |
| es | A–Z plus **Ñ**; Ñ is distinct from N. Á É Í Ó Ú Ü open with A E I O U |
| de | A–Z plus **Ä Ö Ü ß**, each a separate key; ß stays visible as ß |
| fr | A–Z; accents and Ç match the base letter. Œ requires O and E, Æ requires A and E |
| zh-TW | All **37 Bopomofo symbols**, with spaces and tone marks shown automatically. Type Bopomofo, not Han characters, when setting a secret |
| zh-CN | Toneless pinyin using A–Z; **V means ü** (for example `lvse`); typed ü and its tone variants also match V. Type pinyin when setting a secret |
| ja | Hiragana keyboard. Small kana open with their large form; dakuten/handakuten open with the unvoiced base (が→か, ぱ→は); ー is automatic. Loanwords are transcribed in hiragana |
| ko | 14 basic consonants and 10 basic vowels. Double consonants use the single key; compound vowels and final clusters require their basic components (ㅙ→ㅗ+ㅏ+ㅣ, ㄳ→ㄱ+ㅅ). A whole syllable stays blank until all components are known; its original Hangul block then appears |
| hi | Consonants and independent vowels, including ऑ. Matras open with the associated vowel (कि needs क+इ); inherent अ is not an extra guess. Nasal signs, nukta and virama are automatic parts of their cluster. A complete `Intl.Segmenter` grapheme, including a conjunct, remains blank until all required consonants/vowels are known. No combining sign is drawn on its own |

Chinese answers stay hidden until the result, then appear in Han characters with
their pronunciation and a category picture/clue. Japanese kanji forms appear
after the round where provided. The eight original category illustrations are
broad picture hints, rather than a unique drawing of each dictionary item.

Length difficulty counts guessable **written units**, including repetitions;
spaces, hyphens, tone marks and ー do not add length. Latin languages use easy
1–4, medium 5–7, hard 8–32. Chinese pronunciation uses 1–4 / 5–6 / 7–32 symbols
or letters. Japanese, Korean and Hindi use 1–2 / 3 / 4–32 kana, syllable blocks or
graphemes respectively. Difficulty is by length, not a vocabulary learning grade.

## Persistence, accessibility and limits

- Settings, progress and statistics use the versioned local key **`hangman:v1`**.
  Solo rounds resume automatically; unfinished two-player rounds resume behind
  the covered handoff. Home also has Resume. An unfinished secret-entry draft
  is memory-only and is discarded on reload. Completed results are counted once.
  Damaged saves recover to Home, retaining valid settings. Storage failures show
  a translated message while allowing play.
- Secrets are stored as local text to support reload. This is a shared-device
  game, not protection against someone inspecting browser storage/source. No
  secret is put in a URL, transmitted, or exposed in covered-screen HTML.
- Automatic light/dark mode follows the system. Manual Automatic/Light/Dark is
  stored locally. Text colors meet AA contrast in both palettes. Used keys have
  text plus **✓**, **×** or **?**, so feedback does not depend on color alone.
- All controls, including letter keys, are at least 44×44 CSS px. At 360×640 the
  page scrolls vertically for larger alphabets; no board zoom or reduced targets
  are needed. Desktop content is centered with a larger illustration. Safe-area
  padding and reduced-motion preferences are respected.
- Desktop: Tab/Shift+Tab and Enter/Space work throughout; physical letter keys
  also guess during play. Use the on-screen keyboard for scripts that an IME
  cannot emit as individual key events. Text-entry fields, composition, repeat
  events and modifier shortcuts never submit guesses. Turn changes, guesses,
  hints and results are announced in a persistent polite live region.
- Requires a modern browser with ES modules, Unicode property escapes and
  `Intl.Segmenter`. The system font must support the chosen script. There are no
  external font, analytics, CDN, fetch, sign-in or rooms API calls. Serving the
  game loads its own local HTML/CSS/JS assets as usual.
- The computer selects from a small in-memory filtered array; no search is
  needed. All shipped code, UI translations and styles fit below 150 KB
  uncompressed excluding `src/words/`.

## Verification and files

`npm test` covers every dictionary word's spelling uniqueness, alphabet, length,
clue, category and complete solve/reload; nine-language normalization/reveals;
all 11,172 Hangul decomposition/composition round trips; wins, losses, hints and
keyboard state; deterministic computer selection; exact i18n key/placeholder
parity; controller/storage/privacy flows; and the real app event handlers using
small DOM/storage boundaries without jsdom or dependencies.

The requested `python3 -m http.server 5183 --bind 127.0.0.1` smoke check was
attempted, but the implementation sandbox rejected the listen socket with
`PermissionError: [Errno 1] Operation not permitted`. As a fallback, Python's
actual `SimpleHTTPRequestHandler` was exercised with in-memory HTTP requests for
the entry point, stylesheet and every module, checking responses and MIME types
without binding a socket. This is not a real port/fetch test. No browser was
used. The verifier should run the real HTTP smoke check and check 360×640 portrait, desktop, both palettes,
Tab/Enter navigation, a Hindi conjunct, Korean compound vowels, and a two-player
handoff after reload. Real-device layout and font rendering remain to be verified.

| File | Purpose |
|---|---|
| `index.html`, `package.json` | Static entry point and development/test scripts |
| `src/alphabet.js` | Segmentation, language alphabets, matching and Hangul conversion |
| `src/logic.js` | Pure round rules, keyboard state and save validation |
| `src/ai.js` | Injectable-random computer word selection |
| `src/controller.js` | Screen/state transitions, settings, statistics and storage |
| `src/i18n.js` | Nine complete dictionaries and locale negotiation |
| `src/word-list.js`, `src/words/*.js` | 1,350 word/clue pairs and length classification |
| `src/view.js`, `src/app.js` | DOM-free renderer and browser event wiring |
| `src/art.js`, `src/style.css` | Original SVG illustrations and responsive themes |
| `tests/*.test.mjs` | Rules, lists, AI, translations, controller and app-handler tests |
| `ASSETS.md` | Asset and licence record |
