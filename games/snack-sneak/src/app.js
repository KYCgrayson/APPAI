// Snack Sneaks — pass-one-phone UI. The app is the host: it deals roles,
// walks the phone around at night, announces the morning, times the day and
// records the vote. No network, no accounts; state lives in localStorage.
import * as L from './logic.js';
import { STRINGS, SNACKS } from './i18n.js';

const KEY = 'snack-sneak:v1';
const root = document.getElementById('app');

const defaults = () => ({
  lang: detectLang(),
  voice: true,
  minutes: 3,
  count: 6,
  names: [],
  screen: 'home',
  game: null,
  ui: {},
});

let S = load() || defaults();
let tick = null;
let lockUntil = 0;

function detectLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q) return q.toLowerCase().startsWith('zh') ? 'zh-TW' : 'en';
  return (navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh-TW' : 'en';
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!s || typeof s !== 'object' || !s.ui) return null;
    // Always open on the home screen; an unfinished game can be resumed from there.
    if (s.game && !s.game.winner && !['home', 'rules', 'setup', 'end'].includes(s.screen)) {
      s.paused = { screen: s.screen, ui: s.ui };
    }
    if (!s.game || s.game.winner) s.paused = null;
    // A finished game has nothing secret left: reopen straight on the result.
    s.screen = s.game && s.game.winner && !['home', 'rules', 'setup'].includes(s.screen) ? 'end' : 'home';
    s.ui = {};
    if (new URLSearchParams(location.search).get('lang')) s.lang = detectLang();
    return s;
  } catch {
    return null;
  }
}

/** After a reload, never land on a private screen: go back to the hand-off. */
function normalize(s) {
  const g = s.game;
  if (!g) return { ...s, screen: 'home' };
  if (s.screen === 'reveal') s.ui = { turn: s.ui.turn || 0, step: 'handoff' };
  if (s.screen === 'night') {
    let turn = s.ui.turn || 0;
    // If the reload interrupted someone's private result, hand the phone back to them.
    if (s.ui.step !== 'feedback') while (turn < g.n && g.actions.done.includes(turn)) turn++;
    s.ui = { turn, step: 'handoff' };
    if (turn >= g.n) s.screen = 'nightDone';
  }
  if (s.screen === 'day') {
    // Resume from the time left when the page was closed, not from the full timer.
    const left = s.ui.running ? (s.ui.lastSaved ?? s.ui.left) : s.ui.left;
    s.ui = { running: false, left };
  }
  return s;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {
    /* storage may be unavailable (private mode); the game still works */
  }
}

const T = () => STRINGS[S.lang];
const esc = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nm = (seat) => S.game.players[seat].name;
const label = (seat) => `${T().seat(seat + 1)} ${nm(seat)}`;

function speak(text) {
  if (!S.voice || !('speechSynthesis' in window)) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = S.lang === 'zh-TW' ? 'zh-TW' : 'en-US';
    const v = synth.getVoices().find((x) => x.lang.replace('_', '-').startsWith(u.lang.slice(0, 2)) && (u.lang !== 'zh-TW' || /TW|HK|Hant/i.test(x.lang + x.name)));
    if (v) u.voice = v;
    u.rate = 0.95;
    synth.speak(u);
  } catch {
    /* narration is optional */
  }
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {
    /* sound is optional */
  }
}

function go(screen, ui = {}) {
  S.screen = screen;
  S.ui = ui;
  save();
  render();
  window.scrollTo(0, 0);
}

// ---------- screens ----------

function header(extra = '') {
  const inGame = S.game && !['home', 'rules', 'setup', 'end'].includes(S.screen);
  return `<header class="bar">
    <span class="brand">🍪 ${esc(T().title)}</span>
    ${extra}
    ${inGame ? `<button class="link" data-a="quit">${esc(T().quit)}</button>` : ''}
  </header>`;
}

function plateLine() {
  const g = S.game;
  return `<div class="plates" aria-label="${esc(T().plates(L.eatenCount(g), L.threshold(g.n)))}">
    ${g.players.map((_, i) => `<span class="plate ${g.eaten[i] ? 'empty' : ''}" title="${esc(label(i))}">${g.eaten[i] ? '🍽️' : SNACKS[i]}</span>`).join('')}
  </div>
  <p class="muted center">${esc(T().plates(L.eatenCount(g), L.threshold(g.n)))}</p>`;
}

function screenHome() {
  const t = T();
  const canResume = Boolean(S.paused && S.game && !S.game.winner);
  return `${header(`<button class="link" data-a="lang">${esc(t.lang)}</button>`)}
  <main class="center stack">
    <div class="hero">🍪🍩🧁</div>
    <h1>${esc(t.title)}</h1>
    <p class="lead">${esc(t.tagline)}</p>
    ${canResume ? `<button class="btn primary" data-a="resume">${esc(t.resume)}</button>` : ''}
    <button class="btn ${canResume ? '' : 'primary'}" data-a="setup">${esc(t.newGame)}</button>
    <button class="btn" data-a="rules">${esc(t.rules)}</button>
    <p class="muted small">${esc(t.privacy)}</p>
  </main>`;
}

function screenRules() {
  const t = T();
  const roles = ['sneak', 'sniffer', 'guard', 'crumb', 'detective', 'helper'];
  return `${header()}
  <main class="stack">
    <h2>${esc(t.rules)}</h2>
    ${t.rulesBody.map((p) => `<p>${esc(p)}</p>`).join('')}
    <ul class="roles">${roles
      .map((r) => `<li><span class="icon">${t.roleIcon[r]}</span><div><b>${esc(t.roleName[r])}</b><br>${esc(t.roleDesc[r])}</div></li>`)
      .join('')}</ul>
    <button class="btn" data-a="home">${esc(t.back)}</button>
  </main>`;
}

function screenSetup() {
  const t = T();
  const n = S.count;
  const inputs = Array.from({ length: n }, (_, i) => {
    const v = S.names[i] || '';
    return `<label class="name"><span>${SNACKS[i]} ${esc(t.seat(i + 1))}</span>
      <input data-name="${i}" maxlength="12" value="${esc(v)}" placeholder="${esc(t.namePh(i + 1))}" autocomplete="off"></label>`;
  }).join('');
  return `${header()}
  <main class="stack">
    <h2>${esc(t.newGame)}</h2>
    <div class="row between">
      <span>${esc(t.players)}</span>
      <div class="stepper">
        <button class="btn sq" data-a="count" data-d="-1" ${n <= L.MIN_PLAYERS ? 'disabled' : ''} aria-label="-1">−</button>
        <b aria-live="polite">${n}</b>
        <button class="btn sq" data-a="count" data-d="1" ${n >= L.PASS_AND_PLAY_MAX ? 'disabled' : ''} aria-label="+1">＋</button>
      </div>
    </div>
    <p class="muted small">${esc(t.maxNote(L.PASS_AND_PLAY_MAX))}</p>
    <div class="names">${inputs}</div>
    <div class="row between">
      <span>${esc(t.discussion)}</span>
      <div class="seg">${[2, 3, 5]
        .map((m) => `<button class="btn chip ${S.minutes === m ? 'on' : ''}" data-a="minutes" data-m="${m}">${esc(t.minutes(m))}</button>`)
        .join('')}</div>
    </div>
    <div class="row between">
      <span>${esc(t.voice)}</span>
      <div class="seg">
        <button class="btn chip ${S.voice ? 'on' : ''}" data-a="voice" data-v="1">${esc(t.on)}</button>
        <button class="btn chip ${!S.voice ? 'on' : ''}" data-a="voice" data-v="0">${esc(t.off)}</button>
      </div>
    </div>
    <p class="note">${esc(t.setupNote(L.sneakCount(n), L.threshold(n)))}</p>
    <button class="btn primary" data-a="deal">${esc(t.start)}</button>
    <button class="btn" data-a="home">${esc(t.back)}</button>
  </main>`;
}

function handoff(seat, action) {
  const t = T();
  return `<main class="center stack handoff">
    <p class="muted">${esc(t.passTo(nm(seat)))}</p>
    <div class="who">${SNACKS[seat]}<br>${esc(label(seat))}</div>
    <button class="btn primary big" data-a="${action}">${esc(t.iAm(nm(seat)))}</button>
  </main>`;
}

function roleCard(seat) {
  const t = T();
  const g = S.game;
  const role = g.players[seat].role;
  const team = role === 'sneak' ? t.team.sneak : t.team.good;
  let extra = '';
  if (role === 'sneak') {
    const others = L.sneakSeats(g).filter((s) => s !== seat);
    extra = `<p class="secret">${esc(others.length ? t.partners(others.map(label).join(T().sep)) : t.noPartners)}</p>`;
  }
  return `<div class="card role-${role}">
    <div class="icon big">${t.roleIcon[role]}</div>
    <h2>${esc(t.roleName[role])}</h2>
    <p class="muted">${esc(team)}</p>
    <p>${esc(t.roleDesc[role])}</p>
    ${extra}
  </div>`;
}

function screenReveal() {
  const t = T();
  const { turn, step } = S.ui;
  if (step === 'handoff') return header() + handoff(turn, 'iam');
  return `${header()}
  <main class="center stack">
    <p class="muted">${esc(label(turn))}</p>
    <div class="hold" data-hold tabindex="0" role="button" aria-pressed="false">
      <div class="hold-cover">👀<br>${esc(t.holdToSee)}<br><span class="small muted">${esc(t.release)}</span></div>
      <div class="hold-face" hidden>${roleCard(turn)}</div>
    </div>
    <button class="btn primary" data-a="seen" ${S.ui.seen ? '' : 'disabled'}>${esc(t.seenNext)}</button>
  </main>`;
}

function screenNightIntro() {
  const t = T();
  return `${header()}
  <main class="center stack night">
    <div class="hero">🌙</div>
    <h2>${esc(t.nightTitle(S.game.night))}</h2>
    <p>${esc(t.nightIntro)}</p>
    <button class="btn primary big" data-a="beginNight">${esc(t.beginNight)}</button>
  </main>`;
}

function pickGrid(seats, plateMode) {
  const g = S.game;
  const t = T();
  return `<div class="grid">${g.players
    .map((p, i) => {
      const ok = seats.includes(i);
      const sel = S.ui.pick === i;
      const icon = plateMode ? (g.eaten[i] ? '🍽️' : SNACKS[i]) : p.out ? '🧽' : SNACKS[i];
      return `<button class="tile ${sel ? 'sel' : ''}" data-a="pick" data-s="${i}" ${ok ? '' : 'disabled'} aria-pressed="${sel}">
        <span class="icon">${icon}</span><span class="seatno">${esc(t.seat(i + 1))}</span><span class="pname">${esc(p.name)}</span>
        ${p.out ? `<span class="tag">${esc(t.washing)}</span>` : ''}
      </button>`;
    })
    .join('')}</div>`;
}

function screenNight() {
  const t = T();
  const g = S.game;
  const { turn, step } = S.ui;
  if (step === 'handoff') return header() + handoff(turn, 'nightIam');
  const task = L.nightTask(g, turn);
  const roleKey = task === 'helper' ? 'helper' : g.players[turn].role;
  if (step === 'feedback') {
    const f = S.ui.feedback;
    const msg = task === 'sniffer' ? (f.isSneak ? t.sniffYes(label(S.ui.pick)) : t.sniffNo(label(S.ui.pick))) : t.noted;
    return `${header()}
    <main class="center stack night">
      <div class="icon big">${task === 'sniffer' ? (f.isSneak ? '😋' : '✨') : '✅'}</div>
      <p class="secret big-text">${esc(msg)}</p>
      <button class="btn primary big" data-a="nextTurn">${esc(t.coverNext)}</button>
    </main>`;
  }
  const notes = [];
  if (task === 'sneak') {
    const others = L.sneakSeats(g).filter((s) => s !== turn);
    notes.push(others.length ? t.partners(others.map(label).join(T().sep)) : t.noPartners);
    if (g.actions.sneak !== null) notes.push(t.proposal(label(g.actions.sneak)));
  }
  if (task === 'guard' && g.lastGuard !== null) notes.push(t.lastGuard(label(g.lastGuard)));
  if (g.players[turn].role === 'crumb' && task !== 'helper' && g.actions.hint) {
    notes.push(t.crumbHint(g.actions.hint.map((s) => t.seat(s + 1)).join(T().sep)));
  }
  if (task === 'suspect') notes.push(t.suspectNote);
  const plateMode = task === 'sneak' || task === 'guard';
  return `${header()}
  <main class="stack night">
    <p class="muted center">${t.roleIcon[roleKey]} ${esc(t.roleName[roleKey])} · ${esc(label(turn))}</p>
    <h2 class="center">${esc(t.task[task])}</h2>
    ${notes.map((n) => `<p class="secret">${esc(n)}</p>`).join('')}
    ${pickGrid(L.legalTargets(g, turn), plateMode)}
    <button class="btn primary big" data-a="confirmPick" ${S.ui.pick === undefined ? 'disabled' : ''}>${esc(t.confirm)}</button>
  </main>`;
}

function screenNightDone() {
  const t = T();
  return `${header()}
  <main class="center stack">
    <div class="hero">🌅</div>
    <h2>${esc(t.allDone)}</h2>
    <p>${esc(t.allDoneNote)}</p>
    <button class="btn primary big" data-a="morning">${esc(t.goMorning)}</button>
  </main>`;
}

function morningLines(r) {
  const t = T();
  const lines = [];
  if (r.eaten !== null) lines.push(t.eaten(label(r.eaten)));
  if (r.blocked) lines.push(t.blocked);
  for (const h of r.helpers) lines.push(t.helperSays(label(h)));
  return lines;
}

function screenMorning() {
  const t = T();
  const g = S.game;
  const r = g.log[g.log.length - 1];
  const lines = morningLines(r);
  return `${header()}
  <main class="center stack">
    <h2>${esc(t.morningTitle(r.night))}</h2>
    ${lines.map((l) => `<p class="announce">${esc(l)}</p>`).join('')}
    ${plateLine()}
    ${g.winner
      ? `<button class="btn primary big" data-a="end">${esc(t.seeResult)}</button>`
      : `<button class="btn primary big" data-a="day">${esc(t.startDay)}</button>`}
  </main>`;
}

function timeLeft() {
  const u = S.ui;
  return Math.max(0, u.running ? Math.ceil((u.endAt - Date.now()) / 1000) : u.left);
}

function screenDay() {
  const t = T();
  const left = timeLeft();
  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, '0');
  return `${header()}
  <main class="center stack">
    <h2>${esc(t.dayTitle(S.game.night))}</h2>
    <div class="timer ${left === 0 ? 'done' : ''}" aria-live="off">${left === 0 ? esc(t.timeUp) : `${mm}:${ss}`}</div>
    ${left > 0 ? `<button class="btn" data-a="toggleTimer">${esc(S.ui.running ? t.pause : t.play)}</button>` : ''}
    ${plateLine()}
    <button class="btn primary big" data-a="vote">${esc(t.toVote)}</button>
  </main>`;
}

function screenVote() {
  const t = T();
  const g = S.game;
  const c = S.ui.confirm;
  if (c !== undefined) {
    return `${header()}
    <main class="center stack">
      <div class="hero">${SNACKS[c]}</div>
      <h2>${esc(t.sendToDishes(label(c)))}</h2>
      <button class="btn primary big" data-a="doVote">${esc(t.yes)}</button>
      <button class="btn" data-a="cancelVote">${esc(t.cancel)}</button>
    </main>`;
  }
  return `${header()}
  <main class="stack">
    <h2 class="center">${esc(t.voteTitle)}</h2>
    <p>${esc(t.voteHow)}</p>
    ${pickGrid(L.activeSeats(g), false).replaceAll('data-a="pick"', 'data-a="votePick"')}
    <button class="btn" data-a="noOne">${esc(t.noOne)}</button>
  </main>`;
}

function screenVoteResult() {
  const t = T();
  const g = S.game;
  const seat = S.ui.voted;
  const body =
    seat === null
      ? `<h2>${esc(t.nobody)}</h2>`
      : `<div class="hero">🧽</div><h2>${esc(t.revealTitle(label(seat)))}</h2>
         <p class="announce">${t.roleIcon[g.players[seat].role]} ${esc(t.revealRole(t.roleName[g.players[seat].role]))}</p>`;
  return `${header()}
  <main class="center stack">
    ${body}
    ${g.winner
      ? `<button class="btn primary big" data-a="end">${esc(t.seeResult)}</button>`
      : `<button class="btn primary big" data-a="nextNight">${esc(t.nextNight)}</button>`}
  </main>`;
}

function screenEnd() {
  const t = T();
  const g = S.game;
  const ate = L.eatenCount(g) >= L.threshold(g.n);
  const msg = g.winner === 'good' ? t.winGood : ate ? t.winSneak : t.winSneakParity;
  return `${header()}
  <main class="stack">
    <div class="hero center">${g.winner === 'good' ? '🎉🕵️🎉' : '😋🍰😋'}</div>
    <h2 class="center">${esc(msg)}</h2>
    ${plateLine()}
    <h3>${esc(t.allRoles)}</h3>
    <ul class="roles">${g.players
      .map(
        (p, i) => `<li class="${p.role === 'sneak' ? 'is-sneak' : ''}"><span class="icon">${t.roleIcon[p.role]}</span>
        <div><b>${esc(label(i))}</b> · ${esc(t.roleName[p.role])}${p.out ? ` · ${esc(t.washing)}` : ''}</div></li>`,
      )
      .join('')}</ul>
    <button class="btn primary" data-a="again">${esc(t.playAgain)}</button>
    <button class="btn" data-a="home">${esc(t.home)}</button>
  </main>`;
}

const SCREENS = {
  home: screenHome,
  rules: screenRules,
  setup: screenSetup,
  reveal: screenReveal,
  nightIntro: screenNightIntro,
  night: screenNight,
  nightDone: screenNightDone,
  morning: screenMorning,
  day: screenDay,
  vote: screenVote,
  voteResult: screenVoteResult,
  end: screenEnd,
};

function render() {
  document.documentElement.lang = S.lang;
  document.title = T().title;
  root.innerHTML = (SCREENS[S.screen] || screenHome)();
  document.body.classList.toggle('is-night', ['nightIntro', 'night'].includes(S.screen));
  clearInterval(tick);
  if (S.screen === 'day' && S.ui.running) tick = setInterval(onTick, 250);
  bindHold();
  // Ignore taps for a moment so a double tap cannot open the next player's private screen.
  lockUntil = Date.now() + 450;
  const main = root.querySelector('main');
  if (main) {
    main.tabIndex = -1;
    main.focus({ preventScroll: true });
  }
}

function onTick() {
  const left = timeLeft();
  if (left !== S.ui.lastSaved) {
    S.ui.lastSaved = left;
    if (left % 5 === 0) save();
  }
  const el = root.querySelector('.timer');
  if (left === 0) {
    clearInterval(tick);
    S.ui = { ...S.ui, running: false, left: 0 };
    save();
    beep();
    speak(T().timeUp);
    render();
    return;
  }
  if (el) el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

function bindHold() {
  const hold = root.querySelector('[data-hold]');
  if (!hold) return;
  const cover = hold.querySelector('.hold-cover');
  const face = hold.querySelector('.hold-face');
  const show = (e) => {
    if (e) e.preventDefault();
    cover.hidden = true;
    face.hidden = false;
    hold.setAttribute('aria-pressed', 'true');
    if (!S.ui.seen) {
      S.ui.seen = true;
      const b = root.querySelector('[data-a="seen"]');
      if (b) b.disabled = false;
    }
  };
  const hide = () => {
    cover.hidden = false;
    face.hidden = true;
    hold.setAttribute('aria-pressed', 'false');
  };
  hold.addEventListener('pointerdown', show);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => hold.addEventListener(ev, hide));
  hold.addEventListener('contextmenu', (e) => e.preventDefault());
  hold.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') show(e);
  });
  hold.addEventListener('keyup', hide);
  hold.addEventListener('blur', hide);
}

// ---------- actions ----------

function readNames() {
  root.querySelectorAll('[data-name]').forEach((el) => {
    S.names[Number(el.dataset.name)] = el.value.trim();
  });
}

function deal() {
  readNames();
  const t = T();
  const names = Array.from({ length: S.count }, (_, i) => S.names[i] || t.namePh(i + 1));
  S.game = L.newGame(names);
  S.paused = null;
  go('reveal', { turn: 0, step: 'handoff' });
}

function startNightTurn() {
  const g = S.game;
  const seat = S.ui.turn;
  if (g.actions.done.includes(seat)) {
    // Resumed after a reload on this player's result screen: show it again.
    const task = L.nightTask(g, seat);
    const pick = task === 'sniffer' ? g.actions.sniff : null;
    const feedback = task === 'sniffer' ? { task, isSneak: g.players[pick].role === 'sneak' } : { task };
    go('night', { turn: seat, step: 'feedback', pick, feedback });
    return;
  }
  // One clue per night, kept in the saved game so a reload cannot redraw it.
  if (g.players[seat].role === 'crumb' && L.isActive(g, seat) && !g.actions.hint) g.actions.hint = L.crumbHint(g);
  go('night', { turn: seat, step: 'act' });
}

const ACTIONS = {
  lang: () => {
    S.lang = S.lang === 'zh-TW' ? 'en' : 'zh-TW';
    save();
    render();
  },
  home: () => go('home'),
  rules: () => go('rules'),
  setup: () => go('setup'),
  resume: () => {
    S.screen = S.paused.screen;
    S.ui = S.paused.ui;
    S.paused = null;
    S = normalize(S);
    save();
    render();
  },
  quit: () => {
    if (confirm(T().quitConfirm)) {
      S.game = null;
      S.paused = null;
      go('home');
    }
  },
  count: (el) => {
    readNames();
    S.count = Math.min(L.PASS_AND_PLAY_MAX, Math.max(L.MIN_PLAYERS, S.count + Number(el.dataset.d)));
    save();
    render();
  },
  minutes: (el) => {
    readNames();
    S.minutes = Number(el.dataset.m);
    save();
    render();
  },
  voice: (el) => {
    readNames();
    S.voice = el.dataset.v === '1';
    save();
    render();
  },
  deal,
  iam: () => go('reveal', { turn: S.ui.turn, step: 'show', seen: false }),
  seen: () => {
    const next = S.ui.turn + 1;
    if (next < S.game.n) go('reveal', { turn: next, step: 'handoff' });
    else go('nightIntro');
  },
  beginNight: () => {
    speak(T().nightSay(S.game.night));
    go('night', { turn: 0, step: 'handoff' });
  },
  nightIam: startNightTurn,
  pick: (el) => {
    S.ui.pick = Number(el.dataset.s);
    render();
  },
  confirmPick: () => {
    if (S.ui.pick === undefined) return;
    const feedback = L.act(S.game, S.ui.turn, S.ui.pick);
    go('night', { turn: S.ui.turn, step: 'feedback', pick: S.ui.pick, feedback });
  },
  nextTurn: () => {
    const next = S.ui.turn + 1;
    if (next < S.game.n) go('night', { turn: next, step: 'handoff' });
    else go('nightDone');
  },
  morning: () => {
    const r = L.resolveNight(S.game);
    speak([T().morningTitle(r.night), ...morningLines(r)].join('。'));
    go('morning');
  },
  day: () => {
    speak(T().daySay);
    go('day', { running: true, endAt: Date.now() + S.minutes * 60000, left: S.minutes * 60 });
  },
  toggleTimer: () => {
    const left = timeLeft();
    S.ui = S.ui.running ? { running: false, left } : { running: true, endAt: Date.now() + left * 1000, left };
    save();
    render();
  },
  vote: () => go('vote'),
  votePick: (el) => go('vote', { confirm: Number(el.dataset.s) }),
  cancelVote: () => go('vote'),
  noOne: () => {
    L.vote(S.game, null);
    speak(T().nobody);
    go('voteResult', { voted: null });
  },
  doVote: () => {
    const seat = S.ui.confirm;
    L.vote(S.game, seat);
    const t = T();
    speak(`${t.revealTitle(label(seat))}。${t.revealRole(t.roleName[S.game.players[seat].role])}`);
    go('voteResult', { voted: seat });
  },
  nextNight: () => go('nightIntro'),
  end: () => {
    const t = T();
    const g = S.game;
    speak(g.winner === 'good' ? t.winGood : L.eatenCount(g) >= L.threshold(g.n) ? t.winSneak : t.winSneakParity);
    go('end');
  },
  again: () => {
    const names = S.game.players.map((p) => p.name);
    S.game = L.newGame(names);
    go('reveal', { turn: 0, step: 'handoff' });
  },
};

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled || Date.now() < lockUntil) return;
  const fn = ACTIONS[el.dataset.a];
  if (fn) fn(el);
});

root.addEventListener('input', (e) => {
  if (e.target.matches('[data-name]')) {
    S.names[Number(e.target.dataset.name)] = e.target.value.trim();
    save();
  }
});

window.addEventListener('pagehide', () => {
  if (S.screen === 'day' && S.ui.running) {
    S.ui.lastSaved = timeLeft();
    save();
  }
});

if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
render();
