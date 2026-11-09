// Werewolf (狼人殺) — pass-one-phone UI. The app is the moderator: it deals
// roles, walks the phone around twice each night, announces the morning,
// handles the hunter, times the day and records the vote.
// No network, no accounts; state lives in localStorage.
import * as L from './logic.js';
import { STRINGS, SEAT_ICONS, ROLE_ICON } from './i18n.js';

const KEY = 'werewolf:v1';
const root = document.getElementById('app');
const SETUP_SCREENS = ['home', 'rules', 'setup', 'end'];

const defaults = () => ({
  lang: detectLang(),
  voice: true,
  kid: false,
  minutes: 3,
  count: 8,
  names: [],
  screen: 'home',
  game: null,
  ui: {},
  paused: null,
});

let S = load() || defaults();
let tick = null;
let lockUntil = 0;
let lastKey = '';

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
    if (s.game && !s.game.winner && !SETUP_SCREENS.includes(s.screen)) s.paused = { screen: s.screen, ui: s.ui };
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

const passList = (g, pass) => (pass === 2 ? g.actions.pass2 : g.actions.pass1);

/** First alive seat after `after` that has not acted in this pass. */
function nextSeat(g, pass, after = -1) {
  return L.aliveSeats(g).find((s) => s > after && !passList(g, pass).includes(s));
}

/** After a reload, never land on a private screen: go back to a hand-off. */
function normalize(s) {
  const g = s.game;
  if (!g) return { ...s, screen: 'home' };
  if (s.screen === 'reveal') s.ui = { turn: s.ui.turn || 0, step: 'handoff' };
  if (s.screen === 'night') {
    const pass = s.ui.pass || 1;
    // If the reload interrupted someone's private result, hand the phone back to them.
    const turn = s.ui.step === 'feedback' ? s.ui.turn : nextSeat(g, pass);
    if (turn === undefined) {
      s.screen = pass === 1 ? 'pass2Intro' : 'nightDone';
      s.ui = {};
    } else s.ui = { pass, turn, step: 'handoff' };
  }
  if (s.screen === 'day') {
    // Resume from the time left when the page was closed, not from the full timer.
    const left = s.ui.running ? (s.ui.lastSaved ?? s.ui.left) : s.ui.left;
    s.ui = { running: false, left };
  }
  if (s.screen === 'shoot') s.ui = { after: s.ui.after, shot: s.ui.shot ?? null };
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
const W = () => T().words[S.kid ? 'kid' : 'classic'];
const esc = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nm = (seat) => S.game.players[seat].name;
const label = (seat) => `${T().seat(seat + 1)} ${nm(seat)}`;
const list = (seats) => seats.map(label).join(T().sep);

function speak(text) {
  if (!S.voice || !('speechSynthesis' in window)) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = S.lang === 'zh-TW' ? 'zh-TW' : 'en-US';
    const v = synth
      .getVoices()
      .find((x) => x.lang.replace('_', '-').startsWith(u.lang.slice(0, 2)) && (u.lang !== 'zh-TW' || /TW|HK|Hant/i.test(x.lang + x.name)));
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
  const inGame = S.game && !SETUP_SCREENS.includes(S.screen);
  return `<header class="bar">
    <span class="brand">🐺 ${esc(T().title)}</span>
    ${extra}
    ${inGame ? `<button class="link" data-a="quit">${esc(T().quit)}</button>` : ''}
  </header>`;
}

/** Public table view: who is still in, who is out. Roles stay hidden. */
function tableLine() {
  const g = S.game;
  return `<div class="table">${g.players
    .map(
      (p, i) =>
        `<span class="seat ${p.alive ? '' : 'out'}" title="${esc(label(i))}">${p.alive ? SEAT_ICONS[i] : '💤'}<small>${i + 1}</small></span>`,
    )
    .join('')}</div>`;
}

function roleSummary(n) {
  const t = T();
  const counts = {};
  for (const r of L.rolesFor(n)) counts[r] = (counts[r] || 0) + 1;
  return Object.entries(counts)
    .map(([r, c]) => `${ROLE_ICON[r]} ${t.roleName[r]}${c > 1 ? ` ×${c}` : ''}`)
    .join(t.sep);
}

function screenHome() {
  const t = T();
  const canResume = Boolean(S.paused && S.game && !S.game.winner);
  return `${header(`<button class="link" data-a="lang">${esc(t.lang)}</button>`)}
  <main class="center stack">
    <div class="hero">🌕🐺🏡</div>
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
  return `${header()}
  <main class="stack">
    <h2>${esc(t.rules)}</h2>
    ${(S.kid ? t.rulesBodyKid : t.rulesBody).map((p) => `<p>${esc(p)}</p>`).join('')}
    <ul class="roles">${L.ROLES.map(
      (r) => `<li><span class="icon">${ROLE_ICON[r]}</span><div><b>${esc(t.roleName[r])}</b><br>${esc(W().desc[r])}</div></li>`,
    ).join('')}</ul>
    <button class="btn" data-a="home">${esc(t.back)}</button>
  </main>`;
}

function chips(action, value, options) {
  return `<div class="seg">${options
    .map(([v, text]) => `<button class="btn chip ${value === v ? 'on' : ''}" data-a="${action}" data-v="${v}">${esc(text)}</button>`)
    .join('')}</div>`;
}

function screenSetup() {
  const t = T();
  const n = S.count;
  const inputs = Array.from({ length: n }, (_, i) => {
    const v = S.names[i] || '';
    return `<label class="name"><span>${SEAT_ICONS[i]} ${esc(t.seat(i + 1))}</span>
      <input data-name="${i}" maxlength="12" value="${esc(v)}" placeholder="${esc(t.namePh(i + 1))}" autocomplete="off"></label>`;
  }).join('');
  return `${header()}
  <main class="stack">
    <h2>${esc(t.newGame)}</h2>
    <div class="row between">
      <span>${esc(t.players)}</span>
      <div class="stepper">
        <button class="btn sq" data-a="count" data-v="-1" ${n <= L.MIN_PLAYERS ? 'disabled' : ''} aria-label="-1">−</button>
        <b aria-live="polite">${n}</b>
        <button class="btn sq" data-a="count" data-v="1" ${n >= L.PASS_AND_PLAY_MAX ? 'disabled' : ''} aria-label="+1">＋</button>
      </div>
    </div>
    <p class="muted small">${esc(t.maxNote(L.PASS_AND_PLAY_MAX))}</p>
    <p class="note">${esc(t.setupRoles(roleSummary(n)))}</p>
    <div class="names">${inputs}</div>
    <div class="row between"><span>${esc(t.discussion)}</span>${chips('minutes', String(S.minutes), [2, 3, 5].map((m) => [String(m), t.minutes(m)]))}</div>
    <div class="row between"><span>${esc(t.voice)}</span>${chips('voice', S.voice ? '1' : '0', [['1', t.on], ['0', t.off]])}</div>
    <div class="row between"><span>${esc(t.kidMode)}</span>${chips('kid', S.kid ? '1' : '0', [['1', t.on], ['0', t.off]])}</div>
    <p class="muted small">${esc(t.kidNote)}</p>
    <button class="btn primary" data-a="deal">${esc(t.start)}</button>
    <button class="btn" data-a="home">${esc(t.back)}</button>
  </main>`;
}

function handoff(seat, action) {
  const t = T();
  return `<main class="center stack handoff">
    <p class="muted">${esc(t.passTo())}</p>
    <div class="who">${SEAT_ICONS[seat]}<br>${esc(label(seat))}</div>
    <button class="btn primary big" data-a="${action}">${esc(t.iAm(nm(seat)))}</button>
  </main>`;
}

function partnersLine(seat) {
  const t = T();
  const others = L.wolfSeats(S.game).filter((s) => s !== seat);
  return others.length ? t.partners(list(others)) : t.noPartners;
}

function roleCard(seat) {
  const t = T();
  const role = S.game.players[seat].role;
  return `<div class="card">
    <div class="icon big">${ROLE_ICON[role]}</div>
    <h2>${esc(t.roleName[role])}</h2>
    <p class="muted">${esc(role === 'wolf' ? t.team.wolf : t.team.good)}</p>
    <p>${esc(W().desc[role])}</p>
    ${role === 'wolf' ? `<p class="secret">${esc(partnersLine(seat))}</p>` : ''}
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

function screenPass2Intro() {
  const t = T();
  return `${header()}
  <main class="center stack night">
    <div class="hero">🌙</div>
    <h2>${esc(t.pass2Title)}</h2>
    <p>${esc(t.pass2Intro)}</p>
    <button class="btn primary big" data-a="beginPass2">${esc(t.beginPass2)}</button>
  </main>`;
}

/** Grid of every seat; only `allowed` seats are tappable. */
function grid(allowed, action, selected) {
  const t = T();
  const g = S.game;
  return `<div class="grid">${g.players
    .map((p, i) => {
      const ok = allowed.includes(i);
      const sel = selected === i;
      return `<button class="tile ${sel ? 'sel' : ''}" data-a="${action}" data-v="${i}" ${ok ? '' : 'disabled'} aria-pressed="${sel}">
        <span class="icon">${p.alive ? SEAT_ICONS[i] : '💤'}</span><span class="seatno">${esc(t.seat(i + 1))}</span><span class="pname">${esc(p.name)}</span>
        ${p.alive ? '' : `<span class="tag">${esc(W().outTag)}</span>`}
      </button>`;
    })
    .join('')}</div>`;
}

function witchBody(seat) {
  const t = T();
  const w = W();
  const g = S.game;
  const v = L.witchView(g, seat);
  const u = S.ui;
  const parts = [];
  parts.push(`<p class="secret">${esc(v.victim !== null ? w.witchVictim(label(v.victim)) : w.witchNoSave)}</p>`);
  if (v.canSave) parts.push(`<button class="btn chip wide ${u.wsave ? 'on' : ''}" data-a="wSave">💊 ${esc(w.save(label(v.victim)))}</button>`);
  parts.push(`<button class="btn chip wide ${u.wchose && !u.wsave && u.wpoison == null ? 'on' : ''}" data-a="wNone">${esc(t.noPotion)}</button>`);
  if (v.canPoison) {
    parts.push(`<p class="muted">${S.kid ? "😴" : "☠️"} ${esc(w.poison)} · ${esc(w.pickPoison)}</p>`);
    parts.push(grid(v.poisonTargets, 'wPoison', u.wpoison));
  }
  return parts.join('');
}

function witchIdle(seat) {
  const v = L.witchView(S.game, seat);
  return !v.canSave && !v.canPoison;
}

function screenNight() {
  const t = T();
  const g = S.game;
  const { turn, step, pass } = S.ui;
  if (step === 'handoff') return header() + handoff(turn, 'nightIam');
  const role = g.players[turn].role;
  if (step === 'feedback') {
    const f = S.ui.feedback;
    const msg = f.task === 'seer' ? (f.isWolf ? t.seerYes(label(f.target)) : t.seerNo(label(f.target))) : t.noted;
    return `${header()}
    <main class="center stack night">
      <div class="icon big">${f.task === 'seer' ? (f.isWolf ? '🐺' : '🙂') : '✅'}</div>
      <p class="secret big-text">${esc(msg)}</p>
      <button class="btn primary big" data-a="nextTurn">${esc(t.coverNext)}</button>
    </main>`;
  }
  let task = pass === 1 ? L.task1(g, turn) : L.task2(g, turn);
  // A witch with no potions left picks a suspect like everyone else, so her turn looks the same.
  if (task === 'witch' && witchIdle(turn)) task = 'suspect';
  let title = task === 'wolf' ? W().wolfTask : t.task[task];
  let body = '';
  let ready = S.ui.pick !== undefined;
  if (task === 'witch') {
    body = witchBody(turn);
    ready = Boolean(S.ui.wchose);
  } else {
    const notes = [];
    if (task === 'wolf') {
      notes.push(partnersLine(turn));
      if (g.actions.wolf !== null) notes.push(W().proposal(label(g.actions.wolf)));
    }
    if (task === 'guard' && g.lastGuard !== null) notes.push(t.lastGuard(label(g.lastGuard)));
    if (task === 'suspect') notes.push(t.suspectNote);
    const allowed = pass === 1 ? L.targets1(g, turn) : L.aliveSeats(g).filter((s) => s !== turn);
    body = notes.map((n) => `<p class="secret">${esc(n)}</p>`).join('') + grid(allowed, 'pick', S.ui.pick);
  }
  return `${header()}
  <main class="stack night">
    <p class="muted center">${ROLE_ICON[role]} ${esc(t.roleName[role])} · ${esc(label(turn))}</p>
    <h2 class="center">${esc(title)}</h2>
    ${body}
    <button class="btn primary big" data-a="confirmPick" ${ready ? '' : 'disabled'}>${esc(t.confirm)}</button>
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

function morningText(r) {
  return r.deaths.length ? W().deaths(list(r.deaths)) : W().peaceful;
}

/** Where to go once the current public announcement is done. */
function afterButton(after) {
  const t = T();
  const g = S.game;
  if (g.pendingShot !== null) return `<button class="btn primary big" data-a="toShoot" data-v="${after}">${esc(t.continueDay)}</button>`;
  if (g.winner) return `<button class="btn primary big" data-a="end">${esc(t.seeResult)}</button>`;
  return after === 'day'
    ? `<button class="btn primary big" data-a="day">${esc(t.startDay)}</button>`
    : `<button class="btn primary big" data-a="nextNight">${esc(t.nextNight)}</button>`;
}

function screenMorning() {
  const t = T();
  const r = S.game.log[S.game.log.length - 1];
  return `${header()}
  <main class="center stack">
    <h2>${esc(t.morningTitle(r.night))}</h2>
    <p class="announce">${esc(morningText(r))}</p>
    ${tableLine()}
    ${afterButton('day')}
  </main>`;
}

function screenShoot() {
  const t = T();
  const g = S.game;
  const hunter = g.pendingShot;
  if (hunter === null || hunter === undefined) {
    // Shot resolved: announce it.
    const shot = S.ui.shot;
    return `${header()}
    <main class="center stack">
      <div class="hero">🏹</div>
      <p class="announce">${esc(shot === null ? W().hold : W().shot(label(shot)))}</p>
      ${tableLine()}
      ${afterButton(S.ui.after)}
    </main>`;
  }
  return `${header()}
  <main class="stack">
    <div class="hero center">🏹</div>
    <h2 class="center">${esc(W().hunterTitle(label(hunter)))}</h2>
    <p class="muted">${esc(t.shootPick)}</p>
    ${grid(L.aliveSeats(g).filter((s) => s !== hunter), 'pick', S.ui.pick)}
    <button class="btn primary big" data-a="doShoot" ${S.ui.pick === undefined ? 'disabled' : ''}>${esc(t.confirm)}</button>
    <button class="btn" data-a="holdFire">${esc(W().hold)}</button>
  </main>`;
}

function timeLeft() {
  const u = S.ui;
  return Math.max(0, u.running ? Math.ceil((u.endAt - Date.now()) / 1000) : u.left);
}

function screenDay() {
  const t = T();
  const left = timeLeft();
  return `${header()}
  <main class="center stack">
    <h2>${esc(t.dayTitle(S.game.night))}</h2>
    <div class="timer ${left === 0 ? 'done' : ''}">${left === 0 ? esc(t.timeUp) : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</div>
    ${left > 0 ? `<button class="btn" data-a="toggleTimer">${esc(S.ui.running ? t.pause : t.play)}</button>` : ''}
    ${tableLine()}
    <button class="btn primary big" data-a="vote">${esc(t.toVote)}</button>
  </main>`;
}

function screenVote() {
  const t = T();
  const c = S.ui.confirm;
  if (c !== undefined) {
    return `${header()}
    <main class="center stack">
      <div class="hero">${SEAT_ICONS[c]}</div>
      <h2>${esc(W().voteConfirm(label(c)))}</h2>
      <button class="btn primary big" data-a="doVote">${esc(t.yes)}</button>
      <button class="btn" data-a="cancelVote">${esc(t.cancel)}</button>
    </main>`;
  }
  return `${header()}
  <main class="stack">
    <h2 class="center">${esc(t.voteTitle)}</h2>
    <p>${esc(W().voteHow)}</p>
    ${grid(L.aliveSeats(S.game), 'votePick')}
    <button class="btn" data-a="noOne">${esc(W().noOne)}</button>
  </main>`;
}

function screenVoteResult() {
  const t = T();
  const seat = S.ui.voted;
  return `${header()}
  <main class="center stack">
    <div class="hero">${seat === null ? '🤝' : '💤'}</div>
    <p class="announce">${esc(seat === null ? W().nobody : W().voteOut(label(seat)))}</p>
    ${tableLine()}
    ${afterButton('night')}
  </main>`;
}

function winText() {
  const t = T();
  const g = S.game;
  return g.winner === 'good' ? `${t.winGood}${W().winGood}` : `${t.winWolf}${W().winWolf}`;
}

function screenEnd() {
  const t = T();
  const g = S.game;
  return `${header()}
  <main class="stack">
    <div class="hero center">${g.winner === 'good' ? '🎉🧑‍🌾🎉' : '🌕🐺🌕'}</div>
    <h2 class="center">${esc(winText())}</h2>
    <h3>${esc(t.allRoles)}</h3>
    <ul class="roles">${g.players
      .map(
        (p, i) => `<li class="${p.role === 'wolf' ? 'is-wolf' : ''}"><span class="icon">${ROLE_ICON[p.role]}</span>
        <div><b>${esc(label(i))}</b> · ${esc(t.roleName[p.role])}${p.alive ? '' : ` · ${esc(W().outTag)}`}</div></li>`,
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
  pass2Intro: screenPass2Intro,
  nightDone: screenNightDone,
  morning: screenMorning,
  shoot: screenShoot,
  day: screenDay,
  vote: screenVote,
  voteResult: screenVoteResult,
  end: screenEnd,
};

function render() {
  document.documentElement.lang = S.lang;
  document.title = T().title;
  root.innerHTML = (SCREENS[S.screen] || screenHome)();
  document.body.classList.toggle('is-night', ['nightIntro', 'night', 'pass2Intro'].includes(S.screen));
  clearInterval(tick);
  if (S.screen === 'day' && S.ui.running) tick = setInterval(onTick, 250);
  bindHold();
  // Ignore taps for a moment so a double tap cannot open the next player's private screen.
  lockUntil = Date.now() + 450;
  const main = root.querySelector('main');
  const key = `${S.screen}:${S.ui.pass ?? ''}:${S.ui.turn ?? ''}:${S.ui.step ?? ''}:${S.ui.confirm ?? ''}`;
  const moved = key !== lastKey;
  lastKey = key;
  if (main && moved) {
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
  if (left === 0) {
    clearInterval(tick);
    S.ui = { running: false, left: 0 };
    save();
    beep();
    speak(T().timeUp);
    render();
    return;
  }
  const el = root.querySelector('.timer');
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

function setting(fn) {
  return (el) => {
    readNames();
    fn(el.dataset.v);
    save();
    render();
  };
}

function newDeal(names) {
  S.game = L.newGame(names);
  S.paused = null;
  go('reveal', { turn: 0, step: 'handoff' });
}

function startTurn() {
  const g = S.game;
  const { pass, turn } = S.ui;
  if (passList(g, pass).includes(turn)) {
    // Resumed after a reload on this player's result: show it again.
    const isSeer = pass === 1 && L.task1(g, turn) === 'seer';
    const feedback = isSeer
      ? { task: 'seer', target: g.actions.seer, isWolf: g.players[g.actions.seer].role === 'wolf' }
      : { task: 'noted' };
    go('night', { pass, turn, step: 'feedback', feedback });
    return;
  }
  go('night', { pass, turn, step: 'act' });
}

function rerender(patch) {
  Object.assign(S.ui, patch);
  render();
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
  count: setting((v) => {
    S.count = Math.min(L.PASS_AND_PLAY_MAX, Math.max(L.MIN_PLAYERS, S.count + Number(v)));
  }),
  minutes: setting((v) => (S.minutes = Number(v))),
  voice: setting((v) => (S.voice = v === '1')),
  kid: setting((v) => (S.kid = v === '1')),
  deal: () => {
    readNames();
    newDeal(Array.from({ length: S.count }, (_, i) => S.names[i] || T().namePh(i + 1)));
  },
  again: () => newDeal(S.game.players.map((p) => p.name)),
  iam: () => go('reveal', { turn: S.ui.turn, step: 'show', seen: false }),
  seen: () => {
    const next = S.ui.turn + 1;
    if (next < S.game.n) go('reveal', { turn: next, step: 'handoff' });
    else go('nightIntro');
  },
  beginNight: () => {
    speak(T().nightSay(S.game.night));
    go('night', { pass: 1, turn: nextSeat(S.game, 1), step: 'handoff' });
  },
  beginPass2: () => go('night', { pass: 2, turn: nextSeat(S.game, 2), step: 'handoff' }),
  nightIam: startTurn,
  pick: (el) => rerender({ pick: Number(el.dataset.v) }),
  wSave: () => rerender({ wchose: true, wsave: true, wpoison: null }),
  wNone: () => rerender({ wchose: true, wsave: false, wpoison: null }),
  wPoison: (el) => rerender({ wchose: true, wsave: false, wpoison: Number(el.dataset.v) }),
  confirmPick: () => {
    const g = S.game;
    const { pass, turn } = S.ui;
    let feedback = { task: 'noted' };
    if (pass === 1) {
      if (S.ui.pick === undefined) return;
      const r = L.act1(g, turn, S.ui.pick);
      if (r.task === 'seer') feedback = { task: 'seer', target: S.ui.pick, isWolf: r.isWolf };
    } else if (L.task2(g, turn) === 'witch' && !witchIdle(turn)) {
      if (!S.ui.wchose) return;
      L.act2(g, turn, { save: Boolean(S.ui.wsave), poison: S.ui.wpoison ?? null });
    } else {
      if (S.ui.pick === undefined) return;
      L.act2(g, turn, { suspect: S.ui.pick });
    }
    go('night', { pass, turn, step: 'feedback', feedback });
  },
  nextTurn: () => {
    const g = S.game;
    const { pass, turn } = S.ui;
    const next = nextSeat(g, pass, turn);
    if (next !== undefined) go('night', { pass, turn: next, step: 'handoff' });
    else if (pass === 1) go('pass2Intro');
    else go('nightDone');
  },
  morning: () => {
    const r = L.resolveNight(S.game);
    speak(`${T().morningTitle(r.night)}。${morningText(r)}`);
    go('morning');
  },
  toShoot: (el) => {
    speak(W().hunterTitle(label(S.game.pendingShot)));
    go('shoot', { after: el.dataset.v });
  },
  doShoot: () => {
    if (S.ui.pick === undefined) return;
    const target = S.ui.pick;
    L.shoot(S.game, target);
    speak(W().shot(label(target)));
    go('shoot', { after: S.ui.after, shot: target });
  },
  holdFire: () => {
    L.shoot(S.game, null);
    go('shoot', { after: S.ui.after, shot: null });
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
  votePick: (el) => go('vote', { confirm: Number(el.dataset.v) }),
  cancelVote: () => go('vote'),
  noOne: () => {
    L.vote(S.game, null);
    speak(W().nobody);
    go('voteResult', { voted: null });
  },
  doVote: () => {
    const seat = S.ui.confirm;
    L.vote(S.game, seat);
    speak(W().voteOut(label(seat)));
    go('voteResult', { voted: seat });
  },
  nextNight: () => {
    L.nextNight(S.game);
    go('nightIntro');
  },
  end: () => {
    speak(winText());
    go('end');
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
