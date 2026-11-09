import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as L from '../src/logic.js';
import { STRINGS, SEAT_ICONS, ROLE_ICON } from '../src/i18n.js';

// Execute the real UI with a small DOM/storage/speech boundary, without a browser,
// network, build step or dependencies. Clicks go through its delegated tap lock.
const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, c) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[c]);
const attributes = (s) => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));

function mount(saved = null, query = '') {
  let stored = saved ? JSON.stringify(saved) : null;
  let now = 1000;
  let html = '';
  let buttons = [];
  let inputs = [];
  let hold = null;
  let focuses = 0;
  const spoken = [];
  const listeners = {};
  const bodyClasses = new Set();
  const main = { focus: () => focuses++ };
  const root = {
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value;
      buttons = [...html.matchAll(/<button\b([^>]*)>/g)].map((m) => {
        const a = attributes(m[1]);
        return { dataset: { a: a['data-a'], v: a['data-v'] }, disabled: /\bdisabled\b/.test(m[1]) };
      });
      inputs = [...html.matchAll(/<input\b([^>]*)>/g)].map((m) => {
        const a = attributes(m[1]);
        return { dataset: { name: a['data-name'] }, value: a.value || '' };
      });
      const events = {};
      const cover = { hidden: false };
      const face = { hidden: true };
      hold = html.includes('data-hold') ? {
        cover, face, events,
        querySelector: (s) => s === '.hold-cover' ? cover : face,
        setAttribute: () => {},
        addEventListener: (name, fn) => { events[name] = fn; },
      } : null;
    },
    addEventListener: (name, fn) => { listeners[name] = fn; },
    querySelector: (s) => {
      if (s === 'main') return main;
      if (s === '[data-hold]') return hold;
      const action = s.match(/^\[data-a="(.*)"\]$/)?.[1];
      return action ? buttons.find((b) => b.dataset.a === action) : null;
    },
    querySelectorAll: () => inputs,
  };
  const context = {
    L, STRINGS, SEAT_ICONS, ROLE_ICON, URLSearchParams,
    document: {
      getElementById: () => root,
      documentElement: {},
      body: { classList: { toggle: (name, on) => on ? bodyClasses.add(name) : bodyClasses.delete(name) } },
    },
    location: { search: query },
    navigator: { language: 'en' },
    localStorage: { getItem: () => stored, setItem: (_, value) => { stored = value; } },
    window: {
      scrollTo: () => {},
      addEventListener: () => {},
      speechSynthesis: { getVoices: () => [], cancel: () => {}, speak: (u) => spoken.push(u.text) },
    },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    Date: class extends Date { static now() { return now; } },
    setInterval: () => 1,
    clearInterval: () => {},
    confirm: () => true,
  };
  const state = vm.runInNewContext(`${source}\n(() => S)`, context);
  return {
    state: () => JSON.parse(JSON.stringify(state())),
    saved: () => JSON.parse(stored),
    html: () => html,
    spoken,
    bodyClasses,
    focuses: () => focuses,
    click(action, value, advance = 500) {
      now += advance;
      const b = buttons.find((el) => el.dataset.a === action && (value === undefined || el.dataset.v === String(value)));
      assert.ok(b, `missing button ${action} ${value ?? ''}`);
      listeners.click({ target: { closest: () => b } });
    },
    hold(event) {
      assert.ok(hold, 'missing hold-to-reveal card');
      hold.events[event]({ preventDefault() {} });
      return { covered: !hold.cover.hidden, revealed: !hold.face.hidden };
    },
    hasButton: (action, enabled = true) => buttons.some((b) => b.dataset.a === action && (!enabled || !b.disabled)),
  };
}

const names = (n) => Array.from({ length: n }, (_, i) => `P${i + 1}`);
function game(n = 10) {
  const g = L.newGame(names(n), () => 0.999);
  // Identity shuffle: wolves first, then seer, witch, hunter, guard, villagers.
  return g;
}
function saved(g, host = 'human', screen = 'hostNight', ui = { step: 'close' }) {
  return { lang: 'en', voice: true, kid: false, host, minutes: 3, count: g.n, names: names(g.n), game: g, screen, ui, paused: null };
}
function resume(g, ui = { step: 'close' }, options = {}) {
  const app = mount({ ...saved(g, 'human', 'hostNight', ui), ...options });
  assert.equal(app.state().screen, 'home');
  app.click('resume');
  return app;
}

const TEN_SEER = 3;
const TEN_WITCH = 4;
const TEN_GUARD = 6;

test('setup defaults old saves to App, clamps host limits, and explains small games', () => {
  const old = saved(game(16), 'app', 'home', {});
  delete old.host;
  old.game = null;
  const app = mount(old);
  assert.equal(app.state().host, 'app');
  assert.equal(app.state().count, 12);
  app.click('setup');
  assert.equal(app.hasButton('count', true), true);
  app.click('host', 'human');
  for (let i = 0; i < 4; i++) app.click('count', 1);
  assert.equal(app.state().count, 16);
  app.click('count', 1);
  assert.equal(app.state().count, 16);
  app.click('host', 'app');
  assert.equal(app.state().count, 12);
  for (let i = 0; i < 9; i++) app.click('count', -1);
  assert.equal(app.state().count, 3);
  assert.match(app.html(), /Small game:/);
  app.click('count', -1);
  assert.equal(app.state().count, 3);
  app.click('deal');
  assert.equal(app.state().screen, 'reveal');
});

test('human reveal offers phone passing first and a host-only complete role table', () => {
  const app = mount({ ...saved(game(4), 'human', 'home', {}), game: null });
  app.click('setup');
  app.click('deal');
  assert.equal(app.state().screen, 'revealChoice');
  assert.ok(app.html().indexOf('data-a="revealPass"') < app.html().indexOf('data-a="hostOverview"'));
  app.click('hostOverview');
  assert.equal((app.html().match(/<li>/g) || []).length, 4);
  for (const p of app.state().game.players) assert.ok(app.html().includes(ROLE_ICON[p.role]));
  app.click('hostStart');
  assert.equal(app.state().ui.step, 'close');
  assert.ok(app.bodyClasses.has('is-night'));
  assert.match(app.spoken.at(-1), /close your eyes/);
});

test('human host can use the existing hold-to-reveal round before the script', () => {
  const app = mount(saved(game(3), 'human', 'revealChoice', {}));
  app.click('resume');
  app.click('revealPass');
  for (let i = 0; i < 3; i++) {
    app.click('iam');
    assert.deepEqual(app.hold('pointerdown'), { covered: false, revealed: true });
    assert.deepEqual(app.hold('pointerup'), { covered: true, revealed: false });
    app.click('seen');
  }
  assert.equal(app.state().screen, 'hostNight');
  assert.equal(app.state().ui.step, 'close');
});

for (const n of [3, 4]) {
  test(`human ${n}-player script skips absent roles and has a peaceful first night`, () => {
    let app = resume(game(n));
    app.click('hostNext');
    assert.equal(app.state().ui.step, 'wolf');
    assert.equal(app.hasButton('hostPick'), false);
    assert.match(app.spoken.at(-1), /Werewolves, close your eyes\./);
    assert.doesNotMatch(app.spoken.at(-1), /No action on night one/);
    assert.match(app.html(), /<p class="muted small">\(No action on night one\.\)<\/p>/);
    assert.doesNotMatch(app.html(), /Closing line:/);
    app.click('hostNext');
    assert.equal(app.state().ui.step, 'seer');
    app.click('hostPick', 0);
    assert.match(app.html(), /👎 Werewolf/);
    assert.equal(app.spoken.some((line) => line.includes('👎')), false);
    assert.equal(app.state().game.actions.seer, null);
    // The preview survives reload and the host can still correct a mis-tap.
    app = mount(app.saved());
    app.click('resume');
    assert.equal(app.state().ui.step, 'seer');
    assert.match(app.html(), /👎 Werewolf/);
    assert.equal(app.hasButton('hostPick'), true);
    app.click('hostPick', n - 1);
    assert.match(app.html(), /👍 Village/);
    assert.equal(app.state().game.actions.seer, null);
    app.click('hostNext');
    assert.equal(app.state().game.actions.seer, n - 1);
    if (n === 4) {
      assert.equal(app.state().ui.step, 'witch');
      assert.match(app.html(), /Tonight is peaceful/);
      assert.equal(app.hasButton('hostPoison'), false);
      assert.equal(app.hasButton('wSave'), false);
      app.click('hostNext');
    }
    assert.equal(app.state().ui.step, 'dawn');
    app.click('hostNext');
    assert.equal(app.state().screen, 'morning');
    assert.deepEqual(app.state().game.log[0].deaths, []);
    assert.deepEqual(app.state().game.potions, { save: true, poison: true });
    app.click('day');
    app.click('vote');
    app.click('votePick', 0);
    app.click('doVote');
    assert.equal(app.state().game.winner, 'good');
  });
}

for (const [role, actor, first, second, next] of [
  ['guard', TEN_GUARD, 8, 9, 'wolf'],
  ['wolf', 0, 7, 8, 'seer'],
  ['seer', TEN_SEER, 0, 7, 'witch'],
]) {
  test(`host ${role} picks remain editable across reload and commit only on Next step`, () => {
    let app = resume(game(), { step: role });
    const before = app.state().game.actions;
    assert.equal(app.hasButton('hostNext'), false);
    app.click('hostNext'); // disabled until a target is selected
    assert.equal(app.state().ui.step, role);
    app.click('hostPick', first);
    assert.equal(app.state().ui.pick, first);
    assert.deepEqual(app.state().game.actions, before);
    if (role === 'seer') assert.match(app.html(), /👎 Werewolf/);
    app.click('hostPick', first); // tapping again does not commit or clear it
    app.click('hostPick', second);
    assert.equal(app.state().ui.pick, second);
    assert.deepEqual(app.state().game.actions, before);
    if (role === 'seer') assert.match(app.html(), /👍 Village/);

    app = mount(app.saved());
    app.click('resume');
    assert.equal(app.state().ui.pick, second);
    assert.equal(app.hasButton('hostPick'), true);
    assert.deepEqual(app.state().game.actions, before);
    if (role === 'seer') assert.match(app.html(), /👍 Village/);
    app.click('hostPick', first);
    assert.deepEqual(app.state().game.actions, before);
    if (role === 'seer') assert.match(app.html(), /👎 Werewolf/);
    assert.equal(app.spoken.some((line) => /👎|👍/.test(line)), false);
    app.click('hostNext');
    const committed = app.state().game.actions;
    assert.equal(committed[role], first);
    assert.equal(committed.pass1.filter((s) => s === actor).length, 1);
    assert.equal(app.state().ui.step, next);
    app = mount(app.saved());
    app.click('resume');
    assert.equal(app.state().ui.step, next);
    assert.deepEqual(app.state().game.actions, committed);
  });
}

test('a previously committed host seer check resumes without applying it twice', () => {
  const g = game();
  L.act1(g, TEN_SEER, 0);
  let app = resume(g, { step: 'seer', pick: 0 });
  assert.match(app.html(), /👎 Werewolf/);
  assert.equal(app.hasButton('hostPick'), false);
  app = mount(app.saved());
  app.click('resume');
  assert.match(app.html(), /👎 Werewolf/);
  app.click('hostNext'); // act1 would throw if the check were applied again
  assert.equal(app.state().ui.step, 'witch');
  assert.equal(app.state().game.actions.seer, 0);
  assert.equal(app.state().game.actions.pass1.filter((s) => s === TEN_SEER).length, 1);
});

test('human full script enforces targets, gestures seer truth and saves with no night hand-offs', () => {
  let app = resume(game());
  app.click('hostNext');
  assert.equal(app.state().ui.step, 'guard');
  app.click('hostPick', 8);
  // A selected target survives a reload before it is committed.
  app = mount(app.saved());
  app.click('resume');
  assert.equal(app.state().ui.pick, 8);
  assert.ok(app.hasButton('hostNext'));
  app.click('hostNext');
  assert.equal(app.state().ui.step, 'wolf');
  app.click('hostPick', 1); // disabled: wolves cannot target wolves
  assert.equal(app.state().ui.pick, undefined);
  app.click('hostPick', 7);
  app.click('hostNext');
  assert.equal(app.state().ui.step, 'seer');
  app.click('hostPick', TEN_SEER); // disabled: no self check
  assert.equal(app.state().game.actions.seer, null);
  app.click('hostPick', 0);
  assert.match(app.html(), /👎 Werewolf/);
  app.click('hostNext');
  assert.equal(app.state().ui.step, 'witch');
  assert.equal(app.state().game.actions.wolf, 7);
  assert.match(app.html(), /#8 P8/);
  app.click('wSave');
  app = mount(app.saved());
  app.click('resume');
  assert.equal(app.state().ui.wsave, true);
  app.click('hostNext');
  app.click('hostNext');
  assert.deepEqual(app.state().game.log[0].deaths, []);
  assert.equal(app.state().game.potions.save, false);
  assert.equal(app.spoken.some((line) => /Pass the phone/.test(line)), false);
  assert.ok(app.focuses() > 0);
  app.click('day');
  app.click('vote');
  app.click('noOne');
  app.click('nextNight');
  assert.equal(app.state().ui.step, 'close');
  app.click('hostNext');
  app.click('hostPick', 8); // cannot guard the same seat on consecutive nights
  assert.equal(app.state().ui.pick, undefined);
});

test('host witch poison uses a grid, cannot target self and applies one potion', () => {
  const g = game();
  L.act1(g, 0, TEN_WITCH); // no self-save
  L.fillPass(g, 1);
  const app = resume(g, { step: 'witch' });
  assert.equal(app.hasButton('wSave'), false);
  assert.equal(app.hasButton('wPoison'), false);
  app.click('hostPoison');
  app.click('wPoison', TEN_WITCH);
  assert.equal(app.state().ui.wpoison, null);
  app.click('wPoison', 0);
  app.click('hostNext');
  app.click('hostNext');
  assert.deepEqual(app.state().game.log[0].deaths, [0, TEN_WITCH]);
  assert.deepEqual(app.state().game.potions, { save: true, poison: false });
});

test('host witch does not see the victim after using the save potion', () => {
  const g = game();
  g.potions.save = false;
  L.act1(g, 0, 8);
  L.fillPass(g, 1);
  const app = resume(g, { step: 'witch' });
  assert.match(app.html(), /healing potion is used up/);
  assert.doesNotMatch(app.html(), /attacked #9 P9/);
  assert.equal(app.hasButton('wSave'), false);
});

test('human host reuses hunter and end screens, and voice-off stays silent', () => {
  const g = game();
  const hunter = L.seatOf(g, 'hunter');
  g.players[hunter].alive = false;
  g.pendingShot = hunter;
  g.log.push({ night: 1, deaths: [hunter], shot: null });
  const app = mount({ ...saved(g, 'human', 'morning', {}), voice: false });
  app.click('resume');
  app.click('toShoot');
  app.click('pick', 0);
  app.click('doShoot');
  assert.equal(app.state().game.players[0].alive, false);
  assert.equal(app.state().screen, 'shoot');
  assert.deepEqual(app.spoken, []);

  const ended = game(3);
  ended.players[0].alive = false;
  ended.winner = 'good';
  const result = mount(saved(ended, 'human', 'end', {}));
  assert.equal(result.state().screen, 'end');
  result.click('again');
  assert.equal(result.state().screen, 'revealChoice');
});

test('resuming a game restores its host after changing setup preferences', () => {
  const app = mount(saved(game(12), 'app', 'nightIntro', {}));
  app.click('setup');
  app.click('host', 'human');
  for (let i = 0; i < 4; i++) app.click('count', 1);
  app.click('home');
  app.click('resume');
  assert.equal(app.state().host, 'app');
  assert.equal(app.state().count, 12);
  assert.equal(app.state().screen, 'nightIntro');
});

test('departed roles keep their script pauses, with family wording and no action grid', () => {
  const g = game();
  g.players[TEN_GUARD].alive = false;
  g.players[TEN_SEER].alive = false;
  g.players[TEN_WITCH].alive = false;
  const app = resume(g, { step: 'close' }, { lang: 'zh-TW', kid: true });
  app.click('hostNext');
  assert.equal(app.state().ui.step, 'guard');
  assert.match(app.html(), /這個角色已回家睡覺/);
  assert.doesNotMatch(app.html().split('<main')[1], /出局|殺|死/);
  assert.equal(app.hasButton('hostPick'), false);
  app.click('hostNext');
  app.click('hostPick', 8);
  app.click('hostNext');
  assert.equal(app.state().ui.step, 'seer');
  assert.equal(app.hasButton('hostPick'), false);
  app.click('hostNext');
  assert.equal(app.state().ui.step, 'witch');
  assert.equal(app.hasButton('hostPoison'), false);
  app.click('hostNext');
  app.click('hostNext');
  assert.deepEqual(app.state().game.log[0].deaths, [8]);
});

test('app small-game nights keep two uniform passes, with a suspect grid for the witch', () => {
  const app = mount(saved(game(4), 'app', 'nightIntro', {}));
  app.click('resume');
  app.click('beginNight');
  for (let pass = 1; pass <= 2; pass++) {
    for (let seat = 0; seat < 4; seat++) {
      assert.equal(app.state().ui.step, 'handoff');
      app.click('nightIam');
      if (pass === 1 && seat === 0) assert.match(app.html(), /Night 1 is quiet: werewolves do not choose a target/);
      if (pass === 2 && seat === 2) {
        assert.match(app.html(), /Pick someone who seems suspicious/);
        assert.equal(app.hasButton('wPoison'), false);
      }
      app.click('pick', seat === 0 ? 1 : 0);
      app.click('confirmPick');
      assert.equal(app.state().ui.step, 'feedback');
      app.click('nextTurn');
    }
    if (pass === 1) app.click('beginPass2');
  }
  assert.equal(app.state().screen, 'nightDone');
  app.click('morning');
  assert.deepEqual(app.state().game.log[0].deaths, []);
});

test('app tap lock, hold cover and reload-to-hand-off privacy stay intact', () => {
  let app = mount(saved(game(5), 'app', 'reveal', { turn: 1, step: 'show', seen: true }));
  app.click('resume');
  assert.equal(app.state().ui.step, 'handoff');
  app.click('iam', undefined, 0); // double tap is ignored
  assert.equal(app.state().ui.step, 'handoff');
  app.click('iam');
  assert.equal(app.hasButton('seen'), false);
  assert.deepEqual(app.hold('pointerdown'), { covered: false, revealed: true });
  assert.deepEqual(app.hold('blur'), { covered: true, revealed: false });
  app.click('seen');
  assert.equal(app.state().ui.turn, 2);

  const g = game(5);
  const seer = L.seatOf(g, 'seer');
  L.act1(g, seer, 0);
  app = mount(saved(g, 'app', 'night', { pass: 1, turn: seer, step: 'feedback' }));
  app.click('resume');
  assert.equal(app.state().ui.step, 'handoff');
  assert.doesNotMatch(app.html(), /is a werewolf!/);
  app.click('nightIam');
  assert.match(app.html(), /is a werewolf!/);
  assert.equal(app.state().game.actions.pass1.filter((s) => s === seer).length, 1);
});

test('new host strings exist in both languages and family scripts avoid harsh wording', () => {
  assert.deepEqual(Object.keys(STRINGS['zh-TW']).sort(), Object.keys(STRINGS.en).sort());
  for (const lang of ['zh-TW', 'en']) {
    const t = STRINGS[lang];
    assert.deepEqual(Object.keys(t.words.classic).sort(), Object.keys(t.words.kid).sort());
    assert.ok(t.rulesBody.some((line) => line.includes('3–4')));
    assert.ok(t.rulesBodyKid.some((line) => line.includes('3–4')));
  }
  for (const key of ['smallGame', 'quietWolfTask', 'hostQuietWolf', 'hostWolf', 'hostWitch', 'hostInactive']) {
    assert.doesNotMatch(STRINGS['zh-TW'].words.kid[key], /殺|出局|死/);
    assert.doesNotMatch(STRINGS.en.words.kid[key], /kill|eliminat|\bout\b|poison/i);
  }
});
