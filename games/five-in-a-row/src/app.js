import { newGame, applyMove, lastMove, undo } from './logic.js';
import { chooseMove } from './ai.js';
import { STRINGS, LOCALES, LANGUAGE_NAMES, detectLanguage, translate } from './i18n.js';
import { STORAGE_KEY, initialState, restore, startLocal, canPlace, previewAt, placePreview, undoLocal } from './controller.js';
import { RoomsClient, OnlineSession, normalizeCode, apiBase, signInUrl, validateRoom, canSkip } from './rooms.js';

const root = document.getElementById('app');
const announcer = document.getElementById('announcer');
const params = new URLSearchParams(location.search);
let storage, storageWorks = true;
try { storage = window.localStorage; } catch { storageWorks = false; }
let S;
try { S = restore(storage?.getItem(STORAGE_KEY)); } catch { S = initialState(); storageWorks = false; }
let lang = detectLanguage(params.get('lang'), navigator.languages ?? [navigator.language]);
let session = null, aiTimer, pending = false, reconnecting = false, notice = '', needsLogin = false;
let joinInput = params.get('room') ?? '', focusIndex = S.game ? Math.floor(S.game.size / 2) * (S.game.size + 1) : 0;
let networkEpoch = 0, announced = '', roomView = '';
const client = new RoomsClient({ base: apiBase(location), storage });
const t = (key, values) => translate(lang, key, values);
const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const player = (seat) => t(seat === 0 ? 'black' : 'white');
// Keep readable player names in accessible text; visible stones have fixed colors.
const stoneText = (text) => esc(text).replace(/[●○]/g, (symbol) => `<span class="player-stone ${symbol === '●' ? 'black' : 'white'}" aria-hidden="true"></span>`);
const button = (key, action, primary = false, disabled = false, type = 'button') => `<button type="${type}" data-action="${action}" ${disabled ? 'disabled' : ''} class="${primary ? 'primary' : ''}">${esc(t(key))}</button>`;
const options = (list, selected) => list.map(([value, label]) => `<option value="${value}" ${String(selected) === String(value) ? 'selected' : ''}>${esc(label)}</option>`).join('');
const select = (key, list, value, attr = '') => `<label>${esc(t(key))}<select id="${key}" ${attr}>${options(list, value)}</select></label>`;

function save() {
  try {
    if (!storage) throw Error();
    storage.setItem(STORAGE_KEY, JSON.stringify(S));
  } catch { storageWorks = false; }
}
function announce(text) {
  if (text !== announced) { announced = text; announcer.textContent = text; }
}
function settings() {
  return `<div class="settings">${select('language', LOCALES.map((code, i) => [code, LANGUAGE_NAMES[i]]), lang)}${select('theme', ['auto', 'light', 'dark'].map((key) => [key, t(key)]), S.settings.theme)}</div>`;
}
function message() {
  return notice ? `<div class="message" role="alert"><p>${esc(t(notice))}</p>${needsLogin ? `<a class="button" href="${esc(signInUrl(location.search))}" target="_top">${esc(t('signIn'))}</a>` : ''}</div>` : '';
}
function homeScreen() {
  const mode = S.settings.mode;
  return `<div class="home-page"><a class="back-link" href="/games">${esc(t('games'))}</a>${settings()}
    <header class="hero"><div class="motif" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><h1>${esc(t('title'))}</h1><p>${esc(t('tagline'))}</p></header>
    ${message()}<div class="home-layout"><section class="panel setup" aria-label="${esc(t('newGame'))}">
      ${S.game ? button('resume', 'resume', false, pending) : ''}
      ${select('mode', ['computer', 'local', 'room'].map((key) => [key, t(key)]), mode, 'data-setting="mode"')}
      ${select('size', [[9, t('small')], [13, t('medium')], [15, t('standard')]], S.settings.size, 'data-setting="size"')}
      ${mode === 'computer' ? `${select('difficulty', ['easy', 'normal', 'hard'].map((key) => [key, t(key)]), S.settings.difficulty, 'data-setting="difficulty"')}${select('side', [[0, t('first')], [1, t('second')]], S.settings.humanSeat, 'data-setting="humanSeat"')}` : ''}
      ${mode === 'room' ? `<p class="muted">${esc(t('roomIntro'))}</p>${button('create', 'create', true, pending)}<form id="join-room" class="join-room" novalidate><label for="room-code">${esc(t('roomCode'))}</label><input id="room-code" class="room-input" value="${esc(joinInput)}" maxlength="16" autocapitalize="characters" autocomplete="off" spellcheck="false" enterkeyhint="go">${button('join', 'join', false, pending, 'submit')}</form><p class="notice">${esc(t('joinNote'))}</p>` : button('newGame', 'new', true)}
    </section><section class="panel rules"><h2>${esc(t('how'))}</h2><p>${esc(t('rules'))}</p><p>${esc(t('previewHelp'))}</p><p>${esc(t('keyboardHelp'))}</p><p>${esc(t('localNote'))}</p></section></div>
    <p class="notice">${esc(t(storageWorks ? 'saved' : 'storageWarning'))}</p></div>`;
}
function thinking() { return S.screen === 'play' && S.active?.mode === 'computer' && S.game.turn !== S.active.humanSeat; }
function turnText() {
  if (S.game.winner !== null) return S.game.winner === 'draw' ? t('draw') : t('winner', { player: player(S.game.winner) });
  if (reconnecting) return t('loading');
  if (S.active.mode === 'room' && session?.room.status === 'waiting') return t('waiting');
  return thinking() ? t('thinking') : t('turn', { player: player(S.game.turn) });
}
function board() {
  const g = S.game, last = lastMove(g), enabled = canPlay();
  const winning = new Set(g.line);
  return `<div class="board-wrap ${S.zoom ? 'zoomed' : ''}" style="--size:${g.size}"><div class="board" role="grid" aria-label="${esc(t('boardLabel'))}" aria-rowcount="${g.size}" aria-colcount="${g.size}" aria-describedby="board-help board-legend">
    ${Array.from({ length: g.size }, (_, r) => `<div class="board-row" role="row">${Array.from({ length: g.size }, (_, c) => {
      const i = r * g.size + c, value = g.board[i], ghost = i === S.preview && value === '0';
      const cell = ghost ? `${player(g.turn)} · ${t('preview')}` : value === '0' ? t('empty') : player(Number(value) - 1);
      const label = t('coordinate', { row: r + 1, col: c + 1, cell }) + (i === last ? '; ' + t('lastMark') : '') + (winning.has(i) ? '; ' + t('winMark') : '');
      return `<button type="button" role="gridcell" data-index="${i}" tabindex="${i === focusIndex ? 0 : -1}" aria-rowindex="${r + 1}" aria-colindex="${c + 1}" aria-label="${esc(label)}" aria-selected="${ghost}" aria-disabled="${!enabled || value !== '0'}" class="point ${i === last ? 'last' : ''} ${winning.has(i) ? 'winning' : ''}">${value !== '0' || ghost ? `<span aria-hidden="true" class="stone ${(ghost ? g.turn : Number(value) - 1) === 0 ? 'black' : 'white'} ${ghost ? 'ghost' : ''}"></span>` : ''}</button>`;
    }).join('')}</div>`).join('')}
  </div></div><div class="legend" id="board-legend"><span>${esc(t('lastMark'))}</span><span>${esc(t('winMark'))}</span></div>`;
}
function canPlay() {
  return !pending && !reconnecting && canPlace(S, session?.seat) && (S.active?.mode !== 'room' || session?.room.status === 'playing');
}
function roomInfo() {
  if (S.active.mode !== 'room') return '';
  const room = session?.room;
  return `<section class="panel room-info"><h2>${esc(t('roomLabel', { code: S.roomCode }))}</h2><code>${esc(S.roomCode)}</code>
    ${session ? `<p>${stoneText(t('youAre', { player: player(session.seat) }))}</p><p class="muted">${esc(t(room.seats[1 - session.seat]?.online ? 'online' : 'offline'))}</p>` : ''}
    ${room?.status === 'waiting' ? `<p class="notice">${esc(t('expireNote'))}</p>${session.seat === 0 ? `<div class="actions">${button('startRoom', 'start-room', true, pending || !room.seats.every((s) => s.joined))}</div>` : ''}` : ''}
    ${room && canSkip(room, session.seat) ? `<p class="notice">${esc(t('skipHelp'))}</p><div class="actions">${button('skipIdle', 'skip', false, pending)}</div>` : ''}
  </section>`;
}
function gameScreen() {
  const g = S.game, ended = g.winner !== null;
  const mayUndo = S.active.mode !== 'room' && undo(g, S.active.mode, S.active.humanSeat) !== g;
  return `<div class="game-page"><header class="top"><h1>${esc(t('title'))}</h1>${ended ? '' : button('home', 'home')}</header>${settings()}${message()}
    <section class="turn-card"><div>${ended ? '' : `<h2>${stoneText(turnText())}</h2>`}<p>${esc(t('moveCount', { count: g.moves.filter((m) => m[0] >= 0).length }))}</p></div>
    ${!ended && S.active.mode !== 'local' && !reconnecting ? `<span class="badge">${stoneText(S.active.mode === 'computer' ? t('youAre', { player: player(S.active.humanSeat) }) : t(g.turn === session?.seat ? 'yourTurn' : 'opponentTurn'))}</span>` : ''}</section>
    ${ended ? `<section class="panel result" aria-labelledby="result-heading"><h2 id="result-heading">${stoneText(turnText())}</h2><div class="actions">${S.active.mode === 'room' ? '' : button('playAgain', 'again', true)}${button('home', 'home')}${mayUndo ? button('undo', 'undo') : ''}</div>${S.active.mode === 'room' ? `<p class="notice">${esc(t('roomEnd'))}</p>` : ''}</section>` : ''}
    ${board()}<div class="game-actions">${!ended ? `${button('place', 'place', true, S.preview === null || !canPlay())}${S.active.mode !== 'room' ? button('undo', 'undo', false, !mayUndo) : button('cancel', 'cancel', false, S.preview === null)}` : ''}${button(S.zoom ? 'zoomOut' : 'zoom', 'zoom')}</div>
    <p id="board-help" class="help">${esc(t('previewHelp'))}<br>${esc(t('keyboardHelp'))}</p>${roomInfo()}<p class="notice">${esc(t(storageWorks ? 'saved' : 'storageWarning'))}</p></div>`;
}
function render(announcement = '') {
  clearTimeout(aiTimer);
  save();
  document.documentElement.lang = lang;
  document.title = STRINGS[lang].title;
  if (S.settings.theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = S.settings.theme;
  const focused = document.activeElement;
  const focusId = focused?.id, cell = focused?.dataset?.index;
  const wrap = root.querySelector('.board-wrap'), scroll = wrap ? [wrap.scrollLeft, wrap.scrollTop] : null;
  root.innerHTML = S.screen === 'home' || !S.game ? homeScreen() : gameScreen();
  if (scroll) {
    const next = root.querySelector('.board-wrap');
    if (next) { next.scrollLeft = scroll[0]; next.scrollTop = scroll[1]; }
  }
  if (cell !== undefined) root.querySelector(`[data-index="${cell}"]`)?.focus({ preventScroll: true });
  else if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  announce(notice ? t(notice) : announcement || (S.screen !== 'home' && S.game ? turnText() : t('title')));
  if (thinking()) {
    const expected = S.game;
    aiTimer = setTimeout(() => {
      if (S.game !== expected || !thinking()) return;
      const index = chooseMove(S.game, S.active.difficulty);
      S.game = applyMove(S.game, S.game.turn, { index });
      S.screen = S.game.winner === null ? 'play' : 'end';
      const coordinate = `${String.fromCharCode(65 + index % S.game.size)}${Math.floor(index / S.game.size) + 1}`;
      render(`${t('computerPlayed', { coordinate })} ${turnText()}`);
    }, 80);
  }
}
function failure(error, creating = false) {
  if (creating && [401, 403, 503].includes(error.status)) { notice = 'loginRequired'; needsLogin = true; }
  else {
    notice = ({ room_not_found: 'roomMissing', room_full: 'roomFull', invalid_code: 'invalidCode', invalid_state: 'invalidState',
      version_conflict: 'changedTurn', not_your_turn: 'changedTurn', occupied: 'changedTurn', invalid_move: 'changedTurn',
      room_not_ready: 'notReady', rate_limited: 'rateLimit', busy: 'busy', room_finished: 'roomMissing' })[error.error ?? error.message] ?? 'unavailable';
    needsLogin = false;
  }
  if (error.error === 'room_not_found' || error.error === 'invalid_state') session?.stop();
  render();
}
function stopSession() { networkEpoch++; session?.stop(); session = null; roomView = ''; reconnecting = false; }
function roomQuery(code = null) {
  const url = new URL(location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  try { history.replaceState(null, '', url); } catch {}
}
function roomChanged(room) {
  const next = JSON.stringify([room.version, room.status, room.state.board, room.state.turn,
    room.seats.map((s) => [s.joined, s.online, s.idleSeconds >= 120])]);
  const changed = roomView !== next || Boolean(notice);
  roomView = next;
  const moved = JSON.stringify(S.game?.moves) !== JSON.stringify(room.state.moves);
  S.game = room.state;
  S.active = { ...S.settings, mode: 'room', size: room.state.size };
  S.screen = room.state.winner === null ? 'play' : 'end';
  if (moved) S.preview = null;
  notice = ''; needsLogin = false;
  if (changed) render();
}
function attach(code, credential, room) {
  session?.stop();
  S.roomCode = code;
  joinInput = code;
  roomQuery(code);
  S.active = { ...S.settings, mode: 'room', size: room.state.size };
  focusIndex = Math.floor(room.state.size / 2) * (room.state.size + 1);
  session = new OnlineSession(client, code, credential, room, roomChanged, (e) => failure(e));
  roomChanged(room);
  session.start();
}
async function connect(kind) {
  if (pending) return;
  stopSession();
  const epoch = networkEpoch;
  pending = true; notice = ''; needsLogin = false;
  render();
  try {
    let data, code;
    if (kind === 'create') {
      data = await client.create(newGame(S.settings.size));
      code = data.code;
    } else {
      code = normalizeCode(kind === 'resume' ? S.roomCode : joinInput);
      const credential = client.credential(code);
      if (credential) {
        const polled = await client.poll(code, credential.token, -1);
        data = { ...credential, room: validateRoom(polled.room) };
      } else if (kind === 'resume') throw { error: 'room_not_found' };
      else data = await client.join(code);
    }
    if (epoch !== networkEpoch) return;
    pending = false; reconnecting = false;
    attach(code, { seat: data.seat, token: data.token }, data.room);
  } catch (e) {
    if (epoch === networkEpoch) { pending = false; reconnecting = false; failure(e, kind === 'create'); }
  } finally {
    if (epoch === networkEpoch) { pending = false; reconnecting = false; render(); }
  }
}
async function confirmPlacement() {
  if (S.preview === null || !canPlay()) return;
  if (S.active.mode !== 'room') { S = placePreview(S); notice = ''; render(); return; }
  const current = session;
  pending = true; render();
  try { await current.send(S.preview); }
  catch (e) { if (session === current) failure(e); }
  finally { if (session === current) { pending = false; render(); } }
}
root.addEventListener('click', (event) => {
  const point = event.target.closest('[data-index]');
  if (point) {
    const index = Number(point.dataset.index);
    focusIndex = index;
    if (!canPlay() || S.game.board[index] !== '0') return;
    if (S.preview === index) void confirmPlacement();
    else { S = previewAt(S, index, session?.seat); render(); announce(t('coordinate', { row: Math.floor(index / S.game.size) + 1, col: index % S.game.size + 1, cell: t('preview') })); }
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'home') {
    stopSession(); roomQuery(); pending = false; notice = ''; S.screen = 'home'; S.preview = null; render();
  } else if (action === 'new' || action === 'again') {
    stopSession(); roomQuery();
    if (action === 'again') S.settings = { ...S.active, theme: S.settings.theme };
    S = startLocal(S); focusIndex = Math.floor(S.game.size / 2) * (S.game.size + 1); notice = ''; render();
  } else if (action === 'resume') {
    if (S.active?.mode === 'room') { reconnecting = true; void connect('resume'); }
    else { S.screen = S.game.winner === null ? 'play' : 'end'; notice = ''; render(); }
  } else if (action === 'place') void confirmPlacement();
  else if (action === 'cancel') { S.preview = null; render(); }
  else if (action === 'undo' && S.active.mode !== 'room') { S = undoLocal(S); notice = ''; render(); }
  else if (action === 'zoom') { S.zoom = !S.zoom; render(); }
  else if (action === 'create') void connect(action);
  else if (action === 'skip' || action === 'start-room') {
    if (!session || pending) return;
    const current = session;
    pending = true; render();
    const task = action === 'skip' ? current.send(null, true) : client.start(current.code, current.token).then((data) => current.update(data.room));
    task.catch((e) => { if (session === current) failure(e); }).finally(() => { if (session === current) { pending = false; render(); } });
  }
});
root.addEventListener('input', (event) => { if (event.target.id === 'room-code') joinInput = event.target.value; });
root.addEventListener('submit', (event) => {
  if (event.target.id !== 'join-room') return;
  event.preventDefault();
  joinInput = event.target.elements['room-code'].value;
  void connect('join');
});
root.addEventListener('change', (event) => {
  const element = event.target;
  // A text field commits its change on blur, before the pending button click.
  // Only settings selects may replace the DOM in response to change.
  if (element.tagName !== 'SELECT') return;
  if (element.id === 'language') {
    lang = element.value;
    const url = new URL(location.href); url.searchParams.set('lang', lang);
    try { history.replaceState(null, '', url); } catch {}
  } else if (element.id === 'theme') S.settings.theme = element.value;
  else if (element.dataset.setting) S.settings[element.dataset.setting] = ['size', 'humanSeat'].includes(element.dataset.setting) ? Number(element.value) : element.value;
  else return;
  render();
});
root.addEventListener('focusin', (event) => {
  if (event.target.dataset.index !== undefined) {
    focusIndex = Number(event.target.dataset.index);
    root.querySelectorAll('[data-index]').forEach((point) => { point.tabIndex = Number(point.dataset.index) === focusIndex ? 0 : -1; });
  }
});
root.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && S.preview !== null) { S.preview = null; render(); return; }
  const raw = event.target.dataset.index;
  if (raw === undefined || !S.game) return;
  const size = S.game.size, i = Number(raw), r = Math.floor(i / size), c = i % size;
  const target = ({ ArrowLeft: r * size + Math.max(0, c - 1), ArrowRight: r * size + Math.min(size - 1, c + 1),
    ArrowUp: Math.max(0, r - 1) * size + c, ArrowDown: Math.min(size - 1, r + 1) * size + c,
    Home: event.ctrlKey ? 0 : r * size, End: event.ctrlKey ? size * size - 1 : r * size + size - 1 })[event.key];
  if (target !== undefined) { event.preventDefault(); root.querySelector(`[data-index="${target}"]`)?.focus(); }
});
document.addEventListener('visibilitychange', () => session?.refresh());
window.addEventListener('pagehide', () => { save(); session?.stop(); });
window.addEventListener('pageshow', (event) => { if (event.persisted && session) session.start(); });

if (params.has('room')) {
  S.screen = 'home'; S.settings.mode = 'room';
  render(); void connect('join');
} else if (S.active?.mode === 'room' && S.screen !== 'home') {
  reconnecting = true; render(); void connect('resume');
} else render();
