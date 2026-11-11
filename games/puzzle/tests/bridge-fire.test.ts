import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, InstancedMesh, Matrix4, PerspectiveCamera, PointLight, ShaderMaterial, Vector3 } from 'three';
import type { Stage } from '../src/scene/stage.ts';
import { fitBoard } from '../src/scene/fit.ts';
import { create } from '../src/puzzles/bridge/scene.ts';
import { initial } from '../src/puzzles/bridge/logic.ts';

const context = { beginPath() {}, roundRect() {}, fill() {}, stroke() {}, fillText() {} };
globalThis.document = { createElement: () => ({ getContext: () => context }), querySelector: () => null } as unknown as Document;
globalThis.matchMedia = (() => ({ matches: true })) as typeof matchMedia;

// Rasterize the real cone triangles through the default phone camera, rather than
// estimating visibility from a world box (the old foreshortened wall passed that).
// This is a geometric silhouette, not a GPU colour/FPS measurement. Count only the
// unobstructed gameplay band, excluding the heading and the entire bottom panel.
function projectedFire(fire: InstancedMesh, camera: PerspectiveCamera, w: number, h: number, top: number, bottom: number) {
    const mask = new Uint8Array(w * h), transform = new Matrix4(), instance = new Matrix4();
    const positions = fire.geometry.getAttribute('position'), index = fire.geometry.index!;
    const a = new Vector3(), b = new Vector3(), c = new Vector3();
    const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    const project = (v: Vector3, i: number) => {
        v.fromBufferAttribute(positions, i).applyMatrix4(transform).project(camera);
        v.set((v.x + 1) * w / 2, (1 - v.y) * h / 2, v.z);
        bounds.left = Math.min(bounds.left, v.x); bounds.right = Math.max(bounds.right, v.x);
        bounds.top = Math.min(bounds.top, v.y); bounds.bottom = Math.max(bounds.bottom, v.y);
    };
    const edge = (p: Vector3, q: Vector3, x: number, y: number) => (q.x - p.x) * (y - p.y) - (q.y - p.y) * (x - p.x);
    for (let i = 0; i < fire.count; i++) {
        fire.getMatrixAt(i, instance); transform.multiplyMatrices(fire.matrixWorld, instance);
        for (let t = 0; t < index.count; t += 3) {
            project(a, index.getX(t)); project(b, index.getX(t + 1)); project(c, index.getX(t + 2));
            const area = edge(a, b, c.x, c.y);
            if (Math.abs(area) < 1e-8) continue;
            const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), x1 = Math.min(w - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
            const y0 = Math.max(top, Math.floor(Math.min(a.y, b.y, c.y))), y1 = Math.min(bottom - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
            for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
                if (edge(a, b, x + .5, y + .5) / area >= 0 && edge(b, c, x + .5, y + .5) / area >= 0 && edge(c, a, x + .5, y + .5) / area >= 0) mask[y * w + x] = 1;
            }
        }
    }
    return { ...bounds, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top, coverage: mask.reduce((sum, p) => sum + p, 0) / (w * h) };
}

test('375×812: forest fire is tall from the start, grows across the screen, and clears bottom controls', t => {
    const scene = create({ lamps: [new PointLight(), new PointLight()] } as Stage, 'easy');
    const fire = scene.root.getObjectByName('start-bank-fire') as InstancedMesh;
    const smoke = scene.root.getObjectByName('start-bank-smoke') as InstancedMesh;
    const fit = fitBoard(scene.bounds, 375 / (584 - 217));
    const camera = new PerspectiveCamera(38, 375 / (584 - 217), .1, 360);
    camera.setViewOffset(375, 584 - 217, 0, -217, 375, 812);
    camera.position.set(fit.position.x, fit.position.y, fit.position.z);
    camera.lookAt(fit.target.x, fit.target.y, fit.target.z); camera.updateMatrixWorld();
    let previousHeight = 0, previousCoverage = 0, previousSmoke = 0;
    try {
        for (const [progress, minHeight, minCoverage] of [[0, 3, .005], [.6, 8, .02], [.9, 10, .04]]) {
            scene.sync({ ...initial('easy'), minutes: 22 * progress }); scene.update(0, 0, '');
            scene.root.updateMatrixWorld(true); fire.computeBoundingBox();
            const world = new Box3().setFromObject(fire), size = world.getSize(new Vector3());
            const screen = projectedFire(fire, camera, 375, 812, 217, 584);
            assert.ok(size.y >= minHeight, `${progress}: ${size.y} world-unit height`);
            assert.ok(screen.height > previousHeight && screen.coverage > previousCoverage, 'actual projected geometry grows');
            assert.ok(screen.coverage >= minCoverage, `${progress}: ${(screen.coverage * 100).toFixed(2)}% projected flame coverage`);
            assert.ok(screen.bottom < 574, 'all flames leave at least 10px before the traveler chips/Walk panel');
            assert.ok(world.min.x < -5.23 && world.min.z < -3.2, 'forest burns on ground beyond both bank edges');
            const opacity = (smoke.material as ShaderMaterial).uniforms.opacity.value;
            assert.ok(opacity >= .48 && opacity > previousSmoke, 'dark smoke is visible immediately and thickens');
            smoke.computeBoundingBox();
            assert.ok(new Box3().setFromObject(smoke).max.y > world.max.y, 'plume rises above the flame tips into the sky');
            t.diagnostic(`${progress * 100}%: ${size.y.toFixed(2)} world units; ${screen.width.toFixed(0)}×${screen.height.toFixed(0)}px projected bounds; ${(screen.coverage * 100).toFixed(2)}% geometric canvas coverage`);
            previousHeight = screen.height; previousCoverage = screen.coverage; previousSmoke = opacity;
        }
    } finally { scene.dispose(); }
});
