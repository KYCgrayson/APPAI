import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCommit, applyGuess, applyReply, other, type Seat } from '../src/logic/game.ts';
import { OnlineSession, roomViewChanged } from '../src/net/online.ts';
import { RoomError, RoomsClient } from '../src/net/rooms.ts';
import { EntryDrafts, acceptsKeypadEvent, selectOpponentHistory } from '../src/ui/input.ts';
import { historiesScreen, waitingSecretScreen } from '../src/ui/screens.ts';
import { strings } from '../src/ui/i18n.ts';
import { loadApp, until } from './helpers/app.ts';
import { setup, playing, room, server } from './helpers/rooms.ts';

test('render decisions ignore idle counters and versions but include meaningful presence changes', () => {
  const before = room(playing());
  const after = structuredClone(before);
  after.version++;
  after.expiresAt = '2031-01-01';
  after.seats[0].idleSeconds = 30;
  after.seats[1].idleSeconds = 90;
  assert.equal(roomViewChanged(before, after, 1), false);
  after.seats[0].idleSeconds = 120;
  assert.equal(roomViewChanged(before, after, 1), true, 'skip becomes available');
  assert.equal(roomViewChanged(before, after, 0), false, 'no skip for own turn');
  after.seats[0].idleSeconds = 121;
  assert.equal(roomViewChanged({ ...before, seats: after.seats }, after, 1), false);
  for (const field of ['joined', 'online'] as const) {
    const changed = structuredClone(before);
    changed.seats[0][field] = false;
    assert.equal(roomViewChanged(before, changed, 1), true, field);
  }
  assert.equal(
    roomViewChanged(before, { ...before, state: applyGuess(before.state, 0, '132') }, 1),
    true,
  );
  assert.equal(roomViewChanged(before, { ...before, status: 'finished' }, 1), true);
  const waiting = { ...before, status: 'waiting' as const };
  assert.equal(roomViewChanged(waiting, { ...waiting, expiresAt: '2031-01-01' }, 0), true);
});

test('unchanged polls, changing idle seconds and invalid moves do not notify the view', async () => {
  const initial = room(playing());
  const responses = [
    { changed: false, version: initial.version, seats: initial.seats },
    {
      changed: false,
      version: initial.version,
      seats: initial.seats.map((s) => ({ ...s, idleSeconds: 1 })),
    },
    {
      changed: true,
      room: {
        ...initial,
        version: initial.version + 1,
        moves: [{ version: initial.version + 1, seat: 1, move: { t: 'guess', g: '132' } }],
      },
    },
  ];
  let notifications = 0;
  const client = new RoomsClient(undefined, async () => Response.json(responses.shift()));
  const session = new OnlineSession(
    client,
    initial.code,
    'token',
    1,
    initial,
    () => notifications++,
    assert.fail,
  );
  for (let i = 0; i < 3; i++) await session.poll();
  assert.equal(notifications, 0);
  assert.equal(session.room.version, initial.version + 1, 'transport still advances');
  assert.deepEqual(session.room.state, initial.state);
});

test('entry drafts survive room versions and remain private to their game, seat and entry type', () => {
  const drafts = new EntryDrafts();
  const initial = setup();
  drafts.set(initial.id, 1, 'secret', '12');
  const committed = applyCommit(initial, 0, 'a'.repeat(64));
  assert.equal(drafts.get(committed.id, 1, 'secret'), '12');
  assert.equal(drafts.get(committed.id, 0, 'secret'), '');
  assert.equal(drafts.get(committed.id, 1, 'play'), '');
  drafts.set(committed.id, 1, 'play', '98');
  const pending = applyGuess(playing(), 0, '132');
  assert.equal(drafts.get(pending.id, 1, 'play'), '98');
  assert.equal(drafts.get('rematch', 1, 'secret'), '');
  drafts.reset();
  assert.equal(drafts.get(initial.id, 1, 'secret'), '');
});

test('keypad accepts a primary pointer once and supports keyboard/assistive clicks', () => {
  assert.equal(acceptsKeypadEvent({ type: 'pointerdown', button: 0, isPrimary: true }), true);
  assert.equal(acceptsKeypadEvent({ type: 'click', detail: 1 }), false);
  assert.equal(acceptsKeypadEvent({ type: 'click', detail: 0 }), true);
  assert.equal(acceptsKeypadEvent({ type: 'pointerdown', button: 2, isPrimary: true }), false);
  assert.equal(acceptsKeypadEvent({ type: 'pointerdown', button: 0, isPrimary: false }), false);
});

test('the controller keeps secret and guess drafts through polls and handles replacement-key clicks', async (t) => {
  const s = server();
  const guest = loadApp(s.fetcher(1), 'https://appai.info/games/guess-duel/?room=ABC234');
  t.after(guest.stop);
  await until(() => guest.app.screen === 'secret');
  guest.pointerDigit('1');
  guest.pointerClick('2'); // The eventual click lands on a different, newly rendered key.
  assert.equal(guest.app.input, '1');
  const renders = guest.renders;
  await guest.app.session.poll();
  assert.equal(guest.renders, renders);
  assert.equal(guest.app.input, '1');

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
  await until(() => guest.renders > renders);
  assert.equal(guest.app.input, '1', 'a relevant setup update retains typed secret');
  guest.keyboardClick('2');
  guest.pointerDigit('3');
  assert.equal(guest.app.input, '123');
  await guest.act({ type: 'setSecret', code: '123' });
  assert.equal(guest.app.input, '');
  await host.poll();
  await host.send({ t: 'guess', g: '132' });
  await guest.app.session.poll();
  await until(() => Boolean(guest.app.game.history[0][0]?.r));
  guest.pointerDigit('9');
  assert.equal(guest.app.input, '9');
  const previous = guest.renders;
  // Presence changes require rendering even though the draft is unfinished.
  const poll = guest.app.session.client.poll.bind(guest.app.session.client);
  guest.app.session.client.poll = async (...args: any[]) => {
    const result = await poll(...args);
    result.seats = result.seats.map((p: any) => ({ ...p, online: p.seat !== 0 }));
    return result;
  };
  await guest.app.session.poll();
  await until(() => guest.renders > previous);
  assert.equal(guest.app.input, '9', 'presence update retains guess');
  assert.ok(guest.html.includes('Host is offline'));
  assert.match(guest.html, /data-history-seat="0" class="history history-selected"/);
  assert.ok(guest.html.includes('1A2B'));
  guest.app.session.client.sendMove = async () => {
    throw new RoomError(503, 'unavailable');
  };
  await guest.act({ type: 'guess', code: '987' });
  assert.equal(guest.app.input, '987', 'failed sends preserve the submitted draft');
  assert.equal(guest.app.screen, 'play');
  assert.ok(guest.html.includes(strings.en.unavailable));
});

test('host guess 132 and guest reply 1A2B appear in the guest opponent history for both starters', async () => {
  for (const first of [0, 1] as const) {
    let state = { ...playing(), first, turn: first };
    if (first === 1) state = applyReply(applyGuess(state, 1, '456'), 0, '0A0B');
    const s = server(room(state));
    const make = (seat: Seat) =>
      new OnlineSession(
        new RoomsClient(undefined, s.fetcher(seat)),
        'ABC234',
        'token' + seat,
        seat,
        s.snapshot(),
        () => {},
        assert.fail,
      );
    const host = make(0),
      guest = make(1);
    await host.send({ t: 'guess', g: '132' });
    await guest.poll();
    await guest.send({ t: 'reply', r: '1A2B' });
    assert.deepEqual(guest.room.state.history[0], [{ g: '132', r: { a: 1, b: 2 } }]);
    assert.deepEqual(guest.room.state.history[1], state.history[1]);
    for (const text of [strings.en, strings['zh-TW']]) {
      const selectedOpponent = selectOpponentHistory(state, guest.room.state, 1, false);
      assert.equal(selectedOpponent, true, 'new host guess selects its history automatically');
      const html = historiesScreen(guest.room.state, 1, selectedOpponent, text);
      const selected = html.match(
        /data-history-seat="0" class="history history-selected">([\s\S]*?)<\/ol>/,
      )![1];
      assert.ok(selected.includes('Host'));
      assert.ok(selected.includes('1A2B'));
      assert.ok(!selected.includes('class="empty"'));
      assert.ok(
        selected.includes('>1</span>') &&
          selected.includes('>3</span>') &&
          selected.includes('>2</span>'),
      );
      assert.match(
        historiesScreen(guest.room.state, 1, false, text),
        /data-history-seat="1" class="history history-selected"/,
      );
    }
    await host.poll();
    assert.deepEqual(host.room.state, guest.room.state);
  }
});

test('a delayed poll cannot roll back a guest reply or its room version', async () => {
  const s = server(room(playing()));
  const initial = s.snapshot();
  const host = new OnlineSession(
    new RoomsClient(undefined, s.fetcher(0)),
    initial.code,
    'token0',
    0,
    initial,
    () => {},
    assert.fail,
  );
  await host.send({ t: 'guess', g: '132' });
  const pending = s.snapshot();
  let release!: (response: Response) => void;
  const client = new RoomsClient(undefined, (url, init) =>
    init?.method === 'GET'
      ? new Promise<Response>((resolve) => {
          release = resolve;
        })
      : s.fetcher(1)(url, init),
  );
  const guest = new OnlineSession(
    client,
    initial.code,
    'token1',
    1,
    pending,
    () => {},
    assert.fail,
  );
  const poll = guest.poll();
  await guest.send({ t: 'reply', r: '1A2B' });
  release(Response.json({ changed: true, room: pending }));
  await poll;
  assert.equal(guest.room.version, pending.version + 1);
  assert.deepEqual(guest.room.state.history[0], [{ g: '132', r: { a: 1, b: 2 } }]);
});

test('full-room waits never name the local player when its secret is waiting to be sent', () => {
  for (const seat of [0, 1] as const) {
    for (const text of [strings.en, strings['zh-TW']]) {
      const snapshot = room(applyCommit(setup(), other(seat), 'a'.repeat(64)));
      const html = waitingSecretScreen(snapshot, seat, text.waitingSecret, text.savingSecret)!;
      assert.ok(html.includes(text.savingSecret));
      assert.ok(!html.includes(snapshot.state.names[seat]));
      const bothPending = waitingSecretScreen(room(), seat, text.waitingSecret, text.savingSecret)!;
      assert.ok(bothPending.includes(snapshot.state.names[other(seat)]));
      assert.ok(!bothPending.includes(snapshot.state.names[seat]));
    }
  }
});

test('join failures keep the online panel, all code boxes and the localized error', async (t) => {
  for (const [status, error, notice] of [
    [409, 'room_full', strings.en.roomFull],
    [404, 'room_not_found', 'Room not found. Create a new room.'],
    [503, 'unavailable', strings.en.unavailable],
  ] as const) {
    const view = loadApp(async () => Response.json({ error }, { status }));
    t.after(view.stop);
    await view.act({ type: 'mode', mode: 'online' });
    view.enterRoom('abc234');
    view.click('joinRoom');
    await until(() => view.app.message === notice);
    assert.equal(view.app.screen, 'onlineLobby');
    assert.deepEqual(view.app.roomDigits, [...'ABC234']);
    assert.equal(
      [...view.html.matchAll(/data-room-digit="\d"[^>]*value="([^"]*)"/g)]
        .map((m) => m[1])
        .join(''),
      'ABC234',
    );
    assert.ok(view.html.includes(notice));
  }
});

test('an invalid join code stays editable without making a network request', async (t) => {
  let calls = 0;
  const view = loadApp(async () => {
    calls++;
    return Response.json({});
  });
  t.after(view.stop);
  await view.act({ type: 'mode', mode: 'online' });
  view.enterRoom('ABC');
  view.click('joinRoom');
  await until(() => view.app.message === strings.en.roomCode);
  assert.equal(view.app.screen, 'onlineLobby');
  assert.deepEqual(view.app.roomDigits, ['A', 'B', 'C', '', '', '']);
  assert.equal(calls, 0);
});
