import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { registry } from '../src/puzzles/registry.ts';

// Drive main's actual actions/keyboard/DOM handlers with a GPU-free scene and minimal DOM.
class Element extends EventTarget {
    dataset: Record<string, string> = {}; tagName = 'BUTTON'; style = { setProperty() {} };
    constructor(attributes = '') { super(); for (const [, key, value] of attributes.matchAll(/data-([\w-]+)="([^"]*)"/g)) this.dataset[key] = value; }
    setAttribute() {} matches() { return false; } focus() {} click() { this.dispatchEvent(new Event('click')); }
}
class App extends Element {
    html = ''; buttons: Element[] = [];
    set innerHTML(s: string) { this.html = s; this.buttons = [...s.matchAll(/<button\b([^>]*)>/g)].map(m => new Element(m[1])); }
    querySelector(s: string) { const m = s.match(/^\[data-(\w+)="([^"]+)"\]$/); return m ? this.buttons.find(b => b.dataset[m[1]] === m[2]) ?? null : null; }
    querySelectorAll(s: string) { if (s === 'button') return this.buttons; const m = s.match(/^\[data-(\w+)\]$/); return m ? this.buttons.filter(b => m[1] in b.dataset) : []; }
}
class FakeScene {
    busy = false; state: any; done?: () => void; syncCount = 0;
    sync(s: any) { this.state = s; this.syncCount++; }
    animate(_from: any, to: any, done: () => void) { this.busy = true; this.done = () => { this.busy = false; this.sync(to); done(); }; }
    complete() { const done = this.done; this.done = undefined; done?.(); }
}
class FakeStage {
    static instance: FakeStage; current?: FakeScene; night = false; metrics = {}; mounts = 0;
    constructor() { FakeStage.instance = this; }
    mount(s: FakeScene, night: boolean) { this.current = s; this.night = night; this.mounts++; }
    resize() {} resetView() {} startIdleOrbit() {}
}
class FakeAudio { music = false; muted = false; unlock() {} play() {} toggleMusic() {} toggleSound() {} }
(globalThis as any).controllerMocks = { FakeStage, FakeAudio };
const mainURL = new URL('../src/main.ts', import.meta.url).href;
registerHooks({
    resolve(specifier, context, next) {
        if (context.parentURL === mainURL) {
            if (specifier.endsWith('/stage.ts')) return { url: 'test:controller-stage', shortCircuit: true };
            if (specifier.endsWith('/audio.ts')) return { url: 'test:controller-audio', shortCircuit: true };
            if (specifier.endsWith('.css')) return { url: 'test:controller-css', shortCircuit: true };
        }
        return next(specifier, context);
    },
    load(url, context, next) {
        if (url === 'test:controller-stage') return { format: 'module', shortCircuit: true, source: 'export const Stage=globalThis.controllerMocks.FakeStage;' };
        if (url === 'test:controller-audio') return { format: 'module', shortCircuit: true, source: 'export const Audio=globalThis.controllerMocks.FakeAudio;' };
        if (url === 'test:controller-css') return { format: 'module', shortCircuit: true, source: '' };
        return next(url, context);
    }
});
const app = new App(), doc = new EventTarget(), win = new EventTarget();
globalThis.HTMLElement = Element as any;
globalThis.location = new URL('https://puzzle.test/?locale=en') as any;
globalThis.document = Object.assign(doc, {
    activeElement: null, documentElement: new Element(), body: { classList: { add() {} } },
    querySelector: (s: string) => s === '#app' ? app : new Element()
}) as any;
globalThis.window = Object.assign(win, {
    self: win, top: win, history: { replaceState(_a: any, _b: any, url: URL) { globalThis.location = new URL(url) as any; } },
    setTimeout: () => 0
}) as any;
globalThis.localStorage = { getItem: () => null, setItem() {} } as any;
globalThis.getComputedStyle = (() => ({ getPropertyValue: () => '#426b58' })) as any;
// The controller's timer interval is irrelevant here; use an explicit test clock.
globalThis.setInterval = (() => 0) as any;
globalThis.clearTimeout = () => {};
const loads: { game: string; resolve: (module: any) => void }[] = [];
for (const def of Object.values(registry)) def.loadScene = () => new Promise(resolve => { loads.push({ game: def.id, resolve }); });
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
async function loadLatest() { const load = loads.pop()!; load.resolve({ create: () => new FakeScene() }); await settle(); }
function key(code: string) { const event = Object.assign(new Event('keydown'), { code, repeat: false }); Object.defineProperty(event, 'target', { value: new Element() }); doc.dispatchEvent(event); }
function button(action: string) { const b = app.querySelector(`[data-action="${action}"]`); assert.ok(b); return b; }

test('controller regressions: loading, keyboard, modal guards, restart, timeout, navigation and challenge reload', async t => {
    let now = 1000; t.mock.method(performance, 'now', () => now);
    await import('../src/main.ts');
    const act = window.__puzzleTest.act, state = window.__puzzleTest.state, stage = FakeStage.instance;
    await t.test('home cards work while chunks load and stale completions cannot replace the latest scene', async () => {
        act({ type: 'open', game: 'bridge' }); act({ type: 'open', game: 'water' });
        assert.equal(state().game, 'water'); assert.deepEqual(loads.map(l => l.game), ['river', 'bridge', 'water']);
        await loadLatest(); assert.equal(stage.mounts, 1);
        while (loads.length) await loadLatest();
        assert.equal(stage.mounts, 1); assert.equal(state().game, 'water'); assert.equal(state().animating, false);
    });
    await t.test('keyboard digits select then pour, just like jug chips', async () => {
        act({ type: 'start', level: 'medium' }); await loadLatest();
        key('Digit1'); key('Digit2'); assert.equal(state().animating, true);
        stage.current!.complete(); assert.deepEqual(state().jugs, [3, 5, 0]); assert.equal(state().steps, 1);
    });
    await t.test('rules block both button and keyboard undo/restart; restart reuses the scene', () => {
        const scene = stage.current, count = stage.mounts;
        button('rules').click();
        for (const a of ['undo', 'restart'] as const) { act({ type: a }); key(a === 'undo' ? 'KeyZ' : 'KeyR'); }
        assert.equal(state().steps, 1); assert.equal(stage.mounts, count);
        button('close').click(); act({ type: 'restart' });
        assert.equal(stage.current, scene); assert.equal(stage.mounts, count); assert.equal(state().steps, 0); assert.deepEqual(state().jugs, [8, 0, 0]);
    });
    await t.test('bridge failure stops elapsed time and undo resumes it', async () => {
        act({ type: 'start', game: 'bridge', level: 'easy' }); await loadLatest();
        const cross = () => { act({ type: 'toggle', id: '10' }); act({ type: 'walk' }); now += 1000; stage.current!.complete(); };
        cross(); cross(); cross();
        assert.equal(state().failure.reason, 'timeout'); const elapsed = state().elapsedMs;
        assert.ok(app.html.includes('<h2>The lantern only lasts 22 minutes; that trip ended at 30.</h2>'));
        assert.ok(app.html.includes('data-action="undo" class="primary"'), 'timeout keeps the Undo action');
        now += 9000; assert.equal(state().elapsedMs, elapsed);
        act({ type: 'undo' }); assert.equal(state().failure, undefined); assert.equal(state().elapsedMs, elapsed);
        now += 1000; assert.equal(state().elapsedMs, elapsed + 1000);
    });
    await t.test('popstate waits for animation completion rather than dropping its callback', async () => {
        act({ type: 'restart' }); act({ type: 'toggle', id: '1' }); act({ type: 'walk' });
        const moving = stage.current!; assert.equal(moving.busy, true);
        globalThis.location = new URL('https://puzzle.test/?game=water&level=easy') as any;
        win.dispatchEvent(new Event('popstate')); assert.equal(state().game, 'bridge'); assert.equal(stage.current, moving);
        moving.complete(); assert.equal(state().game, 'water'); assert.equal(moving.state.minutes, 1); await loadLatest();
        assert.equal(state().screen, 'game'); assert.equal(state().animating, false);
    });
    await t.test('accepting a challenge keeps its parameters in the active game URL', async () => {
        globalThis.location = new URL('https://puzzle.test/?game=bridge&challenge=easy&c=19&t=90&n=Amy&locale=en') as any;
        win.dispatchEvent(new Event('popstate')); await loadLatest();
        act({ type: 'start', level: 'easy' });
        const params = new URLSearchParams(location.search);
        assert.equal(params.get('level'), 'easy'); assert.equal(params.get('challenge'), 'easy'); assert.equal(params.get('c'), '19'); assert.equal(params.get('n'), 'Amy');
    });
});
