# Werewolf（狼人殺）

Pass-one-phone version of the classic folk party game, 5–12 players. The app is the
moderator: it deals roles, walks the phone around twice each night, announces the
morning, handles the hunter, times the day and records the vote.

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
npm test        # node --test (rules engine)
```

## Roles by player count

| Players | Werewolves | Special roles | Villagers |
|---|---|---|---|
| 5 | 1 | Seer, Witch | 2 |
| 6 | 2 | Seer, Witch | 2 |
| 7–8 | 2 | Seer, Witch, Hunter | 2–3 |
| 9 | 3 | Seer, Witch, Hunter | 3 |
| 10–11 | 3 | Seer, Witch, Hunter, Guard | 3–4 |
| 12 | 4 | Seer, Witch, Hunter, Guard | 4 |
| 13–16 (room-code version, later) | 4–5 | same | rest |

## Rules implemented

- Night, round one (everyone alive): guard protects (not the same person two nights running),
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
- Reloading never lands on a private screen: the game reopens on the home screen and resumes
  at the next hand-off (or hands the phone back to whoever was reading a private result).

## Files

| Path | What |
|---|---|
| `src/logic.js` | Pure rules engine (no DOM), supports up to 16 players for a future room-code host |
| `src/app.js` | Pass-one-phone UI, narration, timer, persistence |
| `src/i18n.js` | Strings (classic and family wording, zh-TW and English) |
| `src/style.css` | Styles (light/dark) |
| `tests/logic.test.mjs` | Rules tests, including 600 random full games |
| `ASSETS.md` | Asset and licence record |
