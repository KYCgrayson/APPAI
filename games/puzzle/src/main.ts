import { compareToChallenge, accentTextColor, rank, migrateRun, encodeChallenge, formatTime, cleanName, escapeHtml, type Run, type Challenge } from './share/index.ts';
import { drawCard } from './share/card.ts';
import { shareStrings as st, strings as t, collectionStrings as c, locale } from './ui/i18n.ts';
import { registry } from './puzzles/registry.ts';
import { levelIds, starsFor, type GameId, type LevelId, type PuzzleAction } from './puzzles/types.ts';
import { levels as riverLevels } from './puzzles/river/logic.ts';
import { people, ids as bridgeIds } from './puzzles/bridge/logic.ts';
import { resolveRoute } from './routing.ts';
import { home } from './ui/home.ts';
import { Stage, type Metrics } from './scene/stage.ts';
import { Audio } from './ui/audio.ts';
import './ui/style.css';
type Action = PuzzleAction | {
    type: 'home' | 'menu' | 'undo' | 'restart' | 'share';
} | {
    type: 'open';
    game: GameId;
} | {
    type: 'start';
    game?: GameId;
    level: LevelId;
};
declare global {
    interface Window {
        __puzzleShare: {
            lastCardDataUrl?: string;
            lastUrl?: string;
        };
        __puzzleMetrics: Metrics;
        __puzzleTest: {
            state: () => Record<string, any>;
            act: (a: Action) => void;
        };
    }
}
const params = new URLSearchParams(location.search), dark = params.get('theme') === 'dark', route = resolveRoute(params, registry);
const framed = (() => { try {
    return window.self !== window.top;
}
catch {
    return true;
} })();
const app = document.querySelector<HTMLDivElement>('#app')!, audio = new Audio();
let game: GameId = route.game ?? 'river', def = registry[game], state: any = def.logic.initial(route.level), screen = route.screen;
let history: any[] = [], rulesOpen = false, hints = 0, showHints = false, toast = '', toastTimer = 0, loading = false, loadVersion = 0, stuckShown = false;
let mountedGame: GameId | undefined, mountedLevel: LevelId | undefined, pendingRoute = false;
let started = 0, stopped: number | null = null, currentRun: Run | null = null, currentPlace: number | null = null;
let runs: Run[] = [], nickname = '', previewUrl = '', sharing = false, challenge: Challenge | null = route.challenge;
const earned: Record<GameId, Partial<Record<LevelId, number>>> = { river: {}, bridge: {}, water: {} };
try {
    nickname = cleanName(localStorage.getItem('puzzle-name') ?? localStorage.getItem('river-name') ?? '');
    if (Array.from(nickname).length > 12)
        nickname = '';
    for (const d of Object.values(registry)) {
        const saved = JSON.parse(localStorage.getItem(`${d.storagePrefix}-stars`) || '{}');
        for (const id of levelIds)
            if (Number.isInteger(saved[id]) && saved[id] >= 1 && saved[id] <= 3)
                earned[d.id][id] = saved[id];
        const savedRuns: unknown = JSON.parse(localStorage.getItem(`${d.storagePrefix}-runs`) || '[]');
        if (Array.isArray(savedRuns))
            for (const value of savedRuns) {
                const r = migrateRun(value, d.id);
                if (r && r.game === d.id) {
                    const ranked = rank(runs, r);
                    runs = [...runs.filter(x => x.game !== r.game || x.level !== r.level), ...ranked.runs];
                }
            }
    }
    if (!route.game) {
        const last = localStorage.getItem('puzzle-last');
        if (last && Object.prototype.hasOwnProperty.call(registry, last)) {
            game = last as GameId;
            def = registry[game];
            state = def.logic.initial('easy');
        }
    }
}
catch { }
const elapsed = () => stopped ?? (started ? Math.max(0, performance.now() - started) : 0);
const unit = () => c[def.metric];
const filename = () => ({ river: 'river-crossing.png', bridge: 'night-bridge.png', water: 'water-pouring.png' }[game]);
const stage = new Stage(document.querySelector<HTMLCanvasElement>('#scene')!, dark, id => {
    if (game === 'river')
        act(id === 'boat' ? { type: 'cross' } : { type: 'toggle', id });
    else if (game === 'bridge')
        act(['bridge', 'lantern'].includes(id) ? { type: 'walk' } : { type: 'toggle', id });
    else if (id === 'pump' || id === 'flowers') {
        if (state.selected === null)
            message(def.strings.choose);
        else
            act({ type: id === 'pump' ? 'fill' : 'empty', jug: state.selected });
    }
    else if (id.startsWith('jug'))
        tapJug(Number(id.slice(3)));
});
window.__puzzleMetrics = stage.metrics;
window.__puzzleShare = {};
document.documentElement.lang = locale;
if (dark)
    document.body.classList.add('dark');
const accent = params.get('color');
if (accent && /^#?[0-9a-fA-F]{6}$/.test(accent))
    document.documentElement.style.setProperty('--accent', `#${accent.replace('#', '')}`);
document.documentElement.style.setProperty('--accent-ink', accentTextColor(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()));
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
const starCount = () => starsFor(def.logic.score(state), def.levels[state.level as LevelId]);
function mirror() {
    const url = new URL(location.href);
    for (const key of ['game', 'level', 'challenge', 'c', 't', 'n'])
        url.searchParams.delete(key);
    if (screen !== 'home')
        url.searchParams.set('game', game);
    if (screen === 'game')
        url.searchParams.set('level', state.level);
    if (challenge && screen !== 'home')
        new URLSearchParams(encodeChallenge(challenge)).forEach((v, k) => url.searchParams.set(k, v));
    window.history.replaceState(null, '', url);
}
async function mount() {
    const version = ++loadVersion;
    if (stage.current && mountedGame === game && mountedLevel === state.level) {
        loading = false;
        stage.current.sync(state);
        stage.resetView();
        render();
        return;
    }
    const definition = def, targetGame = game, targetLevel = state.level;
    loading = true;
    render();
    try {
        const module = await definition.loadScene();
        if (version !== loadVersion)
            return;
        const puzzle = module.create(stage, targetLevel);
        puzzle.sync(state);
        stage.mount(puzzle, targetGame === 'bridge' || targetGame === 'river' && dark);
        mountedGame = targetGame; mountedLevel = targetLevel;
    }
    catch (error) {
        console.error(error);
        message(locale === 'zh-TW' ? '場景載入失敗，請重新整理。' : 'Could not load the scene. Please reload.');
    }
    finally {
        if (version === loadVersion) {
            loading = false;
            render();
        }
    }
}
function message(s: string) { toast = s; clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { toast = ''; render(); }, 2800); render(); }
function tapJug(jug: number) { if (state.selected !== null && state.selected !== jug)
    act({ type: 'pour', from: state.selected, to: jug });
else
    act({ type: 'select', jug }); }
function begin(level: LevelId) {
    started = performance.now();
    stopped = null;
    currentRun = null;
    currentPlace = null;
    history = [];
    rulesOpen = false;
    hints = 0;
    stuckShown = false;
    toast = '';
    state = def.logic.initial(level);
    screen = 'game';
    showHints = level === 'easy';
    try {
        showHints = showHints && localStorage.getItem(`${def.storagePrefix}-hints`) !== 'seen';
        localStorage.setItem('puzzle-last', game);
    }
    catch { }
    mirror();
    void mount();
}
function finish() {
    if (def.logic.failure(state)) {
        stopped = performance.now() - started;
        audio.play('fail');
    }
    else if (def.logic.isWin(state)) {
        stopped = performance.now() - started;
        currentRun = { game, level: state.level, score: def.logic.score(state), ms: stopped, at: Date.now() };
        const ranked = rank(runs, currentRun);
        currentPlace = ranked.place;
        runs = [...runs.filter(r => r.game !== game || r.level !== state.level), ...ranked.runs];
        earned[game][state.level as LevelId] = Math.max(earned[game][state.level as LevelId] || 0, starCount());
        try {
            localStorage.setItem(`${def.storagePrefix}-runs`, JSON.stringify(runs.filter(r => r.game === game)));
            localStorage.setItem(`${def.storagePrefix}-stars`, JSON.stringify(earned[game]));
        }
        catch { }
        audio.play('win');
    }
    render();
    if (pendingRoute) { pendingRoute = false; restoreRoute(); }
}
function act(a: Action) {
    if (a.type === 'share') {
        void shareResult();
        return;
    }
    if (stage.current?.busy)
        return;
    if (a.type === 'home') {
        screen = 'home';
        rulesOpen = false;
        toast = '';
        challenge = null;
        mirror();
        render();
        stage.resetView();
        stage.startIdleOrbit();
        return;
    }
    if (a.type === 'open') {
        if (!Object.prototype.hasOwnProperty.call(registry, a.game))
            return;
        game = a.game;
        def = registry[game];
        state = def.logic.initial('easy');
        screen = 'levels';
        challenge = null;
        rulesOpen = false;
        toast = '';
        mirror();
        void mount();
        return;
    }
    if (a.type === 'start') {
        if (!levelIds.includes(a.level) || a.game && !Object.prototype.hasOwnProperty.call(registry, a.game))
            return;
        if (a.game && a.game !== game) {
            game = a.game;
            def = registry[game];
            challenge = null;
        }
        begin(a.level);
        return;
    }
    if (a.type === 'menu') {
        screen = 'levels';
        rulesOpen = false;
        toast = '';
        mirror();
        render();
        stage.resetView();
        return;
    }
    if (screen !== 'game' || rulesOpen || loading)
        return;
    if (a.type === 'restart') {
        begin(state.level);
        return;
    }
    if (a.type === 'undo') {
        if (def.logic.isWin(state))
            return;
        const prev = history.pop();
        if (prev) {
            state = prev;
            if (stopped !== null) started = performance.now() - stopped;
            stopped = null;
            stage.current?.sync(state);
            toast = '';
            render();
        }
        return;
    }
    const action = a as PuzzleAction, r = def.logic.apply(state, action);
    if (!r.ok) {
        const riverErrors: Record<string, string> = { capacity: 'capacityError', remote: 'remoteError', empty: 'emptyError', farmer: 'farmerError', boatRule: 'boatRuleError', rower: 'rowerError' };
        const text = game === 'river' ? def.strings[riverErrors[r.reason]] : def.strings[r.reason];
        if (text)
            message(text);
        return;
    }
    const previous = state, isMove = def.logic.isMove(action);
    if (game !== 'water' || action.type !== 'select')
        history.push(previous);
    if (game === 'bridge' && isMove) {
        audio.play('step');
        audio.play('creak');
        audio.play('lantern');
    }
    else if (r.sfx)
        audio.play(r.sfx);
    else if (game === 'river')
        audio.play(isMove ? 'sail' : r.state.aboard.length > previous.aboard.length ? 'select' : 'leave');
    toast = '';
    if (game === 'river' && showHints) {
        hints = isMove ? 3 : Math.min(hints + 1, 2);
    }
    if (isMove) {
        if (showHints && (game === 'river' || def.logic.score(r.state) >= 3)) {
            try {
                localStorage.setItem(`${def.storagePrefix}-hints`, 'seen');
            }
            catch { }
        }
        stage.current!.animate(previous, r.state, () => {
            state = r.state;
            if (game === 'river')
                audio.play('land');
            if (game === 'water' && !def.logic.isWin(state) && state.steps >= 2 * def.levels[state.level as LevelId].optimal && !stuckShown) {
                stuckShown = true;
                message(def.strings.stuck);
            }
            finish();
        });
    }
    else {
        state = r.state;
        stage.current?.sync(state);
    }
    render();
}
const resultLine = () => `${def.logic.score(state)} ${unit()} · ${formatTime(elapsed())}`;
function challengeResult() {
    if (!challenge || challenge.level !== state.level)
        return '';
    const result = compareToChallenge(def.logic.score(state), elapsed(), challenge);
    return `${st.challenge} ${challenge.name || st.friend}: ${challenge.score!} ${unit()} ${formatTime(challenge.ms)} → ${result === 'beat' ? st.beat : result === 'tie' ? st.tie : st.missed}`;
}
function closePreview() { if (previewUrl)
    URL.revokeObjectURL(previewUrl); previewUrl = ''; render(); }
async function shareResult() {
    if (!currentRun || screen !== 'game' || !def.logic.isWin(state) || sharing)
        return;
    sharing = true;
    try {
        const canvas = drawCard(stage.snapshot(), currentRun, runs.filter(r => r.game === game && r.level === state.level), currentPlace, starCount(), dark, stage.night, getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), nickname, challengeResult());
        const url = new URL(location.href);
        url.search = '';
        url.hash = '';
        for (const key of ['locale', 'theme', 'color'])
            if (params.has(key))
                url.searchParams.set(key, params.get(key)!);
        new URLSearchParams(encodeChallenge({ ...currentRun, name: nickname })).forEach((v, k) => url.searchParams.set(k, v));
        window.__puzzleShare = { lastUrl: url.href, ...(params.get('debug') === '1' ? { lastCardDataUrl: canvas.toDataURL('image/png') } : {}) };
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG')), 'image/png'));
        const file = new File([blob], filename(), { type: 'image/png' });
        try {
            if (navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], title: def.strings.title, text: `${resultLine()} ${url.href}` });
                return;
            }
        }
        catch (error) {
            if (error instanceof Error && error.name === 'AbortError')
                return;
        }
        if (previewUrl)
            URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(blob);
        render();
    }
    catch {
        message(st.error);
    }
    finally {
        sharing = false;
    }
}
const button = (action: string, label: string, primary = false, disabled = false) => `<button data-action="${action}" class="${primary ? 'primary' : ''}${action === 'music' || action === 'sound' ? ' sound' : ''}" ${disabled ? 'disabled' : ''}>${label}</button>`;
function modal(title: string, body: string, buttons: string, sheet = false) { return `<div class="scrim ${sheet ? 'sheet-scrim' : ''}"><section class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><div class="eyebrow">${def.strings.title}</div><h2>${title}</h2>${body}<div class="actions">${buttons}</div></section></div>`; }
function render() {
    stage.menu = screen !== 'game';
    const l = def.levels[state.level as LevelId], s = def.strings, busy = loading || !!stage.current?.busy, frozen = !!def.logic.failure(state) || def.logic.isWin(state);
    let html = '';
    if (screen === 'home')
        html = home(earned, framed);
    else if (screen === 'levels') {
        const line = challenge ? (locale === 'zh-TW' ? `${challenge.name || st.friend} 用 ${challenge.score} ${unit()}、${formatTime(challenge.ms)} 過了「${s[challenge.level]}」，換你挑戰！` : `${challenge.name || st.friend} cleared "${s[challenge.level]}" in ${challenge.score} ${unit()}, ${formatTime(challenge.ms)}. Your turn!`) : '';
        html = `<main class="menu levels"><button class="all-puzzles" data-action="home">${c.allPuzzles}</button><div class="eyebrow">${t.collection}</div><h1>${s.title}</h1><p class="intro">${s.pitch}</p>${challenge ? `<div class="challenge-banner"><p>${escapeHtml(line)}</p><button class="primary" data-level="${challenge.level}">${st.start}</button></div>` : ''}<div class="cards">${levelIds.map((id, i) => `<button class="card" data-level="${id}" ${loading ? 'disabled' : ''}><span class="number">0${i + 1}${game === 'river' ? ` / ${riverLevels[id].capacity} ${t.capacity}` : ''}</span><strong>${s[id]}</strong><p>${s[`${id}Desc`]}</p><span class="stars">${stars(earned[game][id] || 0)}</span><small>${t.optimal} ${def.levels[id].optimal} ${unit()}</small></button>`).join('')}</div><p class="preview">${s.easyRules || s.rules}</p></main>`;
    }
    else {
        let hud = `${def.logic.score(state)} ${unit()} · <span data-timer>${formatTime(elapsed())}</span> · ${t.optimal} ${l.optimal}`;
        if (game === 'river')
            hud += ` · ${state.aboard.length}/${riverLevels[state.level as LevelId].capacity} ${t.capacity}`;
        if (game === 'bridge')
            hud = `<span data-minutes>${state.minutes}</span> ${unit()} · <span data-remaining>${s.remaining.replace('{n}', String(Math.max(0, l.limit! - state.minutes)))}</span> · ${t.optimal} ${l.optimal}<span class="lantern-gauge ${l.limit! - state.minutes < l.limit! * .25 ? 'low' : ''}"><i data-gauge style="width:${Math.max(0, 1 - state.minutes / l.limit!) * 100}%"></i></span>`;
        if (game === 'water')
            hud += `<span class="goal">${s[`${state.level}Goal`]}</span>`;
        html = `<header class="topbar"><div class="level-heading"><button class="home" data-action="menu" ${busy ? 'disabled' : ''}><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9"/></svg><span>${t.home}</span></button><div class="identity"><h2>${s[state.level]}</h2><span>${hud}</span>${challenge && challenge.level === state.level ? `<div class="target-chip">${st.target} ${challenge.score} ${unit()} / ${formatTime(challenge.ms)}</div>` : ''}</div></div><nav class="toolbar">${button('undo', t.undo, false, !history.length || busy || def.logic.isWin(state))}${button('restart', t.restart, false, busy)}${button('rules', t.rules, false, busy)}</nav></header><div class="bottom">`;
        const hint = showHints && (game !== 'river' || hints < 3) ? def.logic.hint(state, state.level) : null;
        if (hint)
            html += `<div class="hint">${s[hint]}</div>`;
        html += '<div class="traveler-list">';
        if (game === 'river')
            html += riverLevels[state.level as LevelId].pieces.map(p => `<button data-piece="${p.id}" class="${state.aboard.includes(p.id) ? 'selected' : ''}" aria-pressed="${state.aboard.includes(p.id)}" ${busy || frozen || state.positions[p.id] !== state.boat ? 'disabled' : ''}>${s[p.kind]}${p.id.match(/\d+/) ? ' ' + p.id.match(/\d+/)![0] : ''}${state.aboard.includes(p.id) ? ' ↗' : ''}</button>`).join('');
        else if (game === 'bridge')
            html += bridgeIds(state.level).map(id => `<button data-piece="${id}" class="${state.selected.includes(id) ? 'selected' : ''}" aria-pressed="${state.selected.includes(id)}" ${busy || frozen || state.side[id] !== state.lantern ? 'disabled' : ''}>${s[people[Number(id)]]} · ${id} ${c.minutes}</button>`).join('');
        else
            html += state.caps.map((cap: number, jug: number) => `<button data-jug="${jug}" class="jug-chip ${state.selected === jug ? 'selected' : ''}" aria-pressed="${state.selected === jug}" ${busy || frozen ? 'disabled' : ''}>${cap} ${s.jug} · ${state.jugs[jug]} ${s.liters}<span class="mini-fill"><i style="width:${state.jugs[jug] / cap * 100}%"></i></span></button>`).join('');
        html += '</div>';
        if (game === 'water') {
            if (state.taps)
                html += `<div class="water-actions">${button('fill', s.fill, true, busy || frozen || state.selected === null)}${button('empty', s.empty, false, busy || frozen || state.selected === null)}</div>`;
        }
        else
            html += `<button class="primary cross" data-action="go" ${busy || frozen ? 'disabled' : ''}>${game === 'river' ? t.cross : s.walk} <span aria-hidden="true">→</span></button>`;
        html += `<p class="help">${s.help}</p></div>`;
        if (def.logic.failure(state))
            html += modal(game === 'river' ? t.failed : s.timeout.replace('{limit}', String(l.limit)).replace('{m}', String(state.minutes)), game === 'river' ? `<p>${s[state.failure.reason]}</p>` : '', button('undo', t.undo, true) + button('restart', t.restart) + button('menu', t.menu), true);
        else if (def.logic.isWin(state)) {
            const next = levelIds[levelIds.indexOf(state.level) + 1];
            html += modal(s.win, `<div class="stars">${stars(starCount())}</div><p>${resultLine()} · ${t.optimal} ${l.optimal}</p><p>${escapeHtml(challengeResult())}</p><label class="nickname">${st.nickname}<input id="nickname" maxlength="12" value="${escapeHtml(nickname)}" autocomplete="nickname"></label>`, button('share', st.share, true) + (next ? `<button data-level="${next}">${t.next}</button>` : '') + button('restart', t.replay) + button('menu', t.menu), true);
        }
        else if (rulesOpen)
            html += modal(t.rules, `<p>${s[`${state.level}Rules`] || s.rules}</p><p>${s.help}</p>`, button('close', t.close, true));
    }
    html += `<div class="view-tools">${button('music', `${t.music} ${audio.music ? t.on : t.off}`)}${button('sound', `${t.sound} ${audio.muted ? t.off : t.on}`)}<button data-action="reset-view" aria-label="${t.resetView}" title="${t.resetView}">⟲</button></div>`;
    if (loading)
        html += `<div class="loading" role="status">${c.loading}</div>`;
    if (toast)
        html += `<div class="toast" role="status">${toast}</div>`;
    if (previewUrl)
        html += modal(st.preview, `<img class="share-image" src="${escapeHtml(previewUrl)}" alt="${escapeHtml(resultLine())}"><p id="copy-hint" role="status">${st.hint}</p><input id="challenge-link" readonly aria-label="${st.copy}" value="${escapeHtml(window.__puzzleShare.lastUrl || '')}">`, `<a class="download" href="${escapeHtml(previewUrl)}" download="${filename()}">${st.download}</a>` + button('copy-link', st.copy) + button('close-preview', st.close));
    const active = document.activeElement instanceof HTMLElement ? { action: document.activeElement.dataset.action, piece: document.activeElement.dataset.piece, jug: document.activeElement.dataset.jug } : {};
    app.innerHTML = html;
    app.querySelector('[data-action="music"]')?.setAttribute('aria-pressed', String(audio.music));
    app.querySelector('[data-action="sound"]')?.setAttribute('aria-pressed', String(!audio.muted));
    app.querySelector<HTMLInputElement>('#nickname')?.addEventListener('input', e => { nickname = Array.from(cleanName((e.target as HTMLInputElement).value)).slice(0, 12).join(''); try {
        localStorage.setItem('puzzle-name', nickname);
    }
    catch { } });
    stage.resize();
    app.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.addEventListener('click', () => {
        audio.unlock();
        if (b.dataset.game) {
            act({ type: 'open', game: b.dataset.game as GameId });
            return;
        }
        if (b.dataset.level) {
            act({ type: 'start', level: b.dataset.level as LevelId });
            return;
        }
        if (b.dataset.piece) {
            act({ type: 'toggle', id: b.dataset.piece });
            return;
        }
        if (b.dataset.jug !== undefined) {
            tapJug(Number(b.dataset.jug));
            return;
        }
        const a = b.dataset.action;
        if (a === 'music') {
            audio.toggleMusic();
            render();
        }
        else if (a === 'sound') {
            audio.toggleSound();
            render();
        }
        else if (a === 'reset-view')
            stage.resetView(true);
        else if (a === 'close-preview')
            closePreview();
        else if (a === 'copy-link') {
            void (async () => { try {
                await navigator.clipboard.writeText(window.__puzzleShare.lastUrl || '');
                const hint = app.querySelector('#copy-hint');
                if (hint)
                    hint.textContent = st.copied;
            }
            catch {
                const input = app.querySelector<HTMLInputElement>('#challenge-link');
                input?.focus();
                input?.select();
                const hint = app.querySelector('#copy-hint');
                if (hint)
                    hint.textContent = st.manual;
            } })();
        }
        else if (a === 'rules' || a === 'close') {
            rulesOpen = a === 'rules';
            render();
        }
        else if (a === 'fill' || a === 'empty')
            act({ type: a, jug: state.selected });
        else
            act({ type: a } as Action);
    }));
    app.querySelectorAll<HTMLButtonElement>('[data-game]').forEach(card => { const preload = () => { void registry[card.dataset.game as GameId].loadScene().catch(() => { }); }; card.addEventListener('pointerenter', preload); card.addEventListener('focus', preload); });
    app.querySelectorAll<HTMLButtonElement>('[data-level]').forEach(card => { const preview = () => { const p = app.querySelector('.preview'); if (p)
        p.textContent = s[`${card.dataset.level}Rules`] || s.rules; }; card.addEventListener('pointerenter', preview); card.addEventListener('focus', preview); });
    const dialogs = app.querySelectorAll<HTMLElement>('.modal'), focus = dialogs[dialogs.length - 1]?.querySelector<HTMLElement>('.actions button, .actions a');
    if (focus)
        focus.focus();
    else
        for (const [key, value] of Object.entries(active))
            if (value) {
                app.querySelector<HTMLElement>(`[data-${key}="${value}"]`)?.focus({ preventScroll: true });
                break;
            }
}
for (const event of ['pointerdown', 'pointerup', 'touchend', 'click'])
    document.addEventListener(event, () => audio.unlock(), { passive: true });
document.addEventListener('keydown', e => {
    audio.unlock();
    if (e.repeat)
        return;
    const target = e.target as HTMLElement;
    if (e.code === 'Escape') {
        e.preventDefault();
        if (previewUrl) {
            closePreview();
            return;
        }
        if (rulesOpen) {
            rulesOpen = false;
            render();
            return;
        }
        if (screen === 'levels')
            act({ type: 'home' });
        return;
    }
    if (e.code === 'Tab' && app.querySelector('.modal')) {
        const dialogs = app.querySelectorAll<HTMLElement>('.modal'), buttons = [...dialogs[dialogs.length - 1]!.querySelectorAll<HTMLElement>('button,input,a')].filter(el => !el.hasAttribute('disabled'));
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
    }
    if (target.matches('input,textarea') || previewUrl || e.code === 'Space' && target.tagName === 'BUTTON')
        return;
    if (['Space', 'KeyZ', 'KeyR'].includes(e.code)) {
        e.preventDefault();
        act({ type: e.code === 'Space' ? 'go' : e.code === 'KeyZ' ? 'undo' : 'restart' });
    }
    else if (game !== 'river' && /^Digit[1-6]$/.test(e.code)) {
        e.preventDefault();
        const n = Number(e.code.slice(-1)) - 1;
        if (game === 'bridge') {
            const id = bridgeIds(state.level)[n];
            if (id)
                act({ type: 'toggle', id });
        }
        else if (n < state.caps.length)
            tapJug(n);
    }
    else if (game === 'water' && ['KeyF', 'KeyE'].includes(e.code)) {
        e.preventDefault();
        if (state.selected !== null)
            act({ type: e.code === 'KeyF' ? 'fill' : 'empty', jug: state.selected });
        else
            message(def.strings.choose);
    }
});
window.__puzzleTest = { state: () => ({ game, level: state.level, screen, animating: loading || !!stage.current?.busy, elapsedMs: elapsed(), challenge: structuredClone(challenge), ...structuredClone(state) }), act };
if (params.get('debug') === '1') {
    const el = document.createElement('div');
    el.id = 'debug';
    document.body.append(el);
    setInterval(() => { const m = stage.metrics; el.textContent = `${m.fps} FPS · ${(1000 / (m.fps || 1)).toFixed(1)} ms · ${m.drawCalls} calls · ${m.triangles} tris · first ${m.firstFrameMs.toFixed(0)} ms`; }, 1000);
}
setInterval(() => { const node = app.querySelector('[data-timer]'); if (node)
    node.textContent = formatTime(elapsed()); }, 1000);
if (screen === 'game')
    begin(route.level);
else {
    mirror();
    void mount();
}
function restoreRoute() {
    if (stage.current?.busy) { pendingRoute = true; return; }
    const next = resolveRoute(new URLSearchParams(location.search), registry);
    challenge = next.challenge; game = next.game ?? game; def = registry[game];
    state = def.logic.initial(next.level); screen = next.screen;
    history = []; rulesOpen = false; toast = ''; stopped = null; started = 0;
    if (screen === 'game') begin(next.level);
    else void mount();
}
window.addEventListener('popstate', restoreRoute);
