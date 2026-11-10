import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/logic.js';

function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const names = (n) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

function fixed(roles) {
  const g = L.newGame(names(roles.length), seeded(1));
  roles.forEach((r, i) => (g.players[i].role = r));
  return g;
}

/**
 * Play one night. p1: seat -> pass-1 target; witch: {save, poison}.
 * Unlisted seats pick their first legal target.
 */
function night(g, p1 = {}, witch = {}) {
  for (const s of L.aliveSeats(g)) L.act1(g, s, s in p1 ? p1[s] : L.targets1(g, s)[0]);
  for (const s of L.aliveSeats(g)) {
    if (L.task2(g, s) === 'witch') L.act2(g, s, witch);
    else L.act2(g, s, {});
  }
  return L.resolveNight(g);
}

// 0 wolf, 1 wolf, 2 seer, 3 witch, 4 hunter, 5 villager, 6 villager
const SEVEN = ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager', 'villager'];

test('role table for every supported size', () => {
  assert.equal(L.MIN_PLAYERS, 3);
  assert.equal(L.MAX_PLAYERS, 16);
  for (let n = L.MIN_PLAYERS; n <= L.MAX_PLAYERS; n++) {
    const r = L.rolesFor(n);
    assert.equal(r.length, n);
    assert.equal(r.filter((x) => x === 'wolf').length, L.wolfCount(n));
    assert.equal(r.filter((x) => x === 'seer').length, 1);
    assert.equal(r.filter((x) => x === 'witch').length, n >= 4 ? 1 : 0);
    assert.equal(r.filter((x) => x === 'hunter').length, n >= 7 ? 1 : 0);
    assert.equal(r.filter((x) => x === 'guard').length, n >= 10 ? 1 : 0);
    assert.ok(r.includes('villager'));
    assert.ok(L.wolfCount(n) * 2 < n, `wolves must start as a minority at n=${n}`);
  }
  assert.deepEqual(L.rolesFor(12).slice().sort(), ['guard', 'hunter', 'seer', 'villager', 'villager', 'villager', 'villager', 'witch', 'wolf', 'wolf', 'wolf', 'wolf'].sort());
  assert.deepEqual(L.rolesFor(3), ['wolf', 'seer', 'villager']);
  assert.deepEqual(L.rolesFor(4), ['wolf', 'seer', 'witch', 'villager']);
  assert.throws(() => L.rolesFor(2));
  assert.throws(() => L.rolesFor(3.5));
  assert.throws(() => L.rolesFor(17));
});

test('newGame deals a permutation of the role table', () => {
  const g = L.newGame(names(9), seeded(4));
  assert.deepEqual(g.players.map((p) => p.role).sort(), L.rolesFor(9).sort());
  assert.equal(g.quiet1, false);
});

for (const n of [3, 4]) {
  test(`${n}-player first night is peaceful, potions are forbidden, seer still checks`, () => {
    const g = fixed(L.rolesFor(n));
    assert.equal(g.quiet1, true);
    L.act1(g, 0, n - 1);
    assert.equal(g.actions.wolf, null);
    assert.equal(L.act1(g, 1, 0).isWolf, true);
    for (let s = 2; s < n; s++) L.act1(g, s, L.targets1(g, s)[0]);
    if (n === 4) {
      assert.deepEqual(L.witchView(g, 2), { victim: null, canSave: false, canPoison: false, poisonTargets: [0, 1, 3] });
      assert.throws(() => L.act2(g, 2, { poison: 0 }), /cannot poison/);
      assert.throws(() => L.act2(g, 2, { save: true }), /cannot save/);
    }
    for (const s of L.aliveSeats(g)) L.act2(g, s, {});
    // Resolution also protects a quiet night from stale/injected action data.
    g.actions.wolf = n - 1;
    g.actions.poison = 0;
    assert.deepEqual(L.resolveNight(g).deaths, []);
    assert.equal(L.aliveSeats(g).length, n);
    assert.deepEqual(g.potions, { save: true, poison: true });
    assert.equal(g.winner, null);

    const goodCheck = fixed(L.rolesFor(n));
    assert.equal(L.act1(goodCheck, 1, n - 1).isWolf, false);
  });

  test(`${n}-player correct day-one vote wins for the village`, () => {
    const g = fixed(L.rolesFor(n));
    assert.deepEqual(night(g).deaths, []);
    assert.equal(L.vote(g, 0), 'good');
  });

  test(`${n}-player quiet rule ends after night one`, () => {
    const g = fixed(L.rolesFor(n));
    night(g);
    L.vote(g, null);
    L.nextNight(g);
    for (const s of L.aliveSeats(g)) L.act1(g, s, s === 0 ? n - 1 : L.targets1(g, s)[0]);
    if (n === 4) {
      assert.equal(L.witchView(g, 2).victim, 3);
      assert.equal(L.witchView(g, 2).canPoison, true);
    }
    for (const s of L.aliveSeats(g)) L.act2(g, s, {});
    assert.deepEqual(L.resolveNight(g).deaths, [n - 1]);
  });
}

test('wrong day-one vote in a 3-player game gives wolves parity', () => {
  const g = fixed(L.rolesFor(3));
  night(g);
  assert.equal(L.vote(g, 2), 'wolf');
});

test('older saves without quiet1 retain their original first-night rules', () => {
  const g = fixed(L.rolesFor(4));
  delete g.quiet1;
  const r = night(g, { 0: 3 }, { poison: 0 });
  assert.deepEqual(r.deaths, [0, 3]);
  assert.equal(g.winner, 'good');
});

test('fillPass fills only living unplayed seats and leaves role actions intact', () => {
  const g = fixed(SEVEN);
  g.players[6].alive = false;
  L.act1(g, 0, 5);
  L.act1(g, 2, 1);
  const before = structuredClone(g.actions);
  assert.throws(() => L.fillPass(g, 2), /pass 1/);
  assert.deepEqual(g.actions, before);
  L.fillPass(g, 1);
  assert.deepEqual(g.actions.pass1, [0, 2, 1, 3, 4, 5]);
  assert.equal(g.actions.wolf, 5);
  assert.equal(g.actions.seer, 1);
  assert.equal(g.actions.guard, null);
  L.fillPass(g, 1);
  assert.equal(g.actions.pass1.length, 6);
  L.act2(g, 3, { save: true });
  L.fillPass(g, 2);
  assert.deepEqual(g.actions.pass2, [3, 0, 1, 2, 4, 5]);
  assert.equal(g.actions.save, true);
  assert.deepEqual(L.resolveNight(g).deaths, []);
});

test('fillPass respects game-over and pending-hunter guards', () => {
  const g = fixed(SEVEN);
  assert.throws(() => L.fillPass(g, 0), /invalid pass/);
  g.winner = 'good';
  for (const pass of [1, 2]) assert.throws(() => L.fillPass(g, pass), /game over/);
  g.winner = null;
  g.pendingShot = 4;
  for (const pass of [1, 2]) assert.throws(() => L.fillPass(g, pass), /hunter/);
  assert.deepEqual(g.actions.pass1, []);
  assert.deepEqual(g.actions.pass2, []);
});

test('fillPass resolves like suspect picks after role seats have acted', () => {
  const a = fixed(SEVEN);
  const b = fixed(SEVEN);
  for (const g of [a, b]) {
    L.act1(g, 0, 5);
    L.act1(g, 1, 5);
    L.act1(g, 2, 0);
  }
  L.fillPass(a, 1);
  for (let s = 3; s < b.n; s++) L.act1(b, s, L.targets1(b, s)[0]);
  for (const g of [a, b]) L.act2(g, 3, { poison: 0 });
  L.fillPass(a, 2);
  for (const s of L.aliveSeats(b)) if (s !== 3) L.act2(b, s, { suspect: L.aliveSeats(b).find((t) => t !== s) });
  assert.deepEqual(L.resolveNight(a), L.resolveNight(b));
  assert.deepEqual(a, b);
});

test('human-host nights need only role seats plus fillPass, including guard and witch', () => {
  const roles = ['wolf', 'wolf', 'wolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager', 'villager'];
  for (const choice of [{ save: true }, { poison: 0 }, {}]) {
    const g = fixed(roles);
    L.act1(g, 6, choice.save ? 9 : 8);
    L.act1(g, 0, 8); // Only one of three wolves acts; filling the rest preserves this pick.
    assert.equal(L.act1(g, 3, 1).isWolf, true);
    L.fillPass(g, 1);
    assert.equal(g.actions.wolf, 8);
    assert.equal(L.witchView(g, 4).victim, 8);
    L.act2(g, 4, choice);
    L.fillPass(g, 2);
    assert.deepEqual(L.resolveNight(g).deaths, choice.poison === 0 ? [0] : []);
    assert.equal(g.lastGuard, choice.save ? 9 : 8);
    assert.equal(g.potions.save, !choice.save);
    assert.equal(g.potions.poison, choice.poison !== 0);
  }
});

test('wolves kill; peaceful night when the witch saves', () => {
  const g = fixed(SEVEN);
  const r = night(g, { 0: 5, 1: 5 });
  assert.deepEqual(r.deaths, [5]);
  assert.equal(g.players[5].alive, false);
  const g2 = fixed(SEVEN);
  const r2 = night(g2, { 0: 5, 1: 5 }, { save: true });
  assert.deepEqual(r2.deaths, []);
  assert.equal(g2.potions.save, false);
});

test('later wolf overrides the earlier proposal; wolves cannot target wolves', () => {
  const g = fixed(SEVEN);
  assert.ok(!L.targets1(g, 0).includes(1));
  const r = night(g, { 0: 5, 1: 6 });
  assert.deepEqual(r.deaths, [6]);
});

test('seer learns the truth privately', () => {
  const g = fixed(SEVEN);
  L.act1(g, 0, 5);
  assert.equal(L.act1(g, 2, 1).isWolf, true);
  const g2 = fixed(SEVEN);
  assert.throws(() => L.act1(g2, 2, 2), /illegal/);
  assert.equal(L.act1(g2, 2, 6).isWolf, false);
});

test('pass 2 waits for pass 1, nobody acts twice', () => {
  const g = fixed(SEVEN);
  assert.throws(() => L.act2(g, 3, {}), /pass 1/);
  for (const s of L.aliveSeats(g)) L.act1(g, s, L.targets1(g, s)[0]);
  assert.throws(() => L.act1(g, 0, 5), /already/);
  assert.throws(() => L.resolveNight(g), /not complete/);
});

test('witch rules: no self-save, one potion per night, each potion once', () => {
  const g = fixed(SEVEN);
  for (const s of L.aliveSeats(g)) L.act1(g, s, s === 0 || s === 1 ? 3 : L.targets1(g, s)[0]);
  const v = L.witchView(g, 3);
  assert.equal(v.victim, 3);
  assert.equal(v.canSave, false);
  assert.throws(() => L.act2(g, 3, { save: true }), /cannot save/);
  assert.throws(() => L.act2(g, 3, { save: false, poison: 3 }), /cannot poison/);

  const g2 = fixed(SEVEN);
  for (const s of L.aliveSeats(g2)) L.act1(g2, s, s <= 1 ? 5 : L.targets1(g2, s)[0]);
  assert.throws(() => L.act2(g2, 3, { save: true, poison: 0 }), /one potion/);
  L.act2(g2, 3, { poison: 0 });
  for (const s of L.aliveSeats(g2)) if (s !== 3) L.act2(g2, s, {});
  const r = L.resolveNight(g2);
  assert.deepEqual(r.deaths, [0, 5]);
  assert.equal(g2.potions.poison, false);
  L.vote(g2, null);
  L.nextNight(g2);
  for (const s of L.aliveSeats(g2)) L.act1(g2, s, L.targets1(g2, s)[0]);
  assert.equal(L.witchView(g2, 3).canPoison, false);
});

test('witch loses sight of the victim once the save potion is used', () => {
  const g = fixed(SEVEN);
  night(g, { 0: 5, 1: 5 }, { save: true });
  L.vote(g, null);
  L.nextNight(g);
  for (const s of L.aliveSeats(g)) L.act1(g, s, s <= 1 ? 6 : L.targets1(g, s)[0]);
  assert.equal(L.witchView(g, 3).victim, null);
});

test('guard protects and cannot repeat the same seat', () => {
  const roles = ['wolf', 'wolf', 'wolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager', 'villager'];
  const g = fixed(roles);
  const r = night(g, { 0: 8, 1: 8, 2: 8, 6: 8 });
  assert.deepEqual(r.deaths, []);
  L.vote(g, null);
  L.nextNight(g);
  assert.ok(!L.targets1(g, 6).includes(8));
});

test('hunter shoots when killed by wolves or voted out, not when poisoned', () => {
  const g = fixed(SEVEN);
  night(g, { 0: 4, 1: 4 });
  assert.equal(g.pendingShot, 4);
  assert.throws(() => L.vote(g, 0), /hunter/);
  assert.equal(L.shoot(g, 0), null);
  assert.equal(g.players[0].alive, false);
  assert.equal(g.log[0].shot, 0);

  const g2 = fixed(SEVEN);
  night(g2, { 0: 5, 1: 5 }, { poison: 4 });
  assert.equal(g2.pendingShot, null);
  assert.equal(g2.players[4].alive, false);

  const g3 = fixed(SEVEN);
  night(g3, { 0: 5, 1: 5 }, { save: true });
  L.vote(g3, 4);
  assert.equal(g3.pendingShot, 4);
  assert.throws(() => L.shoot(g3, 4), /illegal/);
  L.shoot(g3, null);
  assert.equal(g3.pendingShot, null);
});

test('good wins when every wolf is out', () => {
  const g = fixed(['wolf', 'seer', 'witch', 'villager', 'villager']);
  night(g, { 0: 3 }, { save: true });
  assert.equal(L.vote(g, 0), 'good');
  assert.throws(() => L.nextNight(g));
});

test('wolves win at parity', () => {
  const g = fixed(['wolf', 'seer', 'witch', 'villager', 'villager']);
  night(g, { 0: 3 }); // 4 alive: 1 wolf vs 3
  assert.equal(g.winner, null);
  L.vote(g, 4); // 1 vs 2
  assert.equal(g.winner, null);
  L.nextNight(g);
  night(g, { 0: 1 }); // 1 vs 1
  assert.equal(g.winner, 'wolf');
});

test('hunter shot is resolved before the winner is decided', () => {
  // 1 wolf, hunter killed at night leaves 1 wolf vs 1 villager: hunter shoots the wolf
  const g = fixed(['wolf', 'seer', 'witch', 'hunter', 'villager', 'villager', 'villager']);
  g.players[1].alive = false;
  g.players[2].alive = false;
  g.players[5].alive = false;
  g.players[6].alive = false;
  night(g, { 0: 3 });
  assert.equal(g.winner, null);
  assert.equal(L.shoot(g, 0), 'good');
});

test('dead players take no turns', () => {
  const g = fixed(SEVEN);
  night(g, { 0: 6, 1: 6 });
  assert.throws(() => L.act1(g, 6, 0));
  L.vote(g, null);
  L.nextNight(g);
  assert.ok(!L.aliveSeats(g).includes(6));
});

test('random full games always finish', () => {
  const rng = seeded(9);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const wins = { good: 0, wolf: 0 };
  const sizes = new Set();
  for (let k = 0; k < 600; k++) {
    const n = L.MIN_PLAYERS + (k % (L.MAX_PLAYERS - L.MIN_PLAYERS + 1));
    sizes.add(n);
    const g = L.newGame(names(n), rng);
    let guard = 0;
    while (!g.winner && guard++ < 60) {
      for (const s of L.aliveSeats(g)) L.act1(g, s, pick(L.targets1(g, s)));
      for (const s of L.aliveSeats(g)) {
        if (L.task2(g, s) !== 'witch') {
          L.act2(g, s, {});
          continue;
        }
        const v = L.witchView(g, s);
        const r = rng();
        if (v.canSave && r < 0.3) L.act2(g, s, { save: true });
        else if (v.canPoison && r > 0.8) L.act2(g, s, { poison: pick(v.poisonTargets) });
        else L.act2(g, s, {});
      }
      L.resolveNight(g);
      if (g.pendingShot !== null) L.shoot(g, rng() < 0.5 ? null : pick(L.aliveSeats(g).filter((s) => s !== g.pendingShot)));
      if (g.winner) break;
      L.vote(g, rng() < 0.2 ? null : pick(L.aliveSeats(g)));
      if (g.pendingShot !== null) L.shoot(g, pick([null, ...L.aliveSeats(g)]));
      if (!g.winner) L.nextNight(g);
    }
    assert.ok(g.winner, `n=${n} did not finish`);
    wins[g.winner]++;
  }
  assert.ok(wins.good > 0 && wins.wolf > 0);
  assert.deepEqual([...sizes], Array.from({ length: 14 }, (_, i) => i + 3));
});

test('hunter attacked by wolves and also poisoned cannot shoot', () => {
  const g = fixed(SEVEN);
  night(g, { 0: 4, 1: 4 }, { poison: 4 });
  assert.equal(g.players[4].alive, false);
  assert.equal(g.players[4].cause, 'poison');
  assert.equal(g.pendingShot, null);
  assert.deepEqual(g.log[0].deaths, [4]);
});

test('guarded and healed on the same night survives', () => {
  const roles = ['wolf', 'wolf', 'wolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager', 'villager'];
  const g = fixed(roles);
  const r = night(g, { 0: 8, 1: 8, 2: 8, 6: 8 }, { save: true });
  assert.deepEqual(r.deaths, []);
});
