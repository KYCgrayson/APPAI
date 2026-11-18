import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, startLocal } from '../src/controller.js';
import { applyMove } from '../src/logic.js';
import { RoomsClient } from '../src/rooms.js';
import { LOCALES, STRINGS, translate } from '../src/i18n.js';
import { appHarness, waitingServer } from './app-harness.mjs';

function roomSetup() { const state = initialState(); state.settings.mode = 'room'; return state; }
function localGame({ mode = 'local', humanSeat = 0, theme = 'dark', moves = [] } = {}) {
  const state = initialState();
  Object.assign(state.settings, { mode, humanSeat, theme });
  const playing = startLocal(state);
  for (const index of moves) playing.game = applyMove(playing.game, playing.game.turn, { index });
  playing.screen = playing.game.winner === null ? 'play' : 'end';
  return playing;
}
const blackWin = [0, 210, 1, 212, 2, 214, 3, 216, 4];
const whiteWin = [210, 0, 212, 1, 214, 2, 216, 3, 224, 4];

test('all editable inputs preserve the DOM on input and blur/change', () => {
  const app = appHarness({ state: roomSetup() });
  assert.deepEqual(app.inputs.map((input) => input.id), ['room-code']);
  const input = app.typeCode('ABC234'), join = app.action('join'), before = app.renders;
  app.fire('change', input);
  assert.equal(app.renders, before, 'blur must not remove a pending click target');
  assert.ok(join.isConnected);
  assert.equal(app.document.activeElement, input);
  app.fire('change', { tagName: 'INPUT', id: 'future-input', dataset: {} });
  app.fire('change', { tagName: 'SELECT', id: 'unrecognized-select', dataset: {} });
  assert.equal(app.renders, before, 'unhandled inputs must not trigger rendering');
});

for (const activation of ['tapJoin', 'enterCode']) test(`room ${activation}: a single activation joins after typing`, async () => {
  const server = await waitingServer();
  const app = appHarness({ state: roomSetup(), server });
  assert.match(app.root.innerHTML, /<form id="join-room"[^>]*novalidate>/);
  assert.equal(app.action('join').type, 'submit');
  app.typeCode('ab c-234');
  app[activation]();
  await app.flush();
  assert.equal(server.requests.filter((r) => r.url.endsWith('/ABC234/join')).length, 1);
  assert.equal(app.saved().screen, 'play');
  assert.equal(app.saved().roomCode, 'ABC234');
  assert.match(app.root.innerHTML, /<code>ABC234<\/code>/);
  assert.match(app.root.innerHTML, /You are White <span class="player-stone white" aria-hidden="true"><\/span>/);
});

for (const lang of LOCALES) {
  test(`${lang}: click and Enter show translated validation without a request`, async () => {
    for (const activation of ['tapJoin', 'enterCode']) {
      for (const code of ['', 'ABC', 'IIIIII']) {
        const app = appHarness({ state: roomSetup(), lang });
        app.typeCode(code); app[activation](); await app.flush();
        assert.equal(app.server.requests.length, 0);
        assert.equal(app.announcer.textContent, STRINGS[lang].invalidCode);
        assert.match(app.root.innerHTML, /role="alert"/);
        if (activation === 'enterCode') assert.equal(app.document.activeElement.id, 'room-code');
      }
    }
  });

  test(`${lang}: player icons appear in turns, badges and a single result heading`, () => {
    for (const theme of ['light', 'dark']) {
      for (const seat of [0, 1]) {
        const color = seat === 0 ? 'black' : 'white';
        const app = appHarness({ lang, state: localGame({ theme, moves: seat === 0 ? [] : [112] }) });
        assert.match(app.root.innerHTML, new RegExp(`<h2>[^<]*<span class="player-stone ${color}" aria-hidden="true"></span>`));
        const badge = appHarness({ lang, state: localGame({ mode: 'computer', theme, humanSeat: seat }) });
        assert.match(badge.root.innerHTML, new RegExp(`<span class="badge">[^<]*<span class="player-stone ${color}"`));
        const ended = appHarness({ lang, state: localGame({ theme, moves: seat === 0 ? blackWin : whiteWin }) });
        const headings = [...ended.root.innerHTML.matchAll(/<h2\b[^>]*>(.*?)<\/h2>/g)].map((m) => m[1]);
        assert.equal(headings.length, 1);
        assert.match(ended.root.innerHTML, /class="panel result" aria-labelledby="result-heading"><h2 id="result-heading">/);
        assert.doesNotMatch(ended.root.innerHTML.match(/<section class="turn-card">(.*?)<\/section>/s)[1], /<h2/);
        for (const heading of headings) {
          assert.match(heading, new RegExp(`class="player-stone ${color}"`));
          assert.doesNotMatch(heading, /[●○]/);
        }
      }
    }
  });

  test(`${lang}: computer opening announces H8 and the next turn`, () => {
    const app = appHarness({ lang, state: localGame({ mode: 'computer', humanSeat: 1 }) });
    assert.equal(app.announcer.textContent, STRINGS[lang].thinking);
    app.runComputer();
    assert.equal(app.saved().game.moves[0][0], 112);
    assert.equal(app.announcer.textContent,
      `${translate(lang, 'computerPlayed', { coordinate: 'H8' })} ${translate(lang, 'turn', { player: STRINGS[lang].white })}`);
  });
}

test('recognized settings still render and persist their changes', () => {
  const app = appHarness();
  for (const [id, value] of [['size', 9], ['difficulty', 'hard'], ['side', 1], ['theme', 'dark'], ['mode', 'room']]) {
    const before = app.renders;
    app.change(id, value);
    assert.equal(app.renders, before + 1, id);
    const key = id === 'side' ? 'humanSeat' : id;
    assert.equal(app.saved().settings[key], value);
  }
  app.change('language', 'de');
  assert.equal(app.document.documentElement.lang, 'de');
  assert.equal(app.document.title, STRINGS.de.title);
});

test('end screens retain the board and only one set of rematch/home controls', () => {
  for (const moves of [blackWin, whiteWin]) {
    const app = appHarness({ state: localGame({ moves }) });
    assert.equal((app.root.innerHTML.match(/data-action="again"/g) ?? []).length, 1);
    assert.equal((app.root.innerHTML.match(/data-action="home"/g) ?? []).length, 1);
    assert.equal((app.root.innerHTML.match(/data-action="undo"/g) ?? []).length, 1);
    assert.match(app.root.innerHTML, /role="grid"/);
    assert.ok(app.action('zoom'));
  }
});

test('rendered stone counts follow placements, undo and language changes', () => {
  const app = appHarness({ state: localGame() });
  assert.match(app.root.innerHTML, /<p>0 stones placed<\/p>/);
  app.fire('click', app.root.querySelector('[data-index="112"]'));
  app.fire('click', app.action('place'));
  assert.match(app.root.innerHTML, /<p>1 stone placed<\/p>/);
  app.change('language', 'es');
  assert.match(app.root.innerHTML, /<p>1 ficha colocada<\/p>/);
  app.fire('click', app.root.querySelector('[data-index="113"]'));
  app.fire('click', app.action('place'));
  assert.match(app.root.innerHTML, /<p>2 fichas colocadas<\/p>/);
  app.fire('click', app.action('undo'));
  assert.match(app.root.innerHTML, /<p>1 ficha colocada<\/p>/);
});

test('a finished room offers home once, zoom and new-room guidance', async () => {
  const server = await waitingServer();
  const app = appHarness({ state: roomSetup(), server });
  app.typeCode('ABC234'); app.tapJoin(); await app.flush();
  const client = new RoomsClient({ fetcher: server.fetch });
  let game = app.saved().game;
  for (const index of blackWin) {
    const seat = game.turn;
    game = applyMove(game, seat, { index });
    await client.move('ABC234', server.tokens[seat], { version: server.room.version, move: { index },
      state: { ...game, revision: server.room.version + 1 }, nextTurn: game.turn, end: game.winner !== null });
  }
  app.poll(); await app.flush();
  assert.equal(app.saved().screen, 'end');
  assert.equal((app.root.innerHTML.match(/data-action="home"/g) ?? []).length, 1);
  assert.equal(app.action('again'), undefined);
  assert.equal(app.action('place'), undefined);
  assert.equal(app.action('undo'), undefined);
  assert.ok(app.action('zoom'));
  assert.ok(app.root.innerHTML.includes(STRINGS.en.roomEnd));
});

test('a computer winning move announces its coordinate together with the result', () => {
  const app = appHarness({ state: localGame({ mode: 'computer', humanSeat: 1, moves: blackWin.slice(0, -1) }) });
  app.runComputer();
  assert.equal(app.saved().screen, 'end');
  assert.equal(app.announcer.textContent, 'Computer played E1. Black ● wins!');
});
