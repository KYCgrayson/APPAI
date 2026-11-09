import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Group, Mesh, Vector3 } from 'three';
import { bake, character, part } from '../src/scene/models.ts';

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

test('rebaking keeps original vertex colours and disposes intermediate baked resources', () => {
    const group=new Group();part(group,'box','#946732',[0,0,0],[1,1,1]);part(group,'cone','#467054',[1,0,0],[1,1,1]);
    bake(group);
    const mesh=group.children[0] as Mesh, original=Array.from(mesh.geometry.getAttribute('color').array);
    let geometryDisposed=0,materialDisposed=0;
    mesh.geometry.addEventListener('dispose',()=>geometryDisposed++);
    (mesh.material as import('three').Material).addEventListener('dispose',()=>materialDisposed++);
    bake(group);
    assert.deepEqual(Array.from((group.children[0] as Mesh).geometry.getAttribute('color').array),original);
    assert.equal(geometryDisposed,1);assert.equal(materialDisposed,1);
});
