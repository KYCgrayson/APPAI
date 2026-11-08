import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initial, toggle, cross, isWin, solve, solution, levels } from '../src/logic/index.ts';
import type { State, LevelId } from '../src/logic/index.ts';
function load(s: State, ids: string[]) { for (const id of [...s.aboard]) {
    const r = toggle(s, id);
    assert.ok(r.ok);
    s = r.state;
} for (const id of ids) {
    const r = toggle(s, id);
    assert.ok(r.ok);
    s = r.state;
} return s; }
for (const level of Object.keys(levels) as LevelId[]) {
    test(`${level}: BFS optimum and public-function solution`, () => { assert.equal(solve(level), levels[level].optimal); let s = initial(level); for (const ids of solution(level)) {
        s = load(s, ids);
        const r = cross(s);
        assert.ok(r.ok);
        s = r.state;
        assert.ok(!s.failure);
    } assert.ok(isWin(s)); assert.equal(s.crossings, levels[level].optimal); });
    test(`${level}: empty, capacity, unknown and immutable`, () => { const s = initial(level); assert.equal(cross(s).ok, false); assert.equal(toggle(s, 'missing').ok, false); let n = s; for (const p of levels[level].pieces.slice(0, levels[level].capacity)) {
        const r = toggle(n, p.id);
        assert.ok(r.ok);
        n = r.state;
    } assert.equal(toggle(n, levels[level].pieces[levels[level].capacity]!.id).ok, false); assert.deepEqual(s.aboard, []); });
}
test('farmer required; both unattended easy combinations fail', () => { assert.equal(cross(load(initial('easy'), ['goat'])).ok, false); for (const passenger of ['wolf', 'cabbage']) {
    const r = cross(load(initial('easy'), ['farmer', passenger]));
    assert.ok(r.ok);
    assert.ok(r.state.failure);
    assert.equal(toggle(r.state, 'farmer').ok, false);
} });
test('remote pieces rejected, docked passengers count on landing', () => { const r = cross(load(initial('easy'), ['farmer', 'goat'])); assert.ok(r.ok); assert.ok(!r.state.failure); assert.equal(toggle(r.state, 'wolf').ok, false); });
test('medium banks fail when foxes outnumber rabbits', () => { const r = cross(load(initial('medium'), ['rabbit1', 'rabbit2'])); assert.ok(r.ok); assert.equal(r.state.failure?.reason, 'predators'); });
test('hard checks boat at departure and banks at landing', () => { assert.deepEqual(cross(load(initial('hard'), ['rabbit1', 'fox1', 'fox2'])), { ok: false, reason: 'boatRule' }); const r = cross(load(initial('hard'), ['rabbit1', 'rabbit2'])); assert.ok(r.ok); assert.equal(r.state.failure?.reason, 'predators'); });

test('hard requires a captain without failure or mutation', () => {
    const s = load(initial('hard'), ['fox2', 'fox3']);
    const before = structuredClone(s);
    assert.deepEqual(cross(s), { ok: false, reason: 'rower' });
    assert.deepEqual(s, before);
    assert.equal(s.failure, undefined);
});
test('hard with all rowers needs only 11 crossings', () => {
    const captains = levels.hard.captains;
    try {
        delete levels.hard.captains;
        assert.equal(solve('hard'), 11);
    } finally { levels.hard.captains = captains; }
});
