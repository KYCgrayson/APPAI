// Werewolf (狼人殺) — pure rules engine for the classic folk party game.
// No DOM, no storage: plain data, so a later room-code host can reuse it.
//
// Night (everyone alive passes the phone twice, so turns look alike):
//   pass 1: guard protects, wolves choose a victim, seer checks; others pick a suspect
//   pass 2: witch may save the victim or poison someone; others pick a suspect
// Morning: deaths are announced (roles stay hidden). A hunter killed by wolves
// or voted out may take someone with them; a poisoned hunter cannot.
// Win: good wins when no wolf is alive; wolves win when alive wolves >= alive others.

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 16; // human host; the pass-one-phone UI caps at 12
export const PASS_AND_PLAY_MAX = 12;

export const ROLES = ['wolf', 'villager', 'seer', 'witch', 'hunter', 'guard'];

export function wolfCount(n) {
  if (n <= 5) return 1;
  if (n <= 8) return 2;
  if (n <= 11) return 3;
  if (n <= 15) return 4;
  return 5;
}

export function rolesFor(n) {
  if (!Number.isInteger(n) || n < MIN_PLAYERS || n > MAX_PLAYERS) {
    throw new RangeError(`players must be ${MIN_PLAYERS}-${MAX_PLAYERS}`);
  }
  const roles = Array(wolfCount(n)).fill('wolf');
  roles.push('seer');
  if (n >= 4) roles.push('witch');
  if (n >= 7) roles.push('hunter');
  if (n >= 10) roles.push('guard');
  while (roles.length < n) roles.push('villager');
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
  const roles = shuffle(rolesFor(names.length), rng);
  return {
    v: 2,
    n: names.length,
    quiet1: names.length <= 4,
    players: names.map((name, i) => ({ name, role: roles[i], alive: true, cause: null, day: null })),
    night: 1,
    potions: { save: true, poison: true },
    lastGuard: null,
    actions: emptyActions(),
    pendingShot: null,
    log: [],
    winner: null,
  };
}

function emptyActions() {
  return { wolf: null, guard: null, seer: null, save: false, poison: null, pass1: [], pass2: [] };
}

const seats = (g) => g.players.map((_, i) => i);
export const isAlive = (g, s) => g.players[s].alive;
export const aliveSeats = (g) => seats(g).filter((s) => isAlive(g, s));
export const wolfSeats = (g) => seats(g).filter((s) => g.players[s].role === 'wolf');
export const seatOf = (g, role) => seats(g).find((s) => g.players[s].role === role);
// Missing on older saves: their first night keeps the original rules.
export const quietNight = (g) => Boolean(g.quiet1 && g.night === 1);

/** Night pass-1 task for a seat. */
export function task1(g, seat) {
  const r = g.players[seat].role;
  return r === 'wolf' || r === 'seer' || r === 'guard' ? r : 'suspect';
}

/** Night pass-2 task for a seat. */
export function task2(g, seat) {
  return g.players[seat].role === 'witch' ? 'witch' : 'suspect';
}

export function targets1(g, seat) {
  const alive = aliveSeats(g);
  switch (task1(g, seat)) {
    case 'wolf':
      return alive.filter((s) => g.players[s].role !== 'wolf');
    case 'guard':
      return alive.filter((s) => s !== g.lastGuard);
    default:
      return alive.filter((s) => s !== seat);
  }
}

export const pass1Done = (g) => aliveSeats(g).every((s) => g.actions.pass1.includes(s));
export const pass2Done = (g) => aliveSeats(g).every((s) => g.actions.pass2.includes(s));

function guardTurn(g, seat, pass) {
  if (g.winner) throw new Error('game over');
  if (g.pendingShot !== null) throw new Error('hunter must shoot first');
  if (!isAlive(g, seat)) throw new Error('not alive');
  const list = pass === 1 ? g.actions.pass1 : g.actions.pass2;
  if (list.includes(seat)) throw new Error('already acted');
  if (pass === 2 && !pass1Done(g)) throw new Error('pass 1 not finished');
}

/** Pass 1. Returns private feedback (the seer learns whether the target is a wolf). */
export function act1(g, seat, target) {
  guardTurn(g, seat, 1);
  if (!targets1(g, seat).includes(target)) throw new Error('illegal target');
  const task = task1(g, seat);
  g.actions.pass1.push(seat);
  if (task === 'wolf' && !quietNight(g)) g.actions.wolf = target; // last wolf pick wins
  if (task === 'guard') g.actions.guard = target;
  if (task === 'seer') {
    g.actions.seer = target;
    return { task, isWolf: g.players[target].role === 'wolf' };
  }
  return { task };
}

/** What the witch is told and allowed to do tonight. */
export function witchView(g, seat) {
  const quiet = quietNight(g);
  const victim = quiet ? null : g.actions.wolf;
  return {
    // She only learns the victim while she still holds the save potion.
    victim: g.potions.save ? victim : null,
    canSave: g.potions.save && victim !== null && victim !== seat,
    canPoison: g.potions.poison && !quiet,
    poisonTargets: aliveSeats(g).filter((s) => s !== seat),
  };
}

/**
 * Pass 2. For the witch: choice = { save: boolean, poison: seat|null } (not both).
 * For everyone else: choice = { suspect: seat } (not used by the rules).
 */
export function act2(g, seat, choice = {}) {
  guardTurn(g, seat, 2);
  if (task2(g, seat) === 'witch') {
    const v = witchView(g, seat);
    const save = Boolean(choice.save);
    const poison = choice.poison ?? null;
    if (save && !v.canSave) throw new Error('cannot save');
    if (poison !== null && (!v.canPoison || !v.poisonTargets.includes(poison))) throw new Error('cannot poison');
    if (save && poison !== null) throw new Error('one potion per night');
    g.actions.save = save;
    g.actions.poison = poison;
    if (save) g.potions.save = false;
    if (poison !== null) g.potions.poison = false;
  } else if (choice.suspect !== undefined && !aliveSeats(g).filter((s) => s !== seat).includes(choice.suspect)) {
    throw new Error('illegal target');
  }
  g.actions.pass2.push(seat);
  return { task: task2(g, seat) };
}

/** Complete unplayed living seats without changing any role's action (human host). */
export function fillPass(g, pass) {
  if (pass !== 1 && pass !== 2) throw new Error('invalid pass');
  if (g.winner) throw new Error('game over');
  if (g.pendingShot !== null) throw new Error('hunter must shoot first');
  if (pass === 2 && !pass1Done(g)) throw new Error('pass 1 not finished');
  const acted = pass === 1 ? g.actions.pass1 : g.actions.pass2;
  for (const s of aliveSeats(g)) if (!acted.includes(s)) acted.push(s);
}

function kill(g, seat, cause) {
  const p = g.players[seat];
  p.alive = false;
  p.cause = cause;
  p.day = g.night;
  if (p.role === 'hunter' && cause !== 'poison' && cause !== 'hunter') g.pendingShot = seat;
}

/** Resolve the night. Returns the morning report, also appended to g.log. */
export function resolveNight(g) {
  if (!pass1Done(g) || !pass2Done(g)) throw new Error('night not complete');
  const { wolf, guard, save, poison } = g.actions;
  const deaths = [];
  // Poison wins over a wolf kill on the same seat, so a poisoned hunter cannot shoot.
  if (!quietNight(g)) {
    if (wolf !== null && wolf !== guard && !save && wolf !== poison) deaths.push([wolf, 'wolf']);
    if (poison !== null) deaths.push([poison, 'poison']);
  }
  // Variant: someone both guarded and healed survives (documented in the rules text).
  for (const [s, cause] of deaths) kill(g, s, cause);
  g.lastGuard = guard;
  const report = { night: g.night, deaths: deaths.map(([s]) => s).sort((a, b) => a - b), shot: null, voted: undefined };
  g.log.push(report);
  g.actions = emptyActions();
  if (g.pendingShot === null) checkWin(g);
  return report;
}

/** Hunter's shot (public). target null = holds fire. */
export function shoot(g, target) {
  if (g.pendingShot === null) throw new Error('no shot pending');
  if (target !== null && (!isAlive(g, target) || target === g.pendingShot)) throw new Error('illegal target');
  g.pendingShot = null;
  const entry = g.log[g.log.length - 1];
  if (entry) entry.shot = target;
  if (target !== null) kill(g, target, 'hunter');
  checkWin(g);
  return g.winner;
}

/** Day vote. seat null = tie, nobody leaves. */
export function vote(g, seat) {
  if (g.winner) throw new Error('game over');
  if (g.pendingShot !== null) throw new Error('hunter must shoot first');
  if (seat !== null && !isAlive(g, seat)) throw new Error('not alive');
  const entry = g.log[g.log.length - 1];
  if (entry) entry.voted = seat;
  if (seat !== null) kill(g, seat, 'vote');
  if (g.pendingShot === null) checkWin(g);
  return g.winner;
}

/** Move on to the next night after the day is fully resolved. */
export function nextNight(g) {
  if (g.winner || g.pendingShot !== null) throw new Error('cannot start night');
  g.night += 1;
  g.actions = emptyActions();
}

export function checkWin(g) {
  const alive = aliveSeats(g);
  const wolves = alive.filter((s) => g.players[s].role === 'wolf').length;
  if (wolves === 0) g.winner = 'good';
  else if (wolves >= alive.length - wolves) g.winner = 'wolf';
  return g.winner;
}
