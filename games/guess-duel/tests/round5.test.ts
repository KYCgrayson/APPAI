import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyGuess, applyReply, applySkip, other } from '../src/logic/game.ts';
import { OnlineSession } from '../src/net/online.ts';
import { RoomError, RoomsClient, type Room } from '../src/net/rooms.ts';
import { selectOpponentHistory } from '../src/ui/input.ts';
import { historiesScreen } from '../src/ui/screens.ts';
import { strings } from '../src/ui/i18n.ts';
import { esc } from '../src/ui/html.ts';
import { loadApp, until } from './helpers/app.ts';
import { playing, room, server } from './helpers/rooms.ts';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

test('history selection follows opponent guesses and auto-replies for either seat', () => {
  for (const seat of [0, 1] as const) {
    const before = { ...playing(), first: other(seat), turn: other(seat) };
    const pending = applyGuess(before, other(seat), '132');
    const answered = applyReply(pending, seat, '1A2B');
    const copy = structuredClone(before);
    assert.equal(selectOpponentHistory(before, pending, seat, false), true);
    assert.equal(selectOpponentHistory(pending, answered, seat, false), true);
    assert.equal(selectOpponentHistory(before, answered, seat, false), true);
    assert.deepEqual(before, copy, 'selection does not mutate game state');
  }
});

test('manual history choice survives typing, polls and own pending guess until a new reply', () => {
  for (const seat of [0, 1] as const) {
    const before = { ...playing(), first: seat, turn: seat };
    const pending = applyGuess(before, seat, '456');
    const answered = applyReply(pending, other(seat), '0A0B');
    for (const selected of [false, true]) {
      assert.equal(
        selectOpponentHistory(before, structuredClone(before), seat, selected),
        selected,
      );
      assert.equal(selectOpponentHistory(before, pending, seat, selected), selected);
      assert.equal(selectOpponentHistory(pending, answered, seat, selected), false);
      assert.equal(
        selectOpponentHistory(answered, structuredClone(answered), seat, selected),
        selected,
      );
    }
  }
});

test('batched history events select the latest list, including relay loads and seat changes', () => {
  for (const seat of [0, 1] as const) {
    const before = { ...playing(), first: seat, turn: seat };
    const own = applyReply(applyGuess(before, seat, '456'), other(seat), '0A0B');
    const opponent = applyReply(applyGuess(own, other(seat), '132'), seat, '1A2B');
    assert.equal(selectOpponentHistory(before, opponent, seat, false), true);
    assert.equal(selectOpponentHistory(undefined, opponent, seat, false), true);
    const latest = applyReply(applyGuess(opponent, seat, '789'), other(seat), '0A0B');
    assert.equal(selectOpponentHistory(before, latest, seat, true), false);
    assert.equal(selectOpponentHistory(undefined, latest, seat, true), false);
    assert.equal(
      selectOpponentHistory({ ...latest, id: 'previous-game' }, opponent, seat, false),
      true,
    );
  }
});

test('history segments name the opponent, count each list, explain emptiness and show newest first', () => {
  for (const t of [strings.en, strings['zh-TW']]) {
    let game = playing();
    const empty = historiesScreen(game, 1, false, t);
    assert.ok(empty.includes(t.noGuesses));
    assert.match(empty, /data-action="ownHistory" aria-pressed="true"/);
    assert.match(empty, /data-action="opponentHistory" aria-pressed="false"/);
    assert.ok(empty.includes(esc(t.opponentHistory.replace('{name}', 'Host'))));
    assert.equal((empty.match(/<span>\(0\)<\/span>/g) ?? []).length, 2);
    game = applyReply(applyGuess(game, 0, '132'), 1, '1A2B');
    game = applyReply(applyGuess(game, 1, '456'), 0, '0A0B');
    game = applyReply(applyGuess(game, 0, '789'), 1, '0A0B');
    const html = historiesScreen(game, 1, true, t);
    assert.match(html, /data-action="opponentHistory" aria-pressed="true"/);
    assert.equal((html.match(/<span>\(2\)<\/span>/g) ?? []).length, 1);
    const selected = html.split('history history-selected')[1];
    assert.ok(selected.indexOf('>7</span>') < selected.indexOf('>1</span>'));
    const escaped = historiesScreen({ ...game, names: ['<Host>', 'Guest'] }, 1, true, t);
    assert.ok(!escaped.includes('<Host>'));
    assert.ok(escaped.includes('&lt;Host&gt;'));
  }
});

test('same-device handover selects the opponent history and a new own reply selects mine', async (t) => {
  const view = loadApp(async () => assert.fail('local play must not fetch'));
  t.after(view.stop);
  await view.act({ type: 'mode', mode: 'same' });
  await view.act({ type: 'handover' });
  await view.act({ type: 'setSecret', code: '987' });
  await view.act({ type: 'handover' });
  await view.act({ type: 'setSecret', code: '123' });
  await view.act({ type: 'handover' });
  await view.act({ type: 'guess', code: '132' });
  view.click('nextPlayer');
  assert.equal(view.app.screen, 'handover');
  assert.ok(!view.html.includes('1A2B'), 'history stays private during handover');
  await view.act({ type: 'handover' });
  assert.equal(view.app.showOpponent, true);
  assert.ok(view.html.includes('1A2B'));
  view.pointerAction('ownHistory');
  view.pointerDigit('4');
  assert.equal(view.app.showOpponent, false, 'typing preserves manual choice');
  view.pointerAction('opponentHistory');
  await view.act({ type: 'guess', code: '456' });
  assert.equal(view.app.showOpponent, false, 'my new reply selects my list');
});

async function onlineGuest(t: { after: (fn: () => void) => void }) {
  const s = server();
  const guest = loadApp(s.fetcher(1), 'https://appai.info/games/guess-duel/?room=ABC234');
  t.after(guest.stop);
  await until(() => guest.app.screen === 'secret');
  const host = new OnlineSession(
    new RoomsClient(undefined, s.fetcher(0)),
    'ABC234',
    'token0',
    0,
    s.snapshot(),
    () => {},
    assert.fail,
  );
  await host.send({ t: 'commit', h: 'a'.repeat(64) });
  await guest.app.session.poll();
  await guest.act({ type: 'setSecret', code: '123' });
  await host.poll();
  await host.send({ t: 'guess', g: '132' });
  await guest.app.session.poll();
  await until(() => Boolean(guest.app.game.history[0][0]?.r));
  await host.poll();
  return { guest, host, s };
}

test('online guest sees 132 / 1A2B without tapping and returns to its own new reply', async (t) => {
  const { guest, host } = await onlineGuest(t);
  assert.equal(guest.app.showOpponent, true);
  assert.match(guest.html, /data-history-seat="0" class="history history-selected"/);
  guest.pointerAction('ownHistory');
  await guest.app.session.poll();
  assert.equal(guest.app.showOpponent, false);
  guest.pointerAction('opponentHistory');
  await guest.act({ type: 'guess', code: '456' });
  assert.equal(guest.app.showOpponent, true, 'pending own guess keeps manual selection');
  await host.poll();
  await host.send({ t: 'reply', r: '0A0B' });
  await guest.app.session.poll();
  await until(() => !guest.app.showOpponent);
  assert.match(guest.html, /data-history-seat="1" class="history history-selected"/);
  assert.ok(guest.html.includes('0A0B'));
});

test('note and history pointer presses survive real renders and ignore replacement clicks', async (t) => {
  const { guest } = await onlineGuest(t);
  guest.openNotes();
  guest.pointerNote('4');
  const note = () => JSON.parse(guest.storage.getItem('guess-duel:online:ABC234')!).notes[4];
  assert.equal(note(), 1);
  guest.pointerControlClick({ note: '4' });
  assert.equal(note(), 1, 'the generated click cannot double-cycle the note');
  const poll = guest.app.session.client.poll.bind(guest.app.session.client);
  guest.app.session.client.poll = async (...args: any[]) => {
    const result = await poll(...args);
    result.seats = result.seats.map((p: any) => ({ ...p, online: p.seat !== 0 }));
    return result;
  };
  guest.pointerAction('ownHistory');
  await guest.app.session.poll();
  guest.pointerControlClick({ action: 'opponentHistory' });
  assert.equal(guest.app.showOpponent, false, 'replacement button click cannot change the list');
  assert.equal(guest.notesOpen, true, 'polls and note taps keep the notes pad open');
  guest.pointerNote('4');
  assert.equal(note(), 2);
  guest.pointerNote('4');
  assert.equal(note(), 0);
  guest.click('opponentHistory');
  assert.equal(guest.app.showOpponent, true, 'keyboard/assistive click still works');
});

test('peek stays on the stable container across a poll and masks on release, cancel and blur', async (t) => {
  const entry = loadApp(async () => assert.fail('local secret entry must not fetch'));
  t.after(entry.stop);
  await entry.act({ type: 'mode', mode: 'same' });
  await entry.act({ type: 'handover' });
  entry.pointerDigit('1');
  entry.pointerDigit('2');
  entry.pointerAction('peek');
  assert.equal(entry.text('secret-slots'), '12·');
  entry.pointerDigit('3');
  assert.equal(entry.text('secret-slots'), '123', 'secret draft survives a render during hold');
  entry.endPointer();
  assert.equal(entry.text('secret-slots'), '●●●');
  entry.pointerAction('peek');
  entry.click('rules');
  entry.click('closeRules');
  await until(() => entry.text('secret-slots') !== undefined);
  assert.equal(entry.text('secret-slots'), '●●●', 'leaving the entry cancels the hold');

  const { guest } = await onlineGuest(t);
  const poll = guest.app.session.client.poll.bind(guest.app.session.client);
  let online = true;
  guest.app.session.client.poll = async (...args: any[]) => {
    const result = await poll(...args);
    online = !online;
    result.seats = result.seats.map((p: any) => ({ ...p, online: p.seat !== 0 || online }));
    return result;
  };
  for (const ending of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) {
    guest.pointerAction('peek');
    assert.equal(guest.capturedPointer, 1);
    assert.equal(guest.text('own-secret'), '123');
    const renders = guest.renders;
    await guest.app.session.poll();
    await until(() => guest.renders > renders);
    assert.equal(guest.text('own-secret'), '123', 'replacement keeps the current hold');
    if (ending === 'blur') guest.blur();
    else guest.endPointer(ending);
    assert.equal(guest.text('own-secret'), '●●●', ending);
    guest.pointerControlClick({ action: 'peek' });
    assert.equal(guest.text('own-secret'), '●●●');
  }
  guest.peekKey('keydown');
  assert.equal(guest.text('own-secret'), '123');
  guest.peekKey('keyup');
  assert.equal(guest.text('own-secret'), '●●●');
});

test('busy controller applies the latest queued room and auto-replies after a failed await', async (t) => {
  const { guest, host } = await onlineGuest(t);
  const release = deferred();
  const send = guest.app.session.send.bind(guest.app.session);
  guest.app.session.send = async (move: any) => {
    await send(move);
    if (move.t === 'guess') {
      await release.promise;
      throw new RoomError(503, 'unavailable');
    }
  };
  const submitting = guest.act({ type: 'guess', code: '456' });
  await until(() => guest.app.game.history[1].length === 1);
  await host.poll();
  await host.send({ t: 'reply', r: '0A0B' });
  await guest.app.session.poll();
  await host.send({ t: 'guess', g: '213' });
  await guest.app.session.poll();
  assert.equal(guest.app.game.history[0][1].r, undefined, 'auto-reply waits while busy');
  release.resolve();
  await submitting;
  await until(() => Boolean(guest.app.game.history[0][1].r));
  assert.deepEqual(guest.app.game.history[0][1].r, { a: 1, b: 2 });
  assert.equal(guest.app.showOpponent, true);
  assert.equal(guest.app.game.history[0].length, 2, 'latest queued room wins');
  await host.poll();
  assert.deepEqual(host.room.state, guest.app.game);
});

test('updates during rules are applied on closing without waiting for a different poll', async (t) => {
  const { guest, host } = await onlineGuest(t);
  await guest.act({ type: 'guess', code: '456' });
  guest.click('rules');
  await host.poll();
  await host.send({ t: 'reply', r: '0A0B' });
  await host.send({ t: 'guess', g: '213' });
  await guest.app.session.poll();
  assert.equal(guest.app.screen, 'rules');
  guest.click('closeRules');
  await until(() => Boolean(guest.app.game.history[0][1]?.r));
  assert.equal(guest.app.screen, 'play');
  assert.equal(guest.app.showOpponent, true);
});

test('an update during a failed auto-reply is drained when advancing finishes', async (t) => {
  const { guest, host } = await onlineGuest(t);
  await guest.act({ type: 'guess', code: '456' });
  await host.poll();
  await host.send({ t: 'reply', r: '0A0B' });
  await host.send({ t: 'guess', g: '213' });
  const release = deferred();
  const send = guest.app.session.send.bind(guest.app.session);
  let attempts = 0;
  guest.app.session.send = async (move: any) => {
    if (move.t === 'reply' && ++attempts === 1) {
      await release.promise;
      throw new RoomError(503, 'unavailable');
    }
    return send(move);
  };
  await guest.app.session.poll();
  await until(() => attempts === 1);
  const poll = guest.app.session.client.poll.bind(guest.app.session.client);
  guest.app.session.client.poll = async (...args: any[]) => {
    const result = await poll(...args);
    result.seats = result.seats.map((p: any) => ({ ...p, online: p.seat !== 0 }));
    return result;
  };
  await guest.app.session.poll();
  release.resolve();
  await until(() => Boolean(guest.app.game.history[0][1]?.r));
  assert.equal(attempts, 2);
  assert.deepEqual(guest.app.game.history[0][1].r, { a: 1, b: 2 });
});

test('a poll result arriving during send is re-polled immediately and applies newer peer moves', async () => {
  const initial = room(playing());
  const incoming = deferred<Response>();
  const sending = deferred<Response>();
  const s = server(initial);
  let polls = 0;
  const changed: Room[] = [];
  const client = new RoomsClient(undefined, async (url, init) => {
    if (init?.method === 'GET') {
      polls++;
      return polls === 1 ? incoming.promise : s.fetcher(0)(url, init);
    }
    const response = await s.fetcher(0)(url, init);
    sending.resolve(response);
    await release.promise;
    return response;
  });
  const release = deferred();
  const session = new OnlineSession(
    client,
    initial.code,
    'token0',
    0,
    initial,
    (r) => changed.push(r),
    assert.fail,
  );
  const polling = session.poll();
  const moving = session.send({ t: 'guess', g: '132' });
  await sending.promise;
  const peer = new OnlineSession(
    new RoomsClient(undefined, s.fetcher(1)),
    initial.code,
    'token1',
    1,
    s.snapshot(),
    () => {},
    assert.fail,
  );
  await peer.send({ t: 'reply', r: '1A2B' });
  await peer.send({ t: 'guess', g: '456' });
  incoming.resolve(Response.json({ changed: true, room: s.snapshot() }));
  await polling;
  assert.equal(polls, 1);
  assert.equal(session.room.version, initial.version, 'poll waits for send to settle');
  release.resolve();
  await moving;
  assert.equal(polls, 2, 'immediate recovery poll');
  assert.deepEqual(session.room.state, peer.room.state);
  assert.equal(session.room.version, peer.room.version);
  assert.equal(changed.length, 2, 'send and newer peer moves are each notified');
});

test('poll requests while a send fails are coalesced and retried; stopped sessions do not retry', async () => {
  for (const stopped of [false, true]) {
    const release = deferred();
    let polls = 0;
    const initial = room(playing());
    const next = {
      ...initial,
      version: initial.version + 1,
      seats: initial.seats.map((p) => ({ ...p, online: p.seat !== 1 })),
    };
    const client = new RoomsClient(undefined, async (_url, init) => {
      if (init?.method === 'GET') {
        polls++;
        return Response.json({ changed: true, room: next });
      }
      await release.promise;
      return Response.json({ error: 'unavailable' }, { status: 503 });
    });
    const session = new OnlineSession(
      client,
      initial.code,
      'token0',
      0,
      initial,
      () => {},
      assert.fail,
    );
    const moving = session.send({ t: 'guess', g: '132' });
    await session.poll();
    await session.poll();
    assert.equal(polls, 0);
    if (stopped) session.stop();
    release.resolve();
    await assert.rejects(moving, (e) => e instanceof RoomError && e.status === 503);
    assert.equal(polls, stopped ? 0 : 1);
    assert.equal(session.room.seats[1].online, stopped);
  }
});

test('polls during skip are retried after the skip state has been restored', async () => {
  const initial = room(playing());
  const release = deferred();
  const next: Room = {
    ...initial,
    version: initial.version + 1,
    turn: 1,
    moves: [
      { version: initial.version + 1, seat: 1, skipped: true, move: { t: 'guess', g: '132' } },
    ],
  };
  let polls = 0;
  const client = new RoomsClient(undefined, async (_url, init) => {
    if (init?.method === 'GET') {
      polls++;
      return Response.json({
        changed: false,
        version: next.version,
        seats: next.seats.map((p) => ({ ...p, online: p.seat !== 1 })),
      });
    }
    await release.promise;
    return Response.json({ room: next });
  });
  const session = new OnlineSession(
    client,
    initial.code,
    'token0',
    0,
    initial,
    () => {},
    assert.fail,
  );
  const skipping = session.skip();
  await session.poll();
  assert.equal(polls, 0);
  release.resolve();
  await skipping;
  assert.equal(polls, 1);
  assert.deepEqual(session.room.state, applySkip(initial.state));
  assert.equal(session.room.seats[1].online, false);
});
