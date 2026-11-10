import { BOARDS, createGame, reduceMove } from './logic.js';
import { rollDie, computerMove, computerDelay } from './ai.js';
import { languages, messages, chooseLanguage, translate } from './i18n.js';
import { STORAGE_KEY, restore, mayRoll, animationFrames } from './controller.js';
import { boardSvg, heroArt, symbols, tokenPoint } from './art.js';
import { RoomsClient, OnlineSession, RoomError, normalizeCode, apiBase, canSkip, initialOnline } from './rooms.js';

const app = document.querySelector('#app'), announcer = document.querySelector('#announcer');
let storage, storageFailed = false;
try { storage = window.localStorage; } catch { storageFailed = true; }
let raw;
try { raw = storage?.getItem(STORAGE_KEY); } catch { storageFailed = true; }
const saved = restore(raw), params = new URLSearchParams(location.search);
let lang = chooseLanguage(params.get('lang'), navigator.languages ?? [navigator.language]);
let settings = saved.settings, localGame = saved.local, screen = saved.screen === 'local' ? 'local' : 'home', game = screen === 'local' ? localGame : null;
let mode = 'local', roomInput = params.get('room') ?? saved.roomCode, session = null;
let working = false, animating = false, errorKey = '', loginError = false, copied = false, enlarged = false, aiTimer, animationId = 0, navigationId = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const client = new RoomsClient({ base: apiBase(location), storage });
client.onStorageError = () => { storageFailed = true; };
const t = (key, args) => translate(lang, key, args);
const player = seat => t('player', { n: seat + 1 });
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const button = (action, text, primary = false, disabled = false) => `<button type="button" data-action="${action}" class="${primary ? 'primary' : ''}" ${disabled ? 'disabled' : ''}>${escape(text)}</button>`;
const options = (values, selected) => values.map(([value, text]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${escape(text)}</option>`).join('');
function persist() {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify({ v: 1, settings, local: localGame, screen, roomCode: session?.code ?? roomInput })); }
  catch { storageFailed = true; }
}
function announce(text) { announcer.textContent = ''; requestAnimationFrame(() => { announcer.textContent = text; }); }
function applyTheme() { document.documentElement.dataset.theme = settings.theme; }
function preferences() {
  return `<div class="preferences"><label>${t('language')}<select id="language">${options(Object.entries(languages), lang)}</select></label><label>${t('theme')}<select id="theme">${options(['auto', 'light', 'dark'].map(v => [v, t(v)]), settings.theme)}</select></label></div>`;
}
function rules() {
  return `<details class="rules"><summary>${t('rules')}</summary><p>${t('rulesBody')}</p><p>${t('finishRule')}</p><p>${t('freeRule')}</p><p>${t('sixRule')}</p></details>`;
}
function setup() {
  return `<div class="form-grid"><label>${t('players')}<select id="count">${options([2, 3, 4].map(n => [String(n), String(n)]), String(settings.players.length))}</select></label><label>${t('board')}<select id="board">${options(['classic', 'short'].map(v => [v, t(v)]), settings.board)}</select></label></div>
    ${mode === 'local' ? `<div class="seat-setup">${settings.players.map((kind, i) => `<label><span class="seat-symbol p${i}">${symbols[i]}</span> ${player(i)}<select id="seat-${i}" data-seat="${i}">${options(['human', 'computer'].map(v => [v, t(v)]), kind)}</select></label>`).join('')}</div>` : ''}
    <label class="check"><input id="exact" type="checkbox" ${settings.exact ? 'checked' : ''}><span>${t('exact')}</span></label><label class="check"><input id="again" type="checkbox" ${settings.again ? 'checked' : ''}><span>${t('again')}</span></label>`;
}
function homeView() {
  return `<main id="main"><section class="hero">${heroArt()}<p class="eyebrow">${t('eyebrow')}</p><h1>${t('title')}</h1><p>${t('intro')}</p></section>
  <section class="panel setup"><div class="mode-switch" role="group" aria-label="${escape(t('start'))}"><button type="button" data-action="local-mode" aria-pressed="${mode === 'local'}">${t('local')}</button><button type="button" data-action="online-mode" aria-pressed="${mode === 'online'}">${t('online')}</button></div>
    ${mode === 'online' ? `<p class="muted">${t('roomHelp')}</p>` : ''}${setup()}
    ${mode === 'local' ? `<div class="actions">${button('new', t('start'), true)}${localGame ? button('resume', t('resume')) : ''}</div>` : `<div class="actions">${button('create', t('create'), true, working)}${saved.roomCode || session ? button('room-resume', t('roomResume'), false, working) : ''}</div><form id="join-form"><label for="room-input">${t('roomCode')}</label><div class="join-row"><input id="room-input" value="${escape(roomInput)}" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="16" placeholder="ABC234" required><button type="submit" ${working ? 'disabled' : ''}>${t('join')}</button></div></form><p class="small muted">${t('roomTrust')}</p>`}
  </section><section class="panel">${rules()}<p class="about">${t('about')}</p></section></main>`;
}
function lastRollText(g) {
  if (!g.last) return '';
  const l = g.last, end = BOARDS[g.board].end;
  let text = t('rolled', { player: player(l.seat), roll: l.roll, from: l.from, to: l.to });
  if (g.exact && l.from + l.roll > end) text += ' ' + t('bounced');
  for (const jump of l.jumps) text += ' ' + t(jump.kind === 'ladder' ? 'climbed' : 'slid', jump);
  if (g.again && l.roll === 6 && g.status !== 'finished') text += ' ' + t('extraTurn');
  return text;
}
function playersView(g) {
  return `<ol class="players">${g.players.map((kind, i) => `<li class="${g.turn === i ? 'current' : ''}"><span class="seat-symbol p${i}">${symbols[i]}</span><span><strong>${player(i)}</strong><small>${screen === 'local' ? t(kind) : session.seat === i ? t('you', { player: player(i) }) : t(session.room.seats.find(p => p.seat === i)?.joined ? 'seatReady' : 'seatWaiting')}</small></span><b>${g.positions[i] ? t('position', { n: g.positions[i] }) : t('offBoard')}</b></li>`).join('')}</ol>`;
}
function lobbyView() {
  const room = session.room;
  return `<main id="main" class="lobby panel"><p class="eyebrow">${t('roomCode')}</p><h1 class="code">${escape(session.code)}</h1><div class="actions">${button('copy', t(copied ? 'copied' : 'copy'))}</div><h2>${t('waiting')}</h2><p>${t('waitingHint')}</p><p>${t('joined', { n: room.seats.filter(s => s.joined).length })} · ${t('you', { player: player(session.seat) })}</p>${playersView(game)}${session.seat === 0 ? button('start-room', t('startRoom'), true, working || room.seats.filter(s => s.joined).length < 2) : ''}<p class="small muted">${t('expireHint')}</p>${button('home', t('home'))}</main>`;
}
function gameView() {
  const g = game, end = BOARDS[g.board].end, finished = g.status === 'finished';
  const canRoll = mayRoll(g, screen, session?.seat, false, working || animating);
  return `<main id="main" class="play-layout"><section class="board-panel"><div class="board-top"><span>${t('finishHint', { n: end })}</span>${button('zoom', t(enlarged ? 'zoomOut' : 'zoom'))}</div><div class="board-scroll" tabindex="0" aria-label="${escape(t('board'))}"><div class="board-wrap ${enlarged ? 'enlarged' : ''}">${boardSvg(g, escape(t('boardLabel', { n: end })))}</div></div></section>
  <section class="play-info"><div class="panel turn-card ${finished ? 'finished' : ''}"><p class="eyebrow">${screen === 'online' ? `${t('roomCode')} · ${escape(session.code)}` : t('local')}</p><h1>${t(finished ? 'winner' : 'turn', { player: player(finished ? g.winner : g.turn) })}</h1>
  ${finished ? `<p>${t('turns', { n: g.turns })}</p><div class="actions">${button('again', t('playAgain'), true)}${button('home', t('home'))}</div>` : `<div class="roll-area"><div class="die" aria-hidden="true">${g.last?.roll ?? '·'}</div>${button('roll', t(animating ? 'rolling' : screen === 'local' && g.players[g.turn] === 'computer' ? 'computerThinking' : 'roll'), true, !canRoll)}</div>`}
  <p class="last-roll">${lastRollText(g)}</p>${!finished && screen === 'online' && canSkip(session.room, session.seat) ? `<p>${t('idleHint')}</p>${button('skip', t('skip'), false, working || animating)}` : ''}</div>
  <section class="panel">${playersView(g)}${!finished ? `<div class="actions">${button('home', t('pause'))}${button('new-home', t('newGame'))}</div>` : ''}<details><summary>${t('journey')}</summary><div class="connections">${Object.entries(BOARDS[g.board].ladders).map(([from, to]) => `<p>${t('ladder', { from, to })}</p>`).join('')}${Object.entries(BOARDS[g.board].snakes).map(([from, to]) => `<p>${t('snake', { from, to })}</p>`).join('')}</div></details>${rules()}</section></section></main>`;
}
function render() {
  const focused = document.activeElement, id = focused?.id, action = focused?.dataset?.action;
  const preferencesOpen = !!app.querySelector('.settings[open]');
  document.documentElement.lang = lang; document.title = t('title'); applyTheme();
  app.innerHTML = `<div class="shell"><header>${screen === 'home' ? `<a class="back" href="/games">${t('games')}</a>` : button('home', t('pause'))}<details class="settings"><summary>${t('settings')}</summary>${preferences()}</details></header><div id="feedback" ${errorKey || storageFailed ? '' : 'hidden'} class="notice" role="alert">${errorKey ? escape(t(errorKey)) : ''}${loginError ? ` <a href="https://appai.info/api/auth/signin">${t('signInLink')}</a>` : ''}${storageFailed ? `<p>${t('storageWarning')}</p>` : ''}</div>${screen === 'home' ? homeView() : screen === 'online' && session?.room.status === 'waiting' ? lobbyView() : gameView()}</div>`;
  app.querySelector('.settings').open = preferencesOpen;
  if (id) document.getElementById(id)?.focus({ preventScroll: true });
  else if (action) app.querySelector(`[data-action="${action}"]`)?.focus({ preventScroll: true });
}
function showError(error, creating = false) {
  loginError = creating && [401, 403, 503].includes(error.status);
  errorKey = loginError ? 'signIn' : messages[lang][error.error] ? error.error : 'invalid_request';
  if (['room_not_found', 'invalid_state', 'history_gap'].includes(errorKey)) { session?.stop(); screen = 'home'; mode = 'online'; game = null; }
  persist(); render(); announce(t(errorKey));
}
function scheduleComputer() {
  clearTimeout(aiTimer);
  if (screen === 'local' && game?.status === 'playing' && game.players[game.turn] === 'computer' && !animating && !working) aiTimer = setTimeout(() => void roll(), computerDelay(reducedMotion.matches));
}
async function tween(node, from, to, duration, id) {
  const start = performance.now();
  await new Promise(resolve => {
    function frame(now) {
      if (id !== animationId) return resolve();
      const progress = Math.min(1, (now - start) / duration), eased = progress * progress * (3 - 2 * progress);
      node?.setAttribute('transform', `translate(${from.x + (to.x - from.x) * eased} ${from.y + (to.y - from.y) * eased})`);
      if (progress < 1) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
}
async function present(next, previous) {
  const id = ++animationId;
  if (!reducedMotion.matches && !document.hidden && previous && next.turns === previous.turns + 1 && next.last && app.querySelector('#board-svg')) {
    animating = true;
    game = previous; render();
    const last = next.last, node = document.querySelector(`#token-${last.seat}`), end = BOARDS[next.board].end;
    let from = tokenPoint(last.from, last.seat, end);
    for (const frame of animationFrames(last)) {
      const to = tokenPoint(frame.square, last.seat, end);
      await tween(node, from, to, frame.jump ? 440 : 95, id); from = to;
      if (id !== animationId) return;
    }
  }
  if (id !== animationId) return;
  animating = false; game = next; render();
  announce([lastRollText(next), t(next.status === 'finished' ? 'winner' : 'turn', { player: player(next.winner ?? next.turn) })].filter(Boolean).join(' '));
  scheduleComputer();
}
async function roll() {
  if (working || animating || !game || game.status !== 'playing') return;
  if (screen === 'online' && !mayRoll(game, screen, session.seat, session.room.status !== 'playing')) return;
  const navigation = navigationId, activeSession = session;
  working = true; errorKey = ''; loginError = false;
  try {
    const move = screen === 'local' && game.players[game.turn] === 'computer' ? computerMove(game) : { roll: rollDie() };
    if (screen === 'local') {
      const previous = game, next = reduceMove(game, game.turn, move);
      localGame = next; persist(); working = false; await present(next, previous);
    } else { render(); await activeSession.action('roll', move); }
  } catch (e) { if (navigation === navigationId) showError(e instanceof RoomError ? e : { error: e.message }); }
  finally { if (navigation === navigationId) { working = false; if (!animating) render(); scheduleComputer(); } }
}
function sessionChanged(current) {
  if (current !== session || screen !== 'online') return;
  const previous = game, next = current.state;
  // A newer update cancels an older animation and presents the latest verified state.
  void present(next, previous);
}
async function connect(kind) {
  if (working) return;
  const navigation = ++navigationId;
  working = true; errorKey = ''; loginError = false; render();
  try {
    let data, checkpoint;
    if (kind === 'create') data = await client.create(initialOnline(settings));
    else {
      const code = normalizeCode(kind === 'resume' ? session?.code ?? saved.roomCode ?? roomInput : roomInput);
      const cached = client.read(code);
      if (cached?.token) {
        data = { ...cached, code, ...(await client.poll(code, cached.token, -1)) };
        checkpoint = cached.checkpoint;
      } else data = await client.join(code);
    }
    if (navigation !== navigationId) return;
    session?.stop();
    session = new OnlineSession(client, { ...data, checkpoint }, sessionChanged, e => showError(e));
    screen = 'online'; mode = 'online'; game = session.state; roomInput = session.code;
    saved.roomCode = session.code; session.persist(); persist(); render();
    announce(t(session.room.status === 'waiting' ? 'waiting' : game.status === 'finished' ? 'winner' : 'turn', { player: player(game.winner ?? game.turn) }));
    session.startPolling();
  } catch (e) { if (navigation === navigationId) showError(e, kind === 'create'); }
  finally { if (navigation === navigationId) { working = false; render(); } }
}
function goHome() {
  ++navigationId; ++animationId; animating = false; working = false; clearTimeout(aiTimer); session?.stop();
  screen = 'home'; game = null; errorKey = ''; loginError = false; persist(); render();
}
function startLocal(useSaved = false) {
  session?.stop(); ++navigationId; ++animationId; animating = false; working = false;
  game = useSaved && localGame ? localGame : createGame(settings);
  localGame = game; screen = 'local'; errorKey = ''; loginError = false; enlarged = false;
  persist(); render(); announce(t(game.status === 'finished' ? 'winner' : 'turn', { player: player(game.winner ?? game.turn) })); scheduleComputer();
}
app.addEventListener('click', async event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (['home', 'new-home'].includes(action)) return goHome();
  if (action === 'local-mode' || action === 'online-mode') { mode = action === 'local-mode' ? 'local' : 'online'; errorKey = ''; loginError = false; return render(); }
  if (action === 'new') return startLocal();
  if (action === 'resume') return startLocal(true);
  if (action === 'again') return screen === 'local' ? startLocal() : goHome();
  if (action === 'roll') return roll();
  if (action === 'zoom') { enlarged = !enlarged; return render(); }
  if (action === 'create') return connect('create');
  if (action === 'room-resume') return connect('resume');
  if (action === 'copy') {
    try { await navigator.clipboard.writeText(session.code); copied = true; render(); announce(t('copied')); } catch { /* Code remains selectable for manual copying. */ }
    return;
  }
  if (['start-room', 'skip'].includes(action) && !working && !animating) {
    const navigation = navigationId, activeSession = session;
    working = true; errorKey = ''; render();
    try { await activeSession.action(action === 'skip' ? 'skip' : 'start'); }
    catch (e) { if (navigation === navigationId) showError(e); }
    finally { if (navigation === navigationId) { working = false; render(); } }
  }
});
app.addEventListener('submit', event => { if (event.target.id === 'join-form') { event.preventDefault(); void connect('join'); } });
app.addEventListener('input', event => { if (event.target.id === 'room-input') roomInput = event.target.value; });
app.addEventListener('change', event => {
  const { id, value, checked, dataset } = event.target;
  if (id === 'language') {
    lang = value; const url = new URL(location.href); url.searchParams.set('lang', lang); history.replaceState(null, '', url);
  } else if (id === 'theme') settings.theme = value;
  else if (id === 'board') settings.board = value;
  else if (id === 'exact' || id === 'again') settings[id] = checked;
  else if (id === 'count') settings.players = Array.from({ length: +value }, (_, i) => settings.players[i] ?? 'human');
  else if (dataset.seat !== undefined) settings.players[+dataset.seat] = value;
  else return;
  persist(); render();
  if (id === 'language' && game) announce(t(game.status === 'finished' ? 'winner' : 'turn', { player: player(game.winner ?? game.turn) }));
});
document.addEventListener('visibilitychange', () => { session?.visibilityChanged(); if (document.hidden) { ++animationId; animating = false; if (screen === 'local') game = localGame; else if (screen === 'online') game = session.state; render(); } else scheduleComputer(); });
document.addEventListener('keydown', event => {
  if (event.code === 'Space' && !event.target.closest('button,a,input,select,summary,textarea') && mayRoll(game, screen, session?.seat, session?.room.status === 'waiting', working || animating)) { event.preventDefault(); void roll(); }
});
if (params.has('room')) { screen = 'home'; game = null; mode = 'online'; }
render(); scheduleComputer();
if (saved.screen === 'online' && !params.has('room') && saved.roomCode) void connect('resume');
