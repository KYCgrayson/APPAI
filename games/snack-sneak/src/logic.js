// Snack Sneaks — pure game rules. No DOM, no storage; everything is plain data
// so the same engine can later run on a room-code (multi-phone) host.

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 16; // rules support 16; the pass-one-phone UI caps at 12
export const PASS_AND_PLAY_MAX = 12;

export const ROLES = ['sneak', 'sniffer', 'guard', 'crumb', 'detective'];

export function sneakCount(n) {
  if (n <= 6) return 1;
  if (n <= 9) return 2;
  if (n <= 12) return 3;
  return 4;
}

/** Plates the sneaks must eat to win. */
export function threshold(n) {
  return Math.ceil(n / 2);
}

export function rolesFor(n) {
  if (!Number.isInteger(n) || n < MIN_PLAYERS || n > MAX_PLAYERS) {
    throw new RangeError(`players must be ${MIN_PLAYERS}-${MAX_PLAYERS}`);
  }
  const roles = Array(sneakCount(n)).fill('sneak');
  roles.push('sniffer', 'guard');
  if (n >= 7) roles.push('crumb');
  while (roles.length < n) roles.push('detective');
  return roles;
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newGame(names, rng = Math.random) {
  const n = names.length;
  const roles = shuffle(rolesFor(n), rng);
  return {
    v: 1,
    n,
    players: names.map((name, i) => ({ name, role: roles[i], out: false })),
    eaten: Array(n).fill(false),
    night: 1,
    lastGuard: null,
    actions: emptyActions(),
    log: [],
    winner: null,
  };
}

function emptyActions() {
  return { sneak: null, guard: null, sniff: null, helpers: [], done: [], hint: null };
}

export const isActive = (g, seat) => !g.players[seat].out;
export const activeSeats = (g) => g.players.map((_, i) => i).filter((i) => isActive(g, i));
export const sneakSeats = (g) => g.players.map((_, i) => i).filter((i) => g.players[i].role === 'sneak');
export const eatenCount = (g) => g.eaten.filter(Boolean).length;

/** What this seat does at night. Players sent to wash dishes become kitchen helpers. */
export function nightTask(g, seat) {
  if (!isActive(g, seat)) return 'helper';
  const r = g.players[seat].role;
  return r === 'crumb' ? 'suspect' : r === 'detective' ? 'suspect' : r;
}

/** Seats this player may pick tonight. Every task picks exactly one seat, so turns look alike. */
export function legalTargets(g, seat) {
  const task = nightTask(g, seat);
  const all = g.players.map((_, i) => i);
  const uneaten = all.filter((i) => !g.eaten[i]);
  const othersActive = all.filter((i) => i !== seat && isActive(g, i));
  switch (task) {
    case 'sneak':
      return uneaten;
    case 'guard': {
      const t = uneaten.filter((i) => i !== g.lastGuard);
      return t.length ? t : uneaten;
    }
    default:
      return othersActive;
  }
}

/**
 * Record one night action. Returns private feedback for the acting player:
 * the sniffer learns whether the target is a sneak.
 */
export function act(g, seat, target) {
  if (g.winner) throw new Error('game over');
  if (g.actions.done.includes(seat)) throw new Error('already acted');
  if (!legalTargets(g, seat).includes(target)) throw new Error('illegal target');
  const task = nightTask(g, seat);
  g.actions.done.push(seat);
  switch (task) {
    case 'sneak':
      g.actions.sneak = target; // later sneaks see the proposal and may change it
      return { task };
    case 'guard':
      g.actions.guard = target;
      return { task };
    case 'sniffer':
      g.actions.sniff = target;
      return { task, isSneak: g.players[target].role === 'sneak' };
    case 'helper':
      g.actions.helpers.push(target);
      return { task };
    default:
      return { task };
  }
}

/** Three neighbouring seats, at least one of which is an active sneak. */
export function crumbHint(g, rng = Math.random) {
  const sneaks = sneakSeats(g).filter((i) => isActive(g, i));
  if (!sneaks.length) return null;
  const s = sneaks[Math.floor(rng() * sneaks.length)];
  const start = s - Math.floor(rng() * 3);
  // In seat order around the table, so a wrapped window reads 12, 1, 2.
  return [0, 1, 2].map((k) => (((start + k) % g.n) + g.n) % g.n);
}

export function nightComplete(g) {
  return g.actions.done.length === g.n;
}

/** Resolve the night. Returns the morning report (also appended to g.log). */
export function resolveNight(g) {
  if (!nightComplete(g)) throw new Error('night not complete');
  const { sneak, guard, helpers } = g.actions;
  const blocked = sneak !== null && sneak === guard;
  const eatenSeat = sneak !== null && !blocked ? sneak : null;
  if (eatenSeat !== null) g.eaten[eatenSeat] = true;
  g.lastGuard = guard;
  const report = { night: g.night, eaten: eatenSeat, blocked, helpers: helpers.slice(), voted: undefined };
  g.log.push(report);
  g.actions = emptyActions();
  if (eatenCount(g) >= threshold(g.n)) g.winner = 'sneak';
  return report;
}

/** Day vote. seat === null means a tie / nobody is sent to wash dishes. */
export function vote(g, seat) {
  if (g.winner) throw new Error('game over');
  if (seat !== null && !isActive(g, seat)) throw new Error('not active');
  const entry = g.log[g.log.length - 1];
  if (entry) entry.voted = seat;
  if (seat !== null) g.players[seat].out = true;
  const active = activeSeats(g);
  const sneaks = active.filter((i) => g.players[i].role === 'sneak').length;
  if (sneaks === 0) g.winner = 'good';
  else if (sneaks >= active.length - sneaks) g.winner = 'sneak';
  else g.night += 1;
  return g.winner;
}
