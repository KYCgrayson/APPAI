import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { character } from '../src/scene/models.ts';

for (const kind of ['farmer', 'rabbit', 'fox', 'wolf', 'goat', 'cabbage'] as const) {
    test(`${kind}: blink stays at eye height and moving parts pivot at roots`, () => {
        const actor = character(kind);
        const eyes = actor.userData.eyes;
        actor.updateMatrixWorld(true);
        const before = new Box3().setFromObject(eyes).getCenter(new Vector3());
        eyes.scale.y = .12;
        actor.updateMatrixWorld(true);
        const after = new Box3().setFromObject(eyes).getCenter(new Vector3());
        assert.ok(Math.abs(after.y - before.y) < .01);
        assert.equal(eyes.position.y, kind === 'cabbage' ? .38 : .73);
        assert.equal(actor.userData.moving.position.y, .82);
        assert.equal(actor.userData.tail.position.z, -.15);
    });
}
