import * as L from './logic.js';
import * as C from './controller.js';
import { LANGUAGES, detectLocale, translate } from './i18n.js';

const root = document.getElementById('app');
const announcer = document.getElementById('announcer');
let storageOk = true, raw = null;
try { raw = localStorage.getItem(C.STORAGE_KEY); } catch { storageOk = false; }
let state = C.restore(raw) || C.initialState();
let locale = detectLocale(new URLSearchParams(location.search).get('lang'), navigator.languages || [navigator.language]);
let confirmFresh = false, aiTimer = null, revealAfter = 0, focusCell = 0;
const t = (key, values) => translate(locale, key, values);
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const player = n => state.mode === 'ai' && n === 1 ? t('computerName') : t('player', { n: n + 1 });
const button = (action, text, extra = '') => `<button type="button" data-action="${action}" ${extra}>${esc(text)}</button>`;
const option = (value, text, chosen) => `<option value="${value}" ${chosen === value ? 'selected' : ''}>${esc(text)}</option>`;
const shotResult = shot => t(shot.result, { n: shot.size });
const shotReport = feedback => t('shotReport', { player: player(feedback.player), coord: L.coordinate(feedback.shot.cell, state.game.size), result: shotResult(feedback.shot) });
function save() {
  try { localStorage.setItem(C.STORAGE_KEY, C.serialize(state, locale)); }
  catch { storageOk = false; }
}
function settingsBar() {
  return `<div class="preferences">
    <label>${esc(t('language'))}<select data-setting="language">${Object.entries(LANGUAGES).map(([code, name]) => option(code, name, locale)).join('')}</select></label>
    <label>${esc(t('theme'))}<select data-setting="theme">${['auto', 'light', 'dark'].map(v => option(v, t(v), state.settings.theme)).join('')}</select></label>
  </div>`;
}
function home() {
  const s = state.settings;
  return `<a class="back-link" href="/games">${esc(t('games'))}</a>
    <div class="hero"><div class="fleet-art" aria-hidden="true"><i></i><i></i><i></i></div><p class="eyebrow">A–${String.fromCharCode(64 + s.size)} / 1–${s.size}</p>
    <h1>${esc(t('title'))}</h1><p class="muted">${esc(t('tagline'))}</p></div>
    <div class="home-columns"><section class="card setup"><h2>${esc(t('settings'))}</h2>
    <label>${esc(t('mode'))}<select data-setting="mode">${option('ai', t('computer'), s.mode)}${option('human', t('twoPlayers'), s.mode)}</select></label>
    ${s.mode === 'ai' ? `<label>${esc(t('difficulty'))}<select data-setting="level">${['easy', 'normal', 'hard'].map(v => option(v, t(v), s.level)).join('')}</select></label>` : ''}
    <label>${esc(t('boardSize'))}<select data-setting="size">${option('10', t('classic'), String(s.size))}${option('8', t('kids'), String(s.size))}</select></label>
    <label class="check"><input type="checkbox" data-setting="touch" ${s.touch ? 'checked' : ''}><span>${esc(t('touch'))}</span></label>
    <label class="check"><input type="checkbox" data-setting="again" ${s.again ? 'checked' : ''}><span>${esc(t('again'))}</span></label>
    ${state.game ? button('resume', t('resume'), 'class="primary"') : ''}
    ${button('new', t(state.game ? 'newGame' : 'start'), `class="${state.game ? '' : 'primary'}"`)}
    </section><section class="card rules"><h2>${esc(t('how'))}</h2><p>${esc(t('rules'))}</p><p class="muted">${esc(t('fleets'))}</p><p class="small muted">${esc(t('keyboard'))}</p></section></div>`;
}
function sea({ kind, seat, placing = false }) {
  const g = state.game, size = g.size, own = kind === 'own';
  // The target grid is built exclusively from this player's shot history.
  const ships = own ? g.fleets[seat].filter(Boolean) : [];
  const shots = g.shots[own ? 1 - seat : seat];
  const sunk = new Set(shots.flatMap(s => s.sunkCells));
  const preview = placing && state.aim !== null ? L.shipCells(size, L.fleetSizes(size)[state.selected], state.aim, state.vertical) || [] : [];
  const issue = placing && state.aim !== null ? C.placementIssue(state) : null;
  const interactive = placing || (!own && !state.feedback && !(state.mode === 'ai' && g.turn === 1));
  const label = t(own ? 'yourFleet' : 'target');
  let markup = `<div class="sea" role="grid" aria-label="${esc(label)}" aria-readonly="${!interactive}" data-sea="${kind}" style="--size:${size}"><div class="sea-row" role="row"><span role="columnheader"></span>`;
  for (let c = 0; c < size; c++) markup += `<span class="axis" role="columnheader">${String.fromCharCode(65 + c)}</span>`;
  markup += '</div>';
  for (let r = 0; r < size; r++) {
    markup += `<div class="sea-row" role="row"><span class="axis" role="rowheader">${r + 1}</span>`;
    for (let c = 0; c < size; c++) {
      const cell = r * size + c, shot = shots.find(s => s.cell === cell);
      const hasShip = ships.some(s => s.includes(cell)), isSunk = sunk.has(cell);
      const aimed = state.aim === cell && (placing || !own);
      const isPreview = preview.includes(cell);
      const status = isSunk ? 'sunkCell' : shot ? shot.result : hasShip ? 'shipCell' : own ? 'water' : 'unknown';
      const symbol = isSunk ? '#' : shot ? shot.result === 'miss' ? '·' : '×' : hasShip ? '■' : '';
      const classes = ['cell', isSunk ? 'sunk' : shot?.result === 'miss' ? 'miss' : shot ? 'hit' : hasShip ? 'ship' : '', aimed ? 'aimed' : '', isPreview ? issue ? 'invalid preview' : 'preview' : ''].join(' ');
      const name = `${L.coordinate(cell, size)}: ${t(status)}${aimed || isPreview ? `, ${t('selected')}` : ''}`;
      const attrs = `class="${classes}" role="gridcell" data-cell="${cell}" tabindex="${focusCell === cell ? 0 : -1}" aria-label="${esc(name)}" ${interactive && !shot ? '' : 'aria-disabled="true"'}`;
      markup += interactive ? `<button type="button" ${attrs}>${symbol}${aimed ? '<b aria-hidden="true">+</b>' : ''}</button>` : `<span ${attrs}>${symbol}</span>`;
    }
    markup += '</div>';
  }
  return markup + '</div>';
}
function placement() {
  const g = state.game, fleet = g.fleets[state.placing], lengths = L.fleetSizes(g.size);
  const issue = state.aim === null ? null : C.placementIssue(state);
  return `<div class="section-head"><p class="eyebrow">${esc(player(state.placing))}</p><h1>${esc(t('placeTitle'))}</h1><p>${esc(t('placeHelp'))}</p></div>
    <div class="placement-layout"><section class="board-panel card">${sea({ kind: 'own', seat: state.placing, placing: true })}
    <p class="small muted legend">${esc(t('legend'))}</p></section><section class="card placement-controls">
    <div class="ship-list">${lengths.map((length, i) => button('ship', `${t('ship', { n: length })} ${fleet[i] ? '■' : '□'}`, `data-index="${i}" aria-label="${esc(`${t('ship', { n: length })} ${fleet[i] ? t('placed') : ''}`)}" aria-pressed="${state.selected === i}"`)).join('')}</div>
    <p class="small muted">${esc(t('placementCount', { n: fleet.filter(Boolean).length, total: lengths.length }))}</p>
    ${button('rotate', `${t('rotate')} · ${t(state.vertical ? 'vertical' : 'horizontal')}`)}
    <p class="aim-label">${esc(state.aim === null ? t('chooseCell') : t('aim', { coord: L.coordinate(state.aim, g.size) }))}</p>
    ${issue || state.error ? `<p class="error" role="status">${esc(t(issue || state.error))}</p>` : ''}
    ${button('place', t('confirmPlace'), `class="primary" ${state.aim === null || issue ? 'disabled' : ''}`)}
    <div class="button-row">${button('random', t('random'))}${button('clear', t('clear'))}</div>
    ${button('ready', t('ready'), `class="primary" ${L.validFleet(g.size, fleet, g.touch) ? '' : 'disabled'}`)}</section></div>`;
}
function afloat(seat) {
  return L.fleetSizes(state.game.size).length - state.game.shots[1 - seat].filter(s => s.result === 'sunk').length;
}
function battle() {
  const g = state.game, seat = C.viewer(state), thinking = state.mode === 'ai' && g.turn === 1 && !state.feedback;
  const active = !state.feedback && !thinking;
  return `<div class="section-head"><h1>${esc(t('turn', { player: player(state.feedback?.player ?? g.turn) }))}</h1></div>
    ${state.feedback ? `<section class="report card"><p>${esc(shotReport(state.feedback))}</p>${g.again && state.feedback.shot.result !== 'miss' ? `<p class="small">${esc(t('bonus'))}</p>` : ''}${button('next', t('continue'), 'class="primary"')}</section>` : ''}
    ${thinking ? `<p class="report card">${esc(t('thinking'))}</p>` : ''}
    <div class="board-tabs" role="group" aria-label="${esc(`${t('target')} / ${t('yourFleet')}`)}">${button('target', t('target'), `aria-pressed="${state.tab === 'target'}"`)}${button('own', t('yourFleet'), `aria-pressed="${state.tab === 'own'}"`)}</div>
    <div class="battle-layout" data-tab="${state.tab}"><section class="card board-panel target-panel"><div class="board-title"><h2>${esc(t('target'))}</h2><p class="small muted">${esc(t('remaining', { n: afloat(1 - seat) }))}</p></div>${sea({ kind: 'target', seat })}
    <div class="fire-controls"><p class="aim-label">${esc(state.aim === null ? t('chooseCell') : t('aim', { coord: L.coordinate(state.aim, g.size) }))}</p>
    ${button('fire', t('confirmFire', { coord: state.aim === null ? '—' : L.coordinate(state.aim, g.size) }), `class="primary" ${!active || state.aim === null ? 'disabled' : ''}`)}</div></section>
    <section class="card board-panel own-panel"><div class="board-title"><h2>${esc(t('yourFleet'))}</h2><p class="small muted">${esc(t('remaining', { n: afloat(seat) }))}</p></div>${sea({ kind: 'own', seat })}</section></div>
    <p class="small muted legend">${esc(t('legend'))}</p>`;
}
function handoff() {
  return `<section class="handoff card"><div class="privacy-art" aria-hidden="true"><i></i></div><h1>${esc(t('pass', { player: player(C.viewer(state)) }))}</h1><p>${esc(t('privacy'))}</p>${button('reveal', t('reveal'), 'class="primary"')}</section>`;
}
function result() {
  return `<section class="result card"><div class="fleet-art" aria-hidden="true"><i></i><i></i><i></i></div>
    <h1>${esc(t('winner', { player: player(state.game.winner) }))}</h1><p>${esc(t('result'))}</p>
    ${[0, 1].map(p => `<p>${esc(t('shotsCount', { player: player(p), n: state.game.shots[p].length }))}</p>`).join('')}
    ${button('new', t('playAgain'), 'class="primary"')}${button('home', t('home'))}</section>`;
}
function announcement() {
  if (confirmFresh) return t('confirmNew');
  if (state.screen === 'handoff') return t('pass', { player: player(C.viewer(state)) });
  if (state.screen === 'result') return t('winner', { player: player(state.game.winner) });
  if (state.screen === 'battle') return state.feedback ? shotReport(state.feedback) : t('turn', { player: player(state.game.turn) });
  if (state.screen === 'place') return state.error ? t(state.error) : `${player(state.placing)}. ${t('placeTitle')}. ${state.aim !== null ? t('aim', { coord: L.coordinate(state.aim, state.game.size) }) : t('placementCount', { n: state.game.fleets[state.placing].filter(Boolean).length, total: L.fleetSizes(state.game.size).length })}`;
  return t('title');
}
function render(focus = 'main') {
  document.documentElement.lang = locale;
  document.documentElement.dataset.theme = state.settings.theme;
  document.title = t('title');
  document.querySelector('meta[name="description"]').content = t('tagline');
  const content = confirmFresh ? `<section class="card confirmation"><h1>${esc(t('confirmNew'))}</h1>${button('cancel', t('cancel'), 'class="primary"')}${button('fresh', t('confirm'))}</section>`
    : ({ home, place: placement, battle, handoff, result }[state.screen])();
  root.innerHTML = `<header>${settingsBar()}${state.screen !== 'home' && state.screen !== 'result' ? `<nav aria-label="${esc(t('settings'))}">${button('home', t('home'))}${button('new', t('newGame'))}</nav>` : ''}</header>
    <main id="main" tabindex="-1">${content}</main><footer class="small muted">${esc(t(storageOk ? 'saved' : 'storageWarning'))}</footer>`;
  if (focus === 'main') document.getElementById('main').focus({ preventScroll: true });
  else if (focus?.cell !== undefined) root.querySelector(`[data-sea="${focus.sea}"] [data-cell="${focus.cell}"]`)?.focus({ preventScroll: true });
  else if (focus?.setting) root.querySelector(`[data-setting="${focus.setting}"]`)?.focus({ preventScroll: true });
  else if (focus?.action) root.querySelector(`[data-action="${focus.action}"]`)?.focus({ preventScroll: true });
  const message = announcement();
  if (announcer.textContent !== message) announcer.textContent = message;
  scheduleAi();
}
function act(action, focus) {
  const previous = state;
  state = C.transition(state, action);
  if (state === previous) return;
  if (state.screen === 'handoff' && previous.screen !== 'handoff') revealAfter = performance.now() + 550;
  save();
  render(focus);
}
function scheduleAi() {
  clearTimeout(aiTimer);
  if (!confirmFresh && state.screen === 'battle' && !state.feedback && state.mode === 'ai' && state.game.turn === 1) {
    aiTimer = setTimeout(() => act({ type: 'ai' }), 450);
  }
}
root.addEventListener('click', event => {
  const cell = event.target.closest('button[data-cell]');
  if (cell) {
    focusCell = Number(cell.dataset.cell);
    act({ type: 'aim', cell: focusCell }, { cell: focusCell, sea: cell.closest('[data-sea]').dataset.sea });
    return;
  }
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action = target.dataset.action;
  if (action === 'reveal' && performance.now() < revealAfter) return;
  if (action === 'new') {
    if (state.game && state.game.winner === null) { confirmFresh = true; render(); }
    else act({ type: 'new' });
  } else if (action === 'fresh') { confirmFresh = false; act({ type: 'new' }); }
  else if (action === 'cancel') { confirmFresh = false; render(); }
  else if (['own', 'target'].includes(action)) act({ type: 'tab', tab: action }, { action });
  else act({ type: action, index: Number(target.dataset.index) }, ['rotate', 'random', 'clear'].includes(action) ? { action } : undefined);
});
root.addEventListener('change', event => {
  const el = event.target, key = el.dataset.setting;
  if (!key) return;
  if (key === 'language') {
    locale = el.value;
    const url = new URL(location.href);
    url.searchParams.set('lang', locale);
    try { history.replaceState(null, '', url); } catch { /* Still switches without URL support. */ }
    save(); render({ setting: key });
  } else {
    act({ type: 'settings', value: { [key]: el.type === 'checkbox' ? el.checked : key === 'size' ? Number(el.value) : el.value } }, { setting: key });
  }
});
root.addEventListener('keydown', event => {
  const el = event.target.closest('[data-cell]');
  if (!el) return;
  const size = state.game.size, cell = Number(el.dataset.cell), row = Math.floor(cell / size), col = cell % size;
  const moves = { ArrowLeft: row * size + Math.max(0, col - 1), ArrowRight: row * size + Math.min(size - 1, col + 1),
    ArrowUp: Math.max(0, row - 1) * size + col, ArrowDown: Math.min(size - 1, row + 1) * size + col,
    Home: row * size, End: row * size + size - 1 };
  if (moves[event.key] === undefined) return;
  event.preventDefault();
  const sea = el.closest('[data-sea]');
  sea.querySelectorAll('[data-cell]').forEach(c => { c.tabIndex = -1; });
  focusCell = moves[event.key];
  const next = sea.querySelector(`[data-cell="${focusCell}"]`);
  next.tabIndex = 0;
  next.focus({ preventScroll: true });
});
// A shared device never restores directly into a private board.
if (state.screen === 'handoff') revealAfter = performance.now() + 550;
save();
render(null);
