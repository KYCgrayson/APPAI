# Werewolf（狼人殺）

Static version of the classic folk party game: 3–12 players with the app hosting,
or 3–16 players plus a human host. It deals roles, announces the morning, handles
the hunter, times the day and records the vote.

- Generic folk-game roles only: Werewolf, Villager, Seer, Witch, Hunter, Guard.
  No commercial edition's trademarks, card art or edition-specific roles.
- "Family wording" setting (親子用語) swaps "killed / out" for "taken / sent home to sleep".
- No build step, no dependencies, no network calls, no sign-in. Plain HTML/CSS/ES modules.
- Progress is kept in `localStorage` (`werewolf:v1`) on the device only.
- Narration uses the browser's built-in speech synthesis (on-device, free); it can be turned off.
- zh-TW and English (`?lang=zh` / `?lang=en`, or the toggle on the home screen).

## Run

```bash
npm run dev     # python3 -m http.server 5180, then open http://localhost:5180
npm test        # node --test (rules engine and UI flows)
```

## Roles by player count

| Players | Werewolves | Special roles | Villagers |
|---|---|---|---|
| 3 (small game) | 1 | Seer | 1 |
| 4 (small game) | 1 | Seer, Witch | 1 |
| 5 | 1 | Seer, Witch | 2 |
| 6 | 2 | Seer, Witch | 2 |
| 7–8 | 2 | Seer, Witch, Hunter | 2–3 |
| 9 | 3 | Seer, Witch, Hunter | 3 |
| 10–11 | 3 | Seer, Witch, Hunter, Guard | 3–4 |
| 12 | 4 | Seer, Witch, Hunter, Guard | 4 |
| 13–15 (human host) | 4 | Seer, Witch, Hunter, Guard | 5–7 |
| 16 (human host) | 5 | Seer, Witch, Hunter, Guard | 7 |

## Host modes

- **App / App 主持** (default): everyone plays; pass the phone for the hold-to-reveal
  round and twice each night. The limit is 12 players.
- **A person / 真人主持**: one adult holds the phone, has no role and does not play.
  The 3–16 player count excludes the host. Choose the usual private hold-to-reveal
  round (first option), or a host-only role table to tell everyone privately.
  At night, read the script: close eyes → guard (if dealt) → wolves → seer → witch
  (if dealt) → morning. Tap the players' pointed-at targets; gesture the seer's
  answer silently. Read a departed role's lines and pause anyway to conceal its
  absence. There are no phone hand-offs during a human-hosted night.
- Reload opens Home. Resume returns a human host directly to the saved script
  step and choices; app-host private turns still resume behind a hand-off.

## Small games

For 3 players, deal a werewolf, seer and villager; at 4, add a witch. Night one is
always peaceful: wolves still take their turn but their pick has no effect, the
witch sees no victim and cannot use either potion, and the seer checks normally.
App mode keeps both complete phone rounds (the witch picks a suspect on night one);
the human script gives the wolf no target grid and reminds the witch to keep both potions.
Normal night actions begin on night two. Win conditions stay the same: a correct
day-one vote wins for the village, and a wrong vote at 3 players wins for the wolf.

## Rules implemented

- Night, round one (everyone alive in app mode): guard protects (not the same person two nights running),
  werewolves choose a victim (a later wolf sees and may change the earlier pick), seer checks
  one person. Everyone else picks a suspect, so every turn looks alike.
- Night, round two (everyone alive): the witch (once she has no potions left she picks a suspect like everyone else) sees tonight's victim while she still has the
  healing potion; she may heal (not herself) or poison someone, one potion per night, each once.
- Morning: who is out is announced; roles stay secret until the end.
- Hunter: when killed by werewolves or voted out, may take one person; not when poisoned (poison wins if the wolves picked the same person).
- Someone both guarded and healed on the same night survives (a common house variant).
- Day: discussion timer, then a single vote (tie = nobody out).
- Win: village wins when no werewolf is alive; werewolves win when alive werewolves ≥ everyone else.

## Pass-the-phone privacy

- Every living player takes a turn in both night rounds and every turn is "pick a seat".
- Roles are shown only while the card is held down.
- Taps are ignored for 450 ms after each screen change, so a double tap cannot open the next
  player's private screen.
- In app mode, reloading never lands on a private screen: the game reopens on the home screen and resumes
  at the next hand-off (or hands the phone back to whoever was reading a private result).

## Files

| Path | What |
|---|---|
| `src/logic.js` | Pure rules engine (no DOM), 3–16 players, peaceful first nights and `fillPass` for human hosting |
| `src/app.js` | Pass-one-phone UI, human-host script, narration, timer, persistence |
| `src/i18n.js` | Strings (classic and family wording, zh-TW and English) |
| `src/style.css` | Styles (light/dark) |
| `tests/logic.test.mjs` | Rules tests, including 600 random full games |
| `tests/app.test.mjs` | Dependency-free UI flow, narration and reload/privacy regression tests |
| `ASSETS.md` | Asset and licence record |
