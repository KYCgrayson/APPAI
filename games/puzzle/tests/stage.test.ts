/* eslint-disable @typescript-eslint/no-explicit-any -- Minimal fixtures replace DOM, renderer and orbit controls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { EventDispatcher, Group, Mesh, PerspectiveCamera, PointLight, Vector2, Vector3 } from 'three';
import { fitBoard } from '../src/scene/fit.ts';

// Exercise the real Stage, replacing only GPU/DOM controls. rAF is queued but never runs.
class Renderer {
    domElement: any; shadowMap = {}; info = { render: { calls: 0, triangles: 0 } };
    renders: { camera: PerspectiveCamera; night: boolean; board: boolean }[] = [];
    size = new Vector2(); ratio = 1;
    constructor({ canvas }: any) { this.domElement = canvas; }
    setPixelRatio(n: number) { this.ratio = n; }
    setClearColor() {}
    setSize(w: number, h: number) { this.size.set(w, h); this.domElement.width = w * this.ratio; this.domElement.height = h * this.ratio; }
    getSize(out: Vector2) { return out.copy(this.size); }
    render(scene: any, camera: PerspectiveCamera) {
        this.renders.push({ camera: camera.clone(), night: scene.getObjectByName('sky').material.uniforms.night.value === 1, board: !!scene.getObjectByName('board') });
    }
}
class Controls extends EventDispatcher {
    camera: PerspectiveCamera; target = new Vector3(); position0 = new Vector3(); target0 = new Vector3(); updates = 0;
    constructor(camera: PerspectiveCamera) { super(); this.camera = camera; }
    update() { this.updates++; this.camera.lookAt(this.target); }
    saveState() { this.position0.copy(this.camera.position); this.target0.copy(this.target); }
    reset() { this.camera.position.copy(this.position0); this.target.copy(this.target0); }
}
(globalThis as any).stageMocks = { Renderer, Controls };
const stageURL = new URL('../src/scene/stage.ts', import.meta.url).href;
registerHooks({
    resolve(specifier, context, next) {
        if (context.parentURL === stageURL && specifier === 'three') return { url: 'test:stage-three', shortCircuit: true };
        if (context.parentURL === stageURL && specifier.includes('OrbitControls')) return { url: 'test:stage-controls', shortCircuit: true };
        return next(specifier, context);
    },
    load(url, context, next) {
        if (url === 'test:stage-three') return { format: 'module', shortCircuit: true, source: `export * from ${JSON.stringify(import.meta.resolve('three'))}; export const WebGLRenderer=globalThis.stageMocks.Renderer;` };
        if (url === 'test:stage-controls') return { format: 'module', shortCircuit: true, source: 'export const OrbitControls=globalThis.stageMocks.Controls;' };
        return next(url, context);
    }
});
const top = 220;
let bottom = 600;
const classes = new Set<string>(), frames: FrameRequestCallback[] = [];
const canvas = Object.assign(new EventTarget(), { style: {}, width: 0, height: 0 });
globalThis.window = new EventTarget() as unknown as Window & typeof globalThis;
globalThis.document = Object.assign(new EventTarget(), {
    hidden: false, body: { classList: { toggle(c: string, on: boolean) { if (on) classes.add(c); else classes.delete(c); } } },
    querySelector: (s: string) => s === '.topbar' ? { getBoundingClientRect: () => ({ bottom: top }) } : s === '.bottom' ? { getBoundingClientRect: () => ({ top: bottom }) } : null,
    createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }) })
}) as unknown as Document;
globalThis.innerWidth = 390; globalThis.innerHeight = 844; globalThis.devicePixelRatio = 2;
globalThis.matchMedia = (() => ({ matches: false })) as typeof matchMedia;
globalThis.requestAnimationFrame = cb => { frames.push(cb); return frames.length; };
globalThis.cancelAnimationFrame = () => {};
const { Stage } = await import('../src/scene/stage.ts');
const makePuzzle = () => {
    const root = new Group(); root.name = 'board';
    return { root, hit: [], bounds: { x: 5.23, y: [-1.63, 2.9] as [number, number], z: 3.2 }, busy: false, update() {}, sync() {}, animate() {}, dispose() { root.clear(); } };
};

test('no empty first render; mount renders the board and night exactly once without any rAF', () => {
    const stage = new Stage(canvas as any, false, () => {}), renderer = stage.renderer as unknown as Renderer;
    assert.equal(renderer.renders.length, 0);
    stage.resize(); assert.equal(renderer.renders.length, 0);
    assert.equal(frames.length, 1);
    stage.mount(makePuzzle(), true);
    assert.equal(renderer.renders.length, 1);
    assert.ok(renderer.renders.every(r => r.board && r.night));
    assert.ok(stage.metrics.firstFrameMs > 0); assert.ok(classes.has('night'));
    const count = renderer.renders.length;
    const controls = stage.controls as unknown as Controls, updates = controls.updates;
    stage.resize(); assert.equal(renderer.renders.length, count, 'queued rAF handles an unchanged band');
    assert.equal(controls.updates, updates, 'UI updates do not advance control damping');
    const lights = stage.scene.children.filter(o => o instanceof PointLight);
    stage.mount(makePuzzle(), false);
    assert.equal(renderer.renders.length, count + 1, 'a replacement scene renders once');
    assert.ok(!classes.has('night'));
    assert.deepEqual(stage.scene.children.filter(o => o instanceof PointLight), lights);
});

test('bridge fog strengthens early, relaxes on victory and resets for other puzzles', () => {
    const stage = new Stage(canvas as any, false, () => {}), puzzle = makePuzzle();
    puzzle.root.userData.fireProgress = 0;
    stage.mount(puzzle, true);
    const fog = stage.scene.fog as import('three').Fog;
    const distant = { color: fog.color.clone(), near: fog.near, far: fog.far };
    assert.ok(distant.near < 70 && distant.far < 260);
    puzzle.root.userData.fireProgress = .3; stage.resetView();
    assert.ok(fog.color.r > distant.color.r && fog.near < distant.near && fog.far < distant.far);
    puzzle.root.userData.fireProgress = 1; stage.resetView();
    const danger = { color: fog.color.clone(), near: fog.near, far: fog.far };
    puzzle.root.userData.fireRelaxed = true; stage.resetView();
    assert.ok(fog.color.r < danger.color.r && fog.near > danger.near && fog.far > danger.far);
    puzzle.root.userData.fireProgress = 0; puzzle.root.userData.fireRelaxed = false; stage.resetView();
    assert.deepEqual(fog.color, distant.color); assert.equal(fog.near, distant.near); assert.equal(fog.far, distant.far);
    stage.mount(makePuzzle(), true);
    const clean = stage.scene.fog as import('three').Fog;
    assert.equal(clean.near, 70); assert.equal(clean.far, 260); assert.equal(clean.color.getHexString(), '686781');
});

test('unchanged viewport renders synchronously when the frame loop is paused', () => {
    const stage = new Stage(canvas as any, false, () => {}), renderer = stage.renderer as unknown as Renderer;
    stage.mount(makePuzzle(), false);
    (document as any).hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    const count = renderer.renders.length;
    stage.resize(); assert.equal(renderer.renders.length, count + 1);
    (document as any).hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    const resumed = renderer.renders.length;
    stage.resize(); assert.equal(renderer.renders.length, resumed);
});

test('HUD reflow preserves a user orbit/zoom, updates defaults, and reset uses the new fit', () => {
    const stage = new Stage(canvas as any, false, () => {});
    stage.mount(makePuzzle(), true);
    stage.controls.dispatchEvent({ type: 'start' });
    stage.camera.position.set(8, 9, -12); stage.controls.target.set(.2, .7, -.4); stage.camera.zoom = 1.2;
    const position = stage.camera.position.clone(), target = stage.controls.target.clone();
    bottom += 70; stage.resize();
    assert.deepEqual(stage.camera.position, position); assert.deepEqual(stage.controls.target, target); assert.equal(stage.camera.zoom, 1.2);
    const fit = fitBoard(stage.current!.bounds, innerWidth / (bottom - top));
    stage.resetView();
    assert.ok(stage.camera.position.distanceTo(new Vector3(fit.position.x, fit.position.y, fit.position.z)) < 1e-9);
    assert.ok(stage.controls.target.distanceTo(new Vector3(fit.target.x, fit.target.y, fit.target.z)) < 1e-9);
    assert.equal(stage.camera.zoom, 1);
    bottom -= 70; stage.resize();
    assert.notDeepEqual(stage.camera.position, position, 'untouched default follows the band');
});

test('lowered atmosphere quality survives day/night switches', () => {
    const stage = new Stage(canvas as any, false, () => {}) as any;
    stage.mount(makePuzzle(), false);
    // This is the persisted state set by the measured-FPS fallback.
    stage.lowered = true; stage.atmosphere.lowerQuality();
    for (const night of [true, false, true]) {
        stage.mount(makePuzzle(), night);
        const sky = stage.scene.getObjectByName('sky') as Mesh;
        assert.equal((sky.material as any).uniforms.quality.value, 0);
    }
});

test('snapshot fits the default card camera and restores view, canvas and atmosphere', () => {
    const stage = new Stage(canvas as any, false, () => {}), renderer = stage.renderer as unknown as Renderer;
    stage.mount(makePuzzle(), true);
    stage.controls.dispatchEvent({ type: 'start' }); stage.camera.position.set(7, 3, -9); stage.controls.target.set(0, 1, 0);
    const position = stage.camera.position.clone(), target = stage.controls.target.clone(), size = renderer.size.clone();
    renderer.renders = [];
    const snapshot = stage.snapshot(), capture = renderer.renders[0].camera;
    assert.equal(snapshot.width / snapshot.height, 936 / 590);
    assert.equal(capture.view?.enabled, false); assert.equal(capture.aspect, 936 / 590); assert.equal(capture.zoom, 1);
    assert.equal(capture.position.x, 0); assert.ok(capture.position.z > 0);
    assert.deepEqual(stage.camera.position, position); assert.deepEqual(stage.controls.target, target); assert.deepEqual(renderer.size, size);
    assert.equal(stage.scene.getObjectByName('procedural-atmosphere')!.visible, true);
    for (const x of [-5.23, 5.23]) for (const y of [-1.63, 2.9]) for (const z of [-3.2, 3.2]) {
        const point = new Vector3(x, y, z).project(capture);
        assert.ok(Math.abs(point.x) <= .9 + 1e-9 && Math.abs(point.y) <= .94 + 1e-9);
    }
});
