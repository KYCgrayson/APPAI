import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levels, type LevelId } from '../src/logic/index.ts';
import { ACTOR_SCALE, HIT_WIDTH, bankSlot, boatSeats, propFootprints } from '../src/scene/layout.ts';

for (const level of Object.keys(levels) as LevelId[]) {
    test(`${level}: bank grid and seats keep enlarged hit boxes separate`, () => {
        const pieces = levels[level].pieces;
        const columns = level === 'easy' ? 2 : level === 'medium' ? 3 : 5;
        for (const bank of [0, 1]) {
            const slots = pieces.map((_, i) => bankSlot(level, i, bank));
            assert.equal(new Set(slots.map(p => p.x)).size, 2);
            assert.equal(new Set(slots.map(p => p.z)).size, columns);
            for (const [i, a] of slots.entries()) {
                assert.ok(Math.abs(a.x) + HIT_WIDTH * ACTOR_SCALE / 2 < 5);
                assert.ok(Math.abs(a.z) + HIT_WIDTH * ACTOR_SCALE / 2 < 3.9);
                for (const b of slots.slice(i + 1)) {
                    assert.ok(Math.abs(a.x - b.x) > HIT_WIDTH * ACTOR_SCALE * 1.04 || Math.abs(a.z - b.z) > HIT_WIDTH * ACTOR_SCALE * 1.04);
                }
            }
            if (level !== 'easy') {
                assert.ok(pieces.slice(0, columns).every(p => p.kind === 'rabbit'));
                assert.ok(pieces.slice(columns).every(p => p.kind === 'fox'));
            }
        }
        const seats = boatSeats(levels[level].capacity);
        assert.equal(seats.length, levels[level].capacity);
        for (let i = 1; i < seats.length; i++) assert.ok(seats[i] - seats[i - 1] > HIT_WIDTH * ACTOR_SCALE * 1.04);
        assert.ok(Math.max(...seats.map(Math.abs)) + HIT_WIDTH * ACTOR_SCALE / 2 < 2.4);
    });
}

for (const level of Object.keys(levels) as LevelId[]) {
    test(`${level}: large scenery clears every traveler slot on both banks`, () => {
        for (const bank of [0, 1]) for (const [i] of levels[level].pieces.entries()) {
            const slot = bankSlot(level, i, bank);
            const radius = HIT_WIDTH * ACTOR_SCALE * 1.04 / 2;
            for (const prop of propFootprints) {
                assert.ok(Math.abs(slot.x-prop.x) > radius+prop.rx || Math.abs(slot.z-prop.z) > radius+prop.rz,
                    `slot ${slot.x},${slot.z} overlaps prop ${prop.x},${prop.z}`);
            }
        }
    });
}
