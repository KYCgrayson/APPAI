import test from 'node:test';
import assert from 'node:assert/strict';
import { fitBoard } from '../src/scene/fit.ts';

// Pure arithmetic: no DOM, renderer, Three.js camera or animation frames.
for (const [w, h] of [[375, 812], [390, 844], [768, 1024], [800, 600], [1440, 900]]) {
    test(`fitBoard: every corner fits the free band at ${w}×${h}`, () => {
        const top = w <= 650 ? 220 : w <= 1100 ? 170 : 115, bottom = h - 235;
        for (const bounds of [{ x: 5, y: [-.72, 2.65] as const, z: 4 }, { x: 5.23, y: [-1.63, 2.9] as const, z: 3.2 }, { x: 4.2, y: [-1, 2.5] as const, z: 2.95 }]) {
            const fit = fitBoard(bounds, w / (bottom - top));
            const sin = Math.sin(43 * Math.PI / 180), cos = Math.cos(43 * Math.PI / 180), tan = Math.tan(19 * Math.PI / 180);
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            let upMin = Infinity, upMax = -Infinity;
            for (const x of [-bounds.x, bounds.x]) for (const y of bounds.y) for (const z of [-bounds.z, bounds.z]) {
                const depth = (y - fit.target.y) * sin + (z - fit.target.z) * cos;
                const up = (y - fit.target.y) * cos - (z - fit.target.z) * sin;
                upMin = Math.min(upMin, up); upMax = Math.max(upMax, up);
                const px = w / 2 + x / ((fit.distance - depth) * tan) * (bottom - top) / 2;
                const py = (top + bottom) / 2 - up / ((fit.distance - depth) * tan) * (bottom - top) / 2;
                assert.ok(px >= w * .05 - 1e-8 && px <= w * .95 + 1e-8);
                assert.ok(py >= top && py <= bottom);
                minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py);
            }
            assert.ok(Math.abs(upMin + upMax) < 1e-12, 'camera-up bounds are centred on the target');
            assert.ok(Math.max((maxX - minX) / w, (maxY - minY) / (bottom - top)) >= .7, 'board fills the available band');
        }
    });
}
