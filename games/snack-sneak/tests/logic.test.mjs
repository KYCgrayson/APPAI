import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/logic.js';

function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const names = (n) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

/** Build a game with a fixed role layout (roles[i] for seat i). */
function fixed(roles) {
  const g = L.newGame(names(roles.length), seeded(1));
  roles.forEach((r, i) => (g.players[i].role = r));
  return g;
}

/** Everyone acts; picks maps seat -> target, otherwise first legal target. */
function playNight(g, picks = {}) {
  for (let s = 0; s < g.n; s++) {
    const t = s in picks ? picks[s] : L.legalTargets(g, s)[0];
    L.act(g, s, t);
  }
  return L.resolveNight(g);
}

test('role counts for every supported size', () => {
  for (let n = L.MIN_PLAYERS; n <= L.MAX_PLAYERS; n++) {
    const r = L.rolesFor(n);
    assert.equal(r.length, n);
    assert.equal(r.filter((x) => x === 'sneak').length, L.sneakCount(n));
    assert.equal(r.filter((x) => x === 'sniffer').length, 1);
    assert.equal(r.filter((x) => x === 'guard').length, 1);
    assert.equal(r.filter((x) => x === 'crumb').length, n >= 7 ? 1 : 0);
    // sneaks always a clear minority
    assert.ok(L.sneakCount(n) * 2 < n);
  }
  assert.throws(() => L.rolesFor(4));
  assert.throws(() => L.rolesFor(17));
});

test('sneak count and threshold table', () => {
  assert.deepEqual([5, 6, 7, 9, 10, 12, 13, 16].map(L.sneakCount), [1, 1, 2, 2, 3, 3, 4, 4]);
  assert.deepEqual([5, 6, 7, 8, 12, 16].map(L.threshold), [3, 3, 4, 4, 6, 8]);
});

test('newGame deals a permutation of the role list', () => {
  const g = L.newGame(names(10), seeded(7));
  assert.deepEqual(g.players.map((p) => p.role).sort(), L.rolesFor(10).sort());
  assert.equal(g.night, 1);
  assert.equal(L.eatenCount(g), 0);
});

test('every player acts each night, including kitchen helpers', () => {
  const g = fixed(['sneak', 'sniffer', 'guard', 'detective', 'detective']);
  assert.equal(L.nightTask(g, 3), 'suspect');
  L.vote(g, 4); // send a detective to wash dishes
  assert.equal(L.nightTask(g, 4), 'helper');
  for (let s = 0; s < 4; s++) L.act(g, s, L.legalTargets(g, s)[0]);
  assert.equal(L.nightComplete(g), false);
  assert.throws(() => L.resolveNight(g));
  L.act(g, 4, 0);
  assert.equal(L.nightComplete(g), true);
});

test('nobody acts twice and targets must be legal', () => {
  const g = fixed(['sneak', 'sniffer', 'guard', 'detective', 'detective']);
  assert.throws(() => L.act(g, 1, 1), /illegal/); // sniffer cannot sniff self
  L.act(g, 0, 3);
  assert.throws(() => L.act(g, 0, 2), /already/);
});

test('sniffer learns the truth privately', () => {
  const g = fixed(['sneak', 'sniffer', 'guard', 'detective', 'detective']);
  assert.equal(L.act(g, 1, 0).isSneak, true);
  const g2 = fixed(['sneak', 'sniffer', 'guard', 'detective', 'detective']);
  assert.equal(L.act(g2, 1, 3).isSneak, false);
});

test('guard blocks the sneak and cannot guard the same plate twice in a row', () => {
  const g = fixed(['sneak', 'sniffer', 'guard', 'detective', 'detective']);
  const r = playNight(g, { 0: 3, 2: 3 });
  assert.equal(r.blocked, true);
  assert.equal(r.eaten, null);
  assert.equal(L.eatenCount(g), 0);
  L.vote(g, null);
  assert.ok(!L.legalTargets(g, 2).includes(3));
  const r2 = playNight(g, { 0: 3, 2: 4 });
  assert.equal(r2.eaten, 3);
  assert.equal(g.eaten[3], true);
});

test('eaten plates cannot be eaten again', () => {
  const g = fixed(['sneak', 'sniffer', 'guard', 'detective', 'detective']);
  playNight(g, { 0: 4, 2: 1 });
  L.vote(g, null);
  assert.ok(!L.legalTargets(g, 0).includes(4));
});

test('later sneak overrides the earlier proposal', () => {
  const g = fixed(['sneak', 'sneak', 'sniffer', 'guard', 'detective', 'detective', 'crumb']);
  const r = playNight(g, { 0: 4, 1: 5, 3: 2 });
  assert.equal(r.eaten, 5);
});

test('helpers suspicion is reported in the morning', () => {
  const g = fixed(['sneak', 'sniffer', 'guard', 'detective', 'detective']);
  L.vote(g, 3);
  const r = playNight(g, { 3: 0 });
  assert.deepEqual(r.helpers, [0]);
});

test('sneaks win by eating enough plates', () => {
  const g = fixed(['sneak', 'sniffer', 'guard', 'detective', 'detective']);
  // threshold(5) = 3; guard always guards plate 0 or 1, sneak eats 2,3,4
  playNight(g, { 0: 2, 2: 0 });
  L.vote(g, null);
  playNight(g, { 0: 3, 2: 1 });
  assert.equal(g.winner, null);
  L.vote(g, null);
  playNight(g, { 0: 4, 2: 0 });
  assert.equal(g.winner, 'sneak');
  assert.throws(() => L.vote(g, null), /game over/);
});

test('good wins when every sneak is washing dishes', () => {
  const g = fixed(['sneak', 'sneak', 'sniffer', 'guard', 'detective', 'detective', 'crumb']);
  playNight(g, { 0: 4, 1: 4, 3: 4 });
  assert.equal(L.vote(g, 0), null);
  assert.equal(g.night, 2);
  playNight(g, { 1: 5, 3: 6 });
  assert.equal(L.vote(g, 1), 'good');
});

test('sneaks win when they reach parity with active good players', () => {
  const g = fixed(['sneak', 'sniffer', 'guard', 'detective', 'detective']);
  // vote out good players: 4 good -> after 3 wrong votes, 1 sneak vs 1 good
  playNight(g, { 0: 1, 2: 1 });
  L.vote(g, 4);
  playNight(g, { 0: 1, 2: 2 });
  L.vote(g, 3);
  assert.equal(g.winner, null);
  playNight(g, { 0: 3, 2: 3 });
  assert.equal(L.vote(g, 2), 'sneak');
});

test('cannot vote someone already washing dishes', () => {
  const g = fixed(['sneak', 'sniffer', 'guard', 'detective', 'detective']);
  playNight(g);
  L.vote(g, 4);
  playNight(g);
  assert.throws(() => L.vote(g, 4), /not active/);
});

test('crumb hint always contains an active sneak and three distinct seats', () => {
  const rng = seeded(3);
  for (let k = 0; k < 200; k++) {
    const g = L.newGame(names(7 + (k % 10)), rng);
    const h = L.crumbHint(g, rng);
    assert.equal(new Set(h).size, 3);
    assert.ok(h.some((s) => g.players[s].role === 'sneak'));
    // seats are consecutive around the table
    const sneak = h.find((s) => g.players[s].role === 'sneak');
    assert.ok(h.every((s) => {
      const d = Math.abs(s - sneak);
      return Math.min(d, g.n - d) <= 2;
    }));
  }
});

test('random full games always terminate with a winner', () => {
  const rng = seeded(11);
  const wins = { good: 0, sneak: 0 };
  for (let k = 0; k < 500; k++) {
    const n = L.MIN_PLAYERS + (k % (L.MAX_PLAYERS - L.MIN_PLAYERS + 1));
    const g = L.newGame(names(n), rng);
    let guard = 0;
    while (!g.winner && guard++ < 100) {
      for (let s = 0; s < n; s++) {
        const t = L.legalTargets(g, s);
        L.act(g, s, t[Math.floor(rng() * t.length)]);
      }
      L.resolveNight(g);
      if (g.winner) break;
      const a = L.activeSeats(g);
      L.vote(g, rng() < 0.2 ? null : a[Math.floor(rng() * a.length)]);
    }
    assert.ok(g.winner, `n=${n} did not finish`);
    wins[g.winner]++;
  }
  assert.ok(wins.good > 0 && wins.sneak > 0);
});
