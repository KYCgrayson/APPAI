# Snack Sneaks（點心小偷）

Original hidden-role party game for families, 5–12 players, one phone passed around.
The app is the host: it deals roles, walks the phone around at night, announces
the morning, runs the discussion timer and records the vote.

- No build step, no dependencies, no network calls, no sign-in. Plain HTML/CSS/ES modules.
- Progress is kept in `localStorage` on the device only.
- Narration uses the browser's built-in speech synthesis (on-device, free); it can be turned off.
- zh-TW and English (`?lang=zh` / `?lang=en`, or the toggle on the home screen).

## Run

```bash
npm run dev     # python3 -m http.server 5180, then open http://localhost:5180
npm test        # node --test (rules engine)
```

## Rules (summary)

| Players | Sneaks | Plates the sneaks must eat |
|---|---|---|
| 5–6 | 1 | 3 |
| 7–9 | 2 | 4–5 |
| 10–12 | 3 | 5–6 |
| 13–16 (room-code version, later) | 4 | 7–8 |

Roles: Sneak, Sniffer (learns if one player is a sneak), Plate Guard (protects one plate,
not the same plate twice in a row), Crumb Expert (7+ players; gets three neighbouring seats
that hide a sneak), Detective. Players voted out "wash dishes" instead of being eliminated:
they become Kitchen Helpers who still point at a suspect each night, announced in the morning.

Good wins when every sneak is washing dishes. Sneaks win by eating half the plates
(rounded up) or by matching the number of active good players.

## Pass-the-phone privacy

- Every player gets a night turn and every turn is "pick one seat", so who holds the
  phone and for how long does not reveal roles.
- Roles are shown only while the card is held down.
- Reloading never lands on a private screen: the game reopens on the home screen and
  resumes at the next hand-off.

## Files

| Path | What |
|---|---|
| `src/logic.js` | Pure rules engine (no DOM); reusable by a future room-code host |
| `src/app.js` | Pass-one-phone UI, narration, timer, persistence |
| `src/i18n.js` | Strings |
| `src/style.css` | Styles (light/dark) |
| `tests/logic.test.mjs` | Rules tests, including 500 random full games |
| `ASSETS.md` | Asset and licence record |

The room-code version (each player on their own phone) waits for the rooms API.
