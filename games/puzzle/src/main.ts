import { initial, toggle, cross, isWin, levels, type State, type LevelId } from './logic/index.ts';
import { Diorama, type Metrics } from './scene/index.ts';
import { strings as t, locale } from './ui/i18n.ts';
import { Audio } from './ui/audio.ts';
import './ui/style.css';
type Action = {
    type: 'start';
    level: LevelId;
} | {
    type: 'toggle';
    id: string;
} | {
    type: 'cross' | 'undo' | 'restart' | 'menu';
};
declare global {
    interface Window {
        __puzzleMetrics: Metrics;
        __puzzleTest: {
            state: () => State & {
                screen: string;
                animating: boolean;
            };
            act: (a: Action) => void;
        };
    }
}
const params = new URLSearchParams(location.search), dark = params.get('theme') === 'dark';
document.documentElement.lang = locale;
if (dark)
    document.body.classList.add('dark');
const accent = params.get('color');
if (accent && /^#?[0-9a-fA-F]{6}$/.test(accent))
    document.documentElement.style.setProperty('--accent', `#${accent.replace('#', '')}`);
const app = document.querySelector<HTMLDivElement>('#app')!, audio = new Audio();
let state = initial('easy'), history: State[] = [], screen = 'menu', rulesOpen = false, hints = 0, showHints = false, toast = '', toastTimer = 0;
let earned: Partial<Record<LevelId, number>> = {};
try {
    const saved = JSON.parse(localStorage.getItem('river-stars') || '{}');
    for (const id of Object.keys(levels) as LevelId[])
        if (Number.isInteger(saved[id]) && saved[id] >= 1 && saved[id] <= 3)
            earned[id] = saved[id];
}
catch { /* Storage may be unavailable in embedded/private contexts. */ }
const scene = new Diorama(document.querySelector<HTMLCanvasElement>('#scene')!, dark, id => act(id === 'boat' ? { type: 'cross' } : { type: 'toggle', id }));
scene.sync(state);
window.__puzzleMetrics = scene.metrics;
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
function message(s: string) { toast = s; clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { toast = ''; render(); }, 2800); render(); }
function save() { const n = state.crossings <= levels[state.level].optimal ? 3 : state.crossings <= Math.ceil(levels[state.level].optimal * 1.3) ? 2 : 1; earned[state.level] = Math.max(earned[state.level] || 0, n); try {
    localStorage.setItem('river-stars', JSON.stringify(earned));
}
catch { } return n; }
function act(a: Action) {
    if (scene.sailing)
        return;
    if (a.type === 'start') {
        if (!(a.level in levels))
            return;
        state = initial(a.level);
        history = [];
        screen = 'game';
        rulesOpen = false;
        hints = 0;
        showHints = false;
        if (a.level === 'easy') {
            try {
                showHints = localStorage.getItem('river-hints') !== 'seen';
            }
            catch {
                showHints = true;
            }
        }
        scene.sync(state);
        render();
        return;
    }
    if (a.type === 'menu') {
        screen = 'menu';
        rulesOpen = false;
        toast = '';
        render();
        return;
    }
    if (screen !== 'game')
        return;
    if (a.type === 'undo') {
        if (isWin(state)) return;
        const prev = history.pop();
        if (prev) {
            state = prev;
            scene.sync(state);
            toast = '';
            render();
        }
        return;
    }
    if (a.type === 'restart') {
        act({ type: 'start', level: state.level });
        return;
    }
    if (rulesOpen || state.failure || isWin(state))
        return;
    if (a.type === 'toggle') {
        const r = toggle(state, a.id);
        if (r.ok) {
            history.push(state);
            state = r.state;
            audio.play('select');
            if (showHints) hints = Math.min(hints + 1, 2);
            scene.sync(state);
            render();
        }
        else if (r.reason === 'capacity' || r.reason === 'remote')
            message(t[r.reason === 'capacity' ? 'capacityError' : 'remoteError']);
    }
    if (a.type === 'cross') {
        const r = cross(state);
        if (!r.ok) {
            const key = { empty: 'emptyError', farmer: 'farmerError', boatRule: 'boatRuleError', rower: 'rowerError' }[r.reason as 'empty' | 'farmer' | 'boatRule' | 'rower'];
            if (key)
                message(t[key as keyof typeof t]);
            return;
        }
        const previous = state;
        history.push({ ...previous, positions: { ...previous.positions }, aboard: [...previous.aboard] });
        audio.play('sail');
        toast = '';
        if (showHints) {
            hints = 3;
            try {
                localStorage.setItem('river-hints', 'seen');
            }
            catch { }
        }
        scene.sail(r.state, () => { state = r.state; if (state.failure)
            audio.play('fail');
        else if (isWin(state)) {
            save();
            audio.play('win');
        } render(); });
        render();
    }
}
function modal(title: string, body: string, buttons: string, sheet = false) { return `<div class="scrim ${sheet ? 'sheet-scrim' : ''}"><section class="modal" role="dialog" aria-modal="true" aria-label="${title}"><div class="eyebrow">RIVER CROSSING</div><h2>${title}</h2>${body}<div class="actions">${buttons}</div></section></div>`; }
const button = (action: string, label: string, primary = false, disabled = false) => `<button data-action="${action}" class="${primary ? 'primary' : ''}" ${disabled ? 'disabled' : ''}>${label}</button>`;
function easyHint() {
    if (!state.aboard.includes('farmer')) return state.aboard.length ? t.farmerError : t.hint0;
    if (state.crossings === 0 && !state.aboard.includes('goat')) return state.aboard.length === levels.easy.capacity ? t.firstGoat : t.hint1;
    return t.hint2;
}
function render() {
    scene.menu = screen === 'menu';
    const level = levels[state.level];
    let html = '';
    if (screen === 'menu') {
        html = `<main class="menu"><div class="eyebrow">${t.collection}</div><h1>${t.title}</h1><p class="intro">${t.pitch}</p><div class="cards" aria-label="${t.start}">${(Object.keys(levels) as LevelId[]).map((id, i) => `<button class="card" data-level="${id}"><span class="number">0${i + 1} / ${levels[id].capacity} ${t.capacity}</span><strong>${t[id]}</strong><p>${t[`${id}Desc`]}</p><span class="stars" aria-label="${earned[id] || 0} ${t.completed}">${stars(earned[id] || 0)}</span><small>${t.optimal} ${levels[id].optimal} ${t.crossings}</small></button>`).join('')}</div><p class="preview">${t.easyRules}</p></main>`;
    }
    else {
        html = `<header class="topbar"><div class="identity"><h2>${t[state.level]}</h2><span>${state.crossings} ${t.crossings} · ${t.optimal} ${level.optimal} · ${state.aboard.length}/${level.capacity} ${t.capacity}</span></div><nav class="toolbar">${button('undo', t.undo, false, !history.length || scene.sailing || isWin(state))}${button('restart', t.restart, false, scene.sailing)}${button('rules', t.rules, false, scene.sailing)}${button('menu', t.menu, false, scene.sailing)}</nav></header><div class="bottom">${showHints && hints < 3 ? `<div class="hint">${easyHint()}</div>` : ''}<div class="traveler-list">${level.pieces.map(p => `<button data-piece="${p.id}" class="${state.aboard.includes(p.id) ? 'selected' : ''}" aria-pressed="${state.aboard.includes(p.id)}" ${scene.sailing || state.failure || isWin(state) || state.positions[p.id] !== state.boat ? 'disabled' : ''}>${t[p.kind]}${p.id.match(/\d+/) ? ' ' + p.id.match(/\d+/)![0] : ''}${state.aboard.includes(p.id) ? ' ↗' : ''}</button>`).join('')}</div><button class="primary cross" data-action="cross" ${scene.sailing || state.failure || isWin(state) ? 'disabled' : ''}>${t.cross} <span aria-hidden="true">→</span></button><p class="help">${t.help}</p></div>`;
        if (state.failure)
            html += modal(t.failed, `<p>${t[state.failure.reason]}</p>`, button('undo', t.undo, true) + button('restart', t.restart) + button('menu', t.menu), true);
        else if (isWin(state)) {
            const ids = Object.keys(levels) as LevelId[], next = ids[ids.indexOf(state.level) + 1];
            html += modal(t.win, `<div class="stars">${stars(state.crossings <= level.optimal ? 3 : state.crossings <= Math.ceil(level.optimal * 1.3) ? 2 : 1)}</div><p>${t.solved} ${state.crossings} · ${t.optimal} ${level.optimal}</p>`, (next ? `<button class="primary" data-level="${next}">${t.next}</button>` : '') + button('restart', t.replay) + button('menu', t.menu), true);
        }
        else if (rulesOpen)
            html += modal(t.rules, `<p>${t[`${state.level}Rules`]}</p><p>${t.help}</p>`, button('close', t.close, true));
    }
    html += `<button class="sound" data-action="sound" aria-pressed="${!audio.muted}">${t.sound} ${audio.muted ? t.off : t.on}</button>`;
    if (toast)
        html += `<div class="toast" role="status">${toast}</div>`;
    app.innerHTML = html;
    scene.resize();
    app.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.addEventListener('click', () => { audio.unlock(); if (b.dataset.level) {
        act({ type: 'start', level: b.dataset.level as LevelId });
        return;
    } if (b.dataset.piece) {
        act({ type: 'toggle', id: b.dataset.piece });
        return;
    } const a = b.dataset.action; if (a === 'sound') {
        audio.muted = !audio.muted;
        render();
    }
    else if (a === 'rules' || a === 'close') {
        rulesOpen = a === 'rules';
        render();
    }
    else
        act({ type: a } as Action); }));
    app.querySelectorAll<HTMLButtonElement>('[data-level]').forEach(card => { const preview = () => { const p = app.querySelector('.preview'); if (p)
        p.textContent = t[`${card.dataset.level as LevelId}Rules`]; }; card.addEventListener('pointerenter', preview); card.addEventListener('focus', preview); });
    const focus = app.querySelector<HTMLButtonElement>('.modal button');
    focus?.focus();
}
document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
document.addEventListener('keydown', e => { if (e.repeat)
    return; const target = e.target as HTMLElement; if (e.code === 'Tab' && app.querySelector('.modal')) {
    const buttons = [...app.querySelectorAll<HTMLButtonElement>('.modal button')];
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (e.shiftKey && document.activeElement === first) {
        last?.focus();
        e.preventDefault();
    }
    else if (!e.shiftKey && document.activeElement === last) {
        first?.focus();
        e.preventDefault();
    }
    return;
} if (e.code === 'Space' && target.tagName === 'BUTTON')
    return; if (['Space', 'KeyZ', 'KeyR'].includes(e.code)) {
    e.preventDefault();
    audio.unlock();
    act({ type: e.code === 'Space' ? 'cross' : e.code === 'KeyZ' ? 'undo' : 'restart' });
} });
window.__puzzleTest = { state: () => ({ ...structuredClone(state), screen, animating: scene.sailing }), act };
if (params.get('debug') === '1') {
    const el = document.createElement('div');
    el.id = 'debug';
    document.body.append(el);
    setInterval(() => { const m = scene.metrics; el.textContent = `${m.fps} FPS · ${(1000 / (m.fps || 1)).toFixed(1)} ms · ${m.drawCalls} calls · ${m.triangles} tris · first ${m.firstFrameMs.toFixed(0)} ms`; }, 1000);
}
render();
