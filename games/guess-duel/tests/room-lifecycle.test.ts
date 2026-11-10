import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/logic/game.ts';
import {
  formatRemaining,
  remainingSeconds,
  RoomCountdown,
  serverClockOffset,
  waitingRoomState,
} from '../src/net/lifecycle.ts';
import { RoomsClient, type Room } from '../src/net/rooms.ts';
import { strings } from '../src/ui/i18n.ts';
import { closedRoomScreen, onlineLobbyScreen } from '../src/ui/screens.ts';
import { loadApp, until } from './helpers/app.ts';
import { room } from './helpers/rooms.ts';

const serverTime = Date.parse('2026-11-10T00:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();
function waiting(overrides: Partial<Room> = {}): Room {
  const snapshot = room(createGame({ n: 4, names: ['Parent', 'Kid'] }));
  return {
    ...snapshot,
    status: 'waiting',
    seats: snapshot.seats.map((s) => ({ ...s, joined: s.seat === 0 })),
    expiresAt: iso(serverTime + 300000),
    ...overrides,
  };
}
const response = (data: unknown, status = 200, now = serverTime) =>
  Response.json(data, { status, headers: { Date: new Date(now).toUTCString() } });
const joined = (snapshot: Room) => ({ seat: 0, token: 'old-token', room: snapshot });

test('remaining time corrects clocks ahead and behind, includes round-trip time and has no TTL cap', () => {
  for (const skew of [-3600000, 3600000]) {
    const sentAt = serverTime + skew;
    const receivedAt = sentAt + 400;
    const offset = serverClockOffset(new Date(serverTime).toUTCString(), sentAt, receivedAt)!;
    assert.equal(offset, -skew + 300);
    assert.equal(remainingSeconds(iso(serverTime + 300000), receivedAt + offset), 300);
    assert.equal(remainingSeconds(iso(serverTime + 300000), receivedAt + offset + 1000), 299);
  }
  assert.equal(serverClockOffset(null, 0, 100), undefined);
  assert.equal(serverClockOffset('invalid', 0, 100), undefined);
});

test('remaining time formats m:ss, rounds partial seconds up and stops at zero', () => {
  for (const [seconds, text] of [
    [0, '0:00'],
    [9, '0:09'],
    [60, '1:00'],
    [125, '2:05'],
    [600, '10:00'],
    [-1, '0:00'],
  ] as const)
    assert.equal(formatRemaining(seconds), text);
  assert.equal(remainingSeconds(iso(serverTime + 1), serverTime), 1);
  assert.equal(remainingSeconds(iso(serverTime), serverTime), 0);
  assert.equal(remainingSeconds(iso(serverTime - 1), serverTime), 0);
});

test('only an unstarted room transitions to closed at its API expiry', () => {
  const snapshot = waiting({ expiresAt: iso(serverTime) });
  assert.equal(waitingRoomState(snapshot, serverTime - 1), 'waiting');
  assert.equal(waitingRoomState(snapshot, serverTime), 'closed');
  assert.equal(waitingRoomState(snapshot, serverTime + 1000), 'closed');
  for (const status of ['playing', 'finished'] as const)
    assert.equal(waitingRoomState({ ...snapshot, status }, serverTime + 1000), 'started');
});

test('client samples Date on create and polls and retains calibration without an exposed Date', async () => {
  let now = serverTime + 3600000;
  const dates = [serverTime, null, 'invalid', serverTime + 10000];
  const delays = [400, 100, 50, 200];
  const client = new RoomsClient(
    undefined,
    async () => {
      now += delays.shift()!;
      const date = dates.shift();
      return Response.json(
        { code: 'ABC234', ...joined(waiting()), changed: true },
        {
          headers:
            date === null
              ? {}
              : { Date: typeof date === 'number' ? new Date(date).toUTCString() : date! },
        },
      );
    },
    undefined,
    undefined,
    () => now,
  );
  await client.create(createGame());
  assert.equal(client.serverNow(), serverTime + 700);
  await client.poll('ABC234', 'token', 0);
  assert.equal(client.serverNow(), serverTime + 800);
  await client.poll('ABC234', 'token', 0);
  assert.equal(client.serverNow(), serverTime + 850);
  await client.poll('ABC234', 'token', 0);
  assert.equal(client.serverNow(), serverTime + 10600);
});

test('clock calibration replaces every faster sample, including small corrections, and ignores slower or equal RTTs', async () => {
  for (const skew of [-3600000, 0, 3600000]) {
    let now = serverTime + skew;
    const samples = [
      { rtt: 3000, date: serverTime + 3000 },
      { rtt: 1000, date: serverTime + 4000 },
      { rtt: 1500, date: serverTime + 100000 },
      { rtt: 1000, date: serverTime + 100000 },
      { rtt: 100, date: serverTime + 5000 },
    ];
    let expectedOffset = 0;
    let bestRTT = Infinity;
    const client = new RoomsClient(
      undefined,
      async () => {
        const sample = samples.shift()!;
        const sentAt = now;
        now += sample.rtt;
        if (sample.rtt < bestRTT) {
          expectedOffset = serverClockOffset(new Date(sample.date).toUTCString(), sentAt, now)!;
          bestRTT = sample.rtt;
        }
        return response({ code: 'ABC234', ...joined(waiting()), changed: false }, 200, sample.date);
      },
      undefined,
      undefined,
      () => now,
    );
    await client.create(createGame());
    assert.equal(client.serverNow(), now + expectedOffset);
    while (samples.length) {
      await client.poll('ABC234', 'token', 0);
      assert.equal(client.serverNow(), now + expectedOffset);
      assert.equal(client.clockRoundTrip, bestRTT);
    }
  }
});

test('both languages show progress and disable create, join and recreate while connecting', () => {
  for (const lang of ['en', 'zh-TW'] as const) {
    const t = strings[lang];
    for (const action of ['creating', 'joining'] as const) {
      const html = onlineLobbyScreen(t, lang === 'en', [...'ABC234'], action);
      assert.match(html, /data-action="createRoom" disabled/);
      assert.match(html, /data-action="joinRoom" disabled/);
      assert.match(html, /aria-busy="true"/);
      assert.ok(html.includes(action === 'creating' ? t.creatingRoom : t.joiningRoom));
    }
    const closed = closedRoomScreen(t, 'creating');
    assert.ok(closed.includes(t.roomClosed));
    assert.ok(closed.includes(t.recreateRoom));
    assert.match(closed, /data-action="createRoom" disabled/);
    assert.doesNotMatch(onlineLobbyScreen(t, lang === 'en', []), / disabled/);
  }
});

test('create immediately disables competing actions and restores them with the specific error', async (t) => {
  let release!: (r: Response) => void;
  let calls = 0;
  const view = loadApp(async () => {
    calls++;
    return new Promise<Response>((resolve) => (release = resolve));
  });
  t.after(view.stop);
  await view.act({ type: 'mode', mode: 'online' });
  view.click('createRoom');
  assert.equal(calls, 1);
  assert.equal(view.app.connecting, 'creating');
  assert.ok(view.html.includes(strings.en.creatingRoom));
  assert.match(view.html, /data-action="createRoom" disabled/);
  assert.match(view.html, /data-action="joinRoom" disabled/);
  view.click('createRoom');
  view.click('joinRoom');
  view.click('home');
  await view.act({ type: 'mode', mode: 'same' });
  assert.equal(view.app.screen, 'onlineLobby');
  assert.equal(calls, 1);
  release(response({ error: 'login_required' }, 401));
  await until(() => view.app.connecting === undefined);
  assert.ok(view.html.includes('Sign in to AppAI'));
  assert.match(view.html, /data-action="login"/);
  assert.doesNotMatch(view.html, /data-action="(?:createRoom|joinRoom)" disabled/);
  assert.ok(!view.html.includes(strings.en.creatingRoom));
});

test('join immediately shows progress and restores the entered code and specific error', async (t) => {
  let release!: (r: Response) => void;
  let calls = 0;
  const view = loadApp(async () => {
    calls++;
    return new Promise<Response>((resolve) => (release = resolve));
  });
  t.after(view.stop);
  await view.act({ type: 'mode', mode: 'online' });
  view.enterRoom('ABC234');
  view.click('joinRoom');
  assert.ok(view.html.includes(strings.en.joiningRoom));
  assert.match(view.html, /data-action="joinRoom" disabled/);
  view.click('joinRoom');
  view.click('createRoom');
  assert.equal(calls, 1);
  release(response({ error: 'room_full' }, 409));
  await until(() => view.app.connecting === undefined);
  assert.ok(view.html.includes(strings.en.roomFull));
  assert.deepEqual(view.app.roomDigits, [...'ABC234']);
  assert.doesNotMatch(view.html, /data-action="(?:createRoom|joinRoom)" disabled/);
});

test('a typed missing room stays editable in both languages and can retry a corrected code', async (t) => {
  for (const lang of ['en', 'zh-TW'] as const) {
    const calls: string[] = [];
    const view = loadApp(
      async (url) => {
        const path = new URL(String(url)).pathname;
        calls.push(path);
        if (path.endsWith('/ABC234/join')) return response({ error: 'room_not_found' }, 404);
        return response(
          path.endsWith('/join') ? joined(waiting({ code: 'XYZ789' })) : { changed: false },
        );
      },
      `https://appai.info/games/guess-duel/?locale=${lang}`,
      () => serverTime,
    );
    t.after(view.stop);
    await view.act({ type: 'mode', mode: 'online' });
    view.enterRoom('abc234');
    view.click('joinRoom');
    await until(() => view.app.connecting === undefined);
    assert.equal(view.app.screen, 'onlineLobby');
    assert.deepEqual(view.app.roomDigits, [...'ABC234']);
    assert.equal(
      view.app.message,
      lang === 'en' ? 'Room not found — check the code' : '找不到這個房間，請確認房號',
    );
    assert.ok(view.html.includes(strings[lang].roomNotFound));
    assert.ok(!view.html.includes(strings[lang].roomClosed));
    assert.ok(!view.html.includes(strings[lang].recreateRoom));
    assert.equal(
      [...view.html.matchAll(/data-room-digit="\d"[^>]*value="([^"]*)"/g)]
        .map((m) => m[1])
        .join(''),
      'ABC234',
    );
    assert.doesNotMatch(view.html, /data-action="(?:createRoom|joinRoom)" disabled/);
    assert.equal(new URL(view.url).searchParams.has('room'), false);
    view.enterRoom('XYZ789');
    view.click('joinRoom');
    await until(() => view.app.connecting === undefined);
    assert.equal(view.app.screen, 'waiting');
    assert.equal(view.app.session.code, 'XYZ789');
    assert.deepEqual(calls.slice(0, 2), ['/api/rooms/ABC234/join', '/api/rooms/XYZ789/join']);
  }
});

test('a typed code with a gone saved seat closes the room instead of reporting an unknown code', async (t) => {
  for (const lang of ['en', 'zh-TW'] as const) {
    const key = 'room:https://appai.info/ABC234';
    const calls: string[] = [];
    const view = loadApp(
      async (url) => {
        calls.push(String(url));
        return response({ error: 'room_not_found' }, 404);
      },
      `https://appai.info/games/guess-duel/?locale=${lang}`,
      () => serverTime,
      { [key]: JSON.stringify({ seat: 0, token: 'stale-token' }) },
    );
    t.after(view.stop);
    await view.act({ type: 'mode', mode: 'online' });
    view.enterRoom('ABC234');
    view.click('joinRoom');
    await until(() => view.app.connecting === undefined);
    assert.equal(view.app.screen, 'roomClosed');
    assert.ok(view.html.includes(strings[lang].roomClosed));
    assert.ok(view.html.includes(strings[lang].recreateRoom));
    assert.ok(!view.html.includes('data-action="joinRoom"'));
    assert.equal(view.storage.getItem(key), null);
    assert.deepEqual(calls, ['https://appai.info/api/rooms/ABC234?since=-1']);
  }
});

test('the host’s own waiting room closes on a confirming 404 or expiry and offers one recreate button', async (t) => {
  for (const missing of [false, true]) {
    let now = serverTime;
    const snapshot = waiting({ expiresAt: iso(serverTime + 120000) });
    const view = loadApp(
      async (url) => {
        const path = new URL(String(url));
        if (path.pathname === '/api/rooms')
          return response({ code: snapshot.code, ...joined(snapshot) });
        if (path.searchParams.get('since') === '-1')
          return missing
            ? response({ error: 'room_not_found' }, 404, now)
            : response({ changed: true, room: snapshot }, 200, now);
        return response({ changed: false }, 200, now);
      },
      undefined,
      () => now,
    );
    t.after(view.stop);
    await view.act({ type: 'mode', mode: 'online' });
    view.click('createRoom');
    await until(() => view.app.connecting === undefined);
    assert.equal(view.app.screen, 'waiting');
    now += 120000;
    view.tick();
    await until(() => view.app.screen === 'roomClosed');
    assert.ok(view.html.includes(strings.en.roomClosed));
    assert.ok(view.html.includes(strings.en.recreateRoom));
    assert.equal([...view.html.matchAll(/data-action="createRoom"/g)].length, 1);
    assert.equal(view.app.session, undefined);
    assert.equal(view.storage.getItem('room:https://appai.info/ABC234'), null);
    assert.equal(new URL(view.url).searchParams.has('room'), false);
  }
});

test('countdown ticks without replacing the screen and resyncs on a new expiry before hiding on start', async (t) => {
  let now = serverTime + 3600000;
  let latest = waiting();
  const view = loadApp(
    async (url) =>
      response(String(url).endsWith('/join') ? joined(latest) : { changed: true, room: latest }),
    'https://appai.info/games/guess-duel/?room=ABC234',
    () => now,
  );
  t.after(view.stop);
  await until(() => view.app.screen === 'waiting');
  assert.equal(view.app.countdown(), 'Room closes in 5:00');
  const renders = view.renders;
  now += 1000;
  view.tick();
  assert.equal(view.text('countdown'), 'Room closes in 4:59');
  assert.equal(view.renders, renders, 'a clock tick only updates its text node');
  latest = { ...latest, expiresAt: iso(serverTime + 420000) };
  await view.app.session.poll();
  await until(() => view.html.includes('Room closes in 6:59'));
  latest = { ...latest, status: 'playing', seats: room().seats };
  await view.app.session.poll();
  await until(() => view.app.screen === 'secret');
  assert.ok(!view.html.includes('data-countdown'));
  now += 1000000;
  view.tick();
  assert.equal(view.app.screen, 'secret', 'waiting TTL never closes a started game');
});

test('expiry clears the old room and one tap creates a fresh game with the same settings', async (t) => {
  let now = serverTime - 3600000;
  const old = waiting({ state: createGame({ n: 4, names: ['Parent', 'Kid'], first: 1 }) });
  let created: any;
  let release!: (r: Response) => void;
  const view = loadApp(
    async (url, init) => {
      if (new URL(String(url)).pathname === '/api/rooms') {
        created = JSON.parse(init!.body as string);
        return new Promise<Response>((resolve) => (release = resolve));
      }
      if (new URL(String(url)).pathname.endsWith('/XYZ789'))
        return response({ changed: false }, 200, now + 3600000);
      return response(
        String(url).endsWith('/join') ? joined(old) : { changed: true, room: old },
        200,
        now + 3600000,
      );
    },
    'https://appai.info/games/guess-duel/?room=ABC234&locale=zh-TW&theme=dark',
    () => now,
  );
  t.after(view.stop);
  await until(() => view.app.screen === 'waiting');
  const oldId = view.app.game.id;
  const oldSession = view.app.session;
  view.storage.setItem('guess-duel:online:ABC234', 'old-secret');
  view.storage.setItem('room:ABC234', 'legacy-token');
  now += 300000;
  view.tick();
  await until(() => view.app.screen === 'roomClosed');
  assert.ok(view.html.includes(strings['zh-TW'].roomClosed));
  assert.ok(view.html.includes(strings['zh-TW'].recreateRoom));
  for (const key of ['room:https://appai.info/ABC234', 'room:ABC234', 'guess-duel:online:ABC234'])
    assert.equal(view.storage.getItem(key), null);
  assert.equal(new URL(view.url).searchParams.has('room'), false);
  assert.equal(view.app.session, undefined);
  view.click('createRoom');
  assert.equal(created.state.n, 4);
  assert.deepEqual(created.state.names, ['Parent', 'Kid']);
  assert.equal(created.state.first, 1);
  assert.notEqual(created.state.id, oldId);
  assert.deepEqual(created.state.commits, [null, null]);
  assert.deepEqual(created.state.history, [[], []]);
  assert.ok(view.html.includes(strings['zh-TW'].creatingRoom));
  assert.match(view.html, /data-action="createRoom" disabled/);
  release(
    response(
      {
        code: 'XYZ789',
        seat: 0,
        token: 'new-token',
        room: waiting({
          code: 'XYZ789',
          state: created.state,
          expiresAt: iso(serverTime + 600000),
        }),
      },
      200,
      now + 3600000,
    ),
  );
  await until(() => view.app.connecting === undefined);
  assert.equal(view.app.session.code, 'XYZ789');
  assert.notEqual(view.app.session, oldSession);
  const url = new URL(view.url);
  assert.deepEqual(url.searchParams.getAll('room'), ['XYZ789']);
  assert.equal(url.searchParams.get('locale'), 'zh-TW');
  assert.equal(url.searchParams.get('theme'), 'dark');
  assert.equal(
    JSON.parse(view.storage.getItem('room:https://appai.info/XYZ789')!).token,
    'new-token',
  );
});

test('API 404 or expired closes an active room and offers recreation', async (t) => {
  for (const [status, error] of [
    [404, 'room_not_found'],
    [410, 'expired'],
  ] as const) {
    const view = loadApp(
      async (url) =>
        String(url).endsWith('/join') ? response(joined(waiting())) : response({ error }, status),
      'https://appai.info/games/guess-duel/?room=ABC234',
      () => serverTime,
    );
    t.after(view.stop);
    await until(() => view.app.screen === 'roomClosed');
    assert.ok(view.html.includes(strings.en.roomClosed));
    assert.match(view.html, /data-action="createRoom"/);
    assert.equal(view.storage.getItem('room:https://appai.info/ABC234'), null);
    assert.equal(new URL(view.url).searchParams.has('room'), false);
  }
});

test('failed recreation restores the closed-screen button and retains the API error', async (t) => {
  let now = serverTime;
  const view = loadApp(
    async (url) => {
      if (String(url).endsWith('/api/rooms')) return response({ error: 'login_required' }, 401);
      return response(
        String(url).endsWith('/join') ? joined(waiting()) : { changed: true, room: waiting() },
        200,
        now,
      );
    },
    'https://appai.info/games/guess-duel/?room=ABC234',
    () => now,
  );
  t.after(view.stop);
  await until(() => view.app.screen === 'waiting');
  now += 300000;
  view.tick();
  await until(() => view.app.screen === 'roomClosed');
  view.click('createRoom');
  await until(() => view.app.connecting === undefined);
  assert.equal(view.app.screen, 'roomClosed');
  assert.ok(view.html.includes('Sign in to AppAI'));
  assert.ok(view.html.includes(strings.en.recreateRoom));
  assert.doesNotMatch(view.html, /data-action="createRoom" disabled/);
});

test('an already expired response goes straight to closed without polling', async (t) => {
  let calls = 0;
  const view = loadApp(
    async () => {
      calls++;
      return response(joined(waiting({ expiresAt: iso(serverTime) })));
    },
    'https://appai.info/games/guess-duel/?room=ABC234',
    () => serverTime,
  );
  t.after(view.stop);
  await until(() => view.app.screen === 'roomClosed');
  assert.equal(calls, 1);
  assert.ok(view.html.includes(strings.en.roomClosed));
  assert.equal(new URL(view.url).searchParams.has('room'), false);
});

test('a full room that has not started still displays its API countdown', async (t) => {
  const snapshot = waiting({ seats: room().seats });
  const view = loadApp(
    async (url) => response(String(url).endsWith('/join') ? joined(snapshot) : { changed: false }),
    'https://appai.info/games/guess-duel/?room=ABC234',
    () => serverTime,
  );
  t.after(view.stop);
  await until(() => view.app.screen === 'waiting');
  assert.ok(view.html.includes('Room closes in 5:00'));
  assert.ok(view.html.includes('data-countdown'));
  assert.ok(!view.html.includes('class="keypad"'));
});

test('an old in-flight poll failure cannot close the recreated room', async (t) => {
  let now = serverTime;
  let releasePoll!: (r: Response) => void;
  const view = loadApp(
    async (url, init) => {
      const path = new URL(String(url));
      if (path.pathname.endsWith('/join')) return response(joined(waiting()));
      if (path.pathname === '/api/rooms') {
        const body = JSON.parse(init!.body as string);
        return response(
          {
            code: 'XYZ789',
            seat: 0,
            token: 'new-token',
            room: waiting({ code: 'XYZ789', state: body.state, expiresAt: iso(now + 300000) }),
          },
          200,
          now,
        );
      }
      if (path.pathname.endsWith('/ABC234'))
        return path.searchParams.get('since') === '-1'
          ? response({ error: 'room_not_found' }, 404, now)
          : new Promise<Response>((resolve) => (releasePoll = resolve));
      return response({ changed: false });
    },
    'https://appai.info/games/guess-duel/?room=ABC234',
    () => now,
  );
  t.after(view.stop);
  await until(() => Boolean(releasePoll));
  now += 300000;
  view.tick();
  await until(() => view.app.screen === 'roomClosed');
  view.click('createRoom');
  await until(() => view.app.session?.code === 'XYZ789');
  releasePoll(response({ error: 'room_not_found' }, 404));
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(view.app.screen, 'waiting');
  assert.equal(view.app.session.code, 'XYZ789');
  assert.equal(new URL(view.url).searchParams.get('room'), 'XYZ789');
});

test('zero countdown waits for the server and preserves the room when a guest has joined', async (t) => {
  for (const hidden of [false, true]) {
    let now = serverTime;
    const snapshot = waiting({ expiresAt: iso(serverTime + 120000) });
    let confirm!: (r: Response) => void;
    const view = loadApp(
      async (url) => {
        const path = new URL(String(url));
        if (path.pathname.endsWith('/join')) return response(joined(snapshot));
        if (path.searchParams.get('since') === '-1')
          return new Promise<Response>((resolve) => (confirm = resolve));
        return response({ changed: false, version: 0, seats: snapshot.seats });
      },
      'https://appai.info/games/guess-duel/?room=ABC234',
      () => now,
    );
    t.after(view.stop);
    await until(() => view.app.connecting === undefined);
    if (hidden) view.setHidden(true);
    const session = view.app.session;
    now += 120000;
    view.tick();
    assert.equal(view.text('countdown'), 'Room closes in 0:00');
    assert.ok(confirm, 'zero countdown immediately requests a full snapshot');
    assert.equal(
      view.app.screen,
      'waiting',
      'expiry is not confirmed while the request is pending',
    );
    assert.equal(view.app.session, session);
    assert.ok(view.storage.getItem('room:https://appai.info/ABC234'));
    assert.equal(new URL(view.url).searchParams.get('room'), 'ABC234');
    confirm(
      response(
        {
          changed: true,
          room: { ...snapshot, version: 1, status: 'playing', seats: room().seats },
        },
        200,
        now,
      ),
    );
    await until(() => view.app.screen === 'secret');
    assert.equal(view.app.session, session);
    assert.ok(view.storage.getItem('room:https://appai.info/ABC234'));
    assert.equal(new URL(view.url).searchParams.get('room'), 'ABC234');
    assert.ok(!view.html.includes('data-countdown'));
  }
});

test('zero countdown closes only after a confirming 404 and coalesces pending refreshes', async (t) => {
  let now = serverTime;
  let confirm!: (r: Response) => void;
  let refreshes = 0;
  const snapshot = waiting({ expiresAt: iso(serverTime + 120000) });
  const view = loadApp(
    async (url) => {
      const path = new URL(String(url));
      if (path.pathname.endsWith('/join')) return response(joined(snapshot));
      if (path.searchParams.get('since') === '-1') {
        refreshes++;
        return new Promise<Response>((resolve) => (confirm = resolve));
      }
      return response({ changed: false });
    },
    'https://appai.info/games/guess-duel/?room=ABC234',
    () => now,
  );
  t.after(view.stop);
  await until(() => view.app.connecting === undefined);
  now += 120000;
  view.tick();
  view.tick();
  view.setHidden(false);
  assert.equal(refreshes, 1);
  assert.equal(view.app.screen, 'waiting');
  confirm(response({ error: 'room_not_found' }, 404, now));
  await until(() => view.app.screen === 'roomClosed');
  assert.equal(view.app.session, undefined);
  assert.equal(view.storage.getItem('room:https://appai.info/ABC234'), null);
  assert.equal(new URL(view.url).searchParams.has('room'), false);
});

test('returning from a hidden tab immediately refreshes before the next countdown tick', async (t) => {
  let latest = waiting();
  let polls = 0;
  const view = loadApp(
    async (url) => {
      if (String(url).endsWith('/join')) return response(joined(latest));
      polls++;
      return response({ changed: true, room: latest });
    },
    'https://appai.info/games/guess-duel/?room=ABC234',
    () => serverTime,
  );
  t.after(view.stop);
  await until(() => view.app.connecting === undefined);
  const before = polls;
  view.setHidden(true);
  assert.equal(polls, before);
  latest = { ...latest, version: 1, status: 'playing', seats: room().seats };
  view.setHidden(false);
  assert.equal(polls, before + 1);
  await until(() => view.app.screen === 'secret');
  assert.equal(new URL(view.url).searchParams.get('room'), 'ABC234');
});

test('a failed expiry check retains the token and URL and retries instead of closing locally', async (t) => {
  let now = serverTime;
  let refreshes = 0;
  const snapshot = waiting({ expiresAt: iso(serverTime + 120000) });
  const view = loadApp(
    async (url) => {
      const path = new URL(String(url));
      if (path.pathname.endsWith('/join')) return response(joined(snapshot));
      if (path.searchParams.get('since') === '-1') {
        refreshes++;
        return response({ error: 'unavailable' }, 503, now);
      }
      return response({ changed: false });
    },
    'https://appai.info/games/guess-duel/?room=ABC234',
    () => now,
  );
  t.after(view.stop);
  await until(() => view.app.connecting === undefined);
  now += 120000;
  view.tick();
  await until(() => view.app.message === strings.en.unavailable);
  assert.equal(view.app.screen, 'waiting');
  assert.ok(view.storage.getItem('room:https://appai.info/ABC234'));
  assert.equal(new URL(view.url).searchParams.get('room'), 'ABC234');
  view.tick();
  await until(() => refreshes === 2);
});

test('failed creation after an unavailable room lookup preserves its unexpired credentials and URL', async (t) => {
  const key = 'room:https://appai.info/ABC234';
  const token = JSON.stringify({ seat: 0, token: 'saved-token' });
  const view = loadApp(
    async () => response({ error: 'unavailable' }, 503),
    'https://appai.info/games/guess-duel/?room=ABC234',
    () => serverTime,
    { [key]: token },
  );
  t.after(view.stop);
  await until(() => view.app.connecting === undefined);
  view.click('createRoom');
  await until(() => view.app.connecting === undefined);
  assert.equal(view.app.screen, 'onlineLobby');
  assert.equal(view.storage.getItem(key), token);
  assert.equal(new URL(view.url).searchParams.get('room'), 'ABC234');
});

test('reopening a gone room uses one closed-screen recreate button and clears stale credentials', async (t) => {
  for (const lang of ['en', 'zh-TW'] as const) {
    for (const saved of [false, true]) {
      for (const [status, error] of [
        [404, 'room_not_found'],
        [410, 'expired'],
        [410, 'room_expired'],
      ] as const) {
        const key = 'room:https://appai.info/ABC234';
        const view = loadApp(
          async () => response({ error }, status),
          `https://appai.info/games/guess-duel/?room=ab-c234&locale=${lang}&theme=dark#anchor`,
          () => serverTime,
          {
            ...(saved ? { [key]: JSON.stringify({ seat: 0, token: 'stale-token' }) } : {}),
            'room:ABC234': 'legacy-token',
            'guess-duel:online:ABC234': JSON.stringify({
              secret: '012',
              salt: 'stale',
              updatedAt: Date.now(),
            }),
          },
        );
        t.after(view.stop);
        await until(() => view.app.connecting === undefined);
        assert.equal(view.app.screen, 'roomClosed');
        assert.ok(view.html.includes(strings[lang].roomClosed));
        assert.ok(view.html.includes(strings[lang].recreateRoom));
        assert.equal([...view.html.matchAll(/data-action="createRoom"/g)].length, 1);
        assert.ok(!view.html.includes('data-action="joinRoom"'));
        for (const item of [key, 'room:ABC234', 'guess-duel:online:ABC234'])
          assert.equal(view.storage.getItem(item), null);
        const url = new URL(view.url);
        assert.equal(url.searchParams.has('room'), false);
        assert.equal(url.searchParams.get('locale'), lang);
        assert.equal(url.searchParams.get('theme'), 'dark');
        assert.equal(url.hash, '#anchor');
      }
    }
  }
});

test('a 120-second room starts at 2:00 at every Date-header phase and polls do not skip seconds', async () => {
  for (const phase of [0, 100, 499, 500, 999]) {
    let now = serverTime + phase + 3600000;
    const expiresAt = iso(serverTime + phase + 120000);
    const snapshot = waiting({ expiresAt });
    const client = new RoomsClient(
      undefined,
      async () =>
        response({ code: snapshot.code, ...joined(snapshot), changed: true }, 200, now - 3600000),
      undefined,
      undefined,
      () => now,
    );
    await client.create(snapshot.state);
    const countdown = new RoomCountdown(() => now);
    assert.equal(formatRemaining(countdown.remaining(expiresAt, client.serverNow())), '2:00');
    let previous = 120;
    for (let second = 1; second <= 120; second++) {
      // Cross whole-second header boundaries with a different fractional sample each poll.
      now += second % 2 ? 999 : 1001;
      await client.poll(snapshot.code, 'token', 0);
      const displayed = countdown.remaining(expiresAt, client.serverNow());
      assert.ok(
        previous - displayed === 0 || previous - displayed === 1,
        'polls cannot skip or add seconds',
      );
      assert.ok(Math.abs(displayed - remainingSeconds(expiresAt, now - 3600000)) <= 1);
      previous = displayed;
    }
    now += 1000;
    assert.equal(countdown.remaining(expiresAt, client.serverNow()), 0);
  }
});

test('clock corrections without a better sample cannot increase, skip or freeze displayed seconds; a new expiry can resync', () => {
  let now = 0;
  const countdown = new RoomCountdown(() => now);
  const expiresAt = iso(serverTime + 120000);
  assert.equal(countdown.remaining(expiresAt, serverTime + 500), 120);
  now += 1000;
  assert.equal(countdown.remaining(expiresAt, serverTime + 1500), 119);
  now += 1000;
  assert.equal(countdown.remaining(expiresAt, serverTime - 10000), 118);
  now += 1000;
  assert.equal(countdown.remaining(expiresAt, serverTime + 10000), 117);
  assert.equal(countdown.remaining(iso(serverTime + 180000), serverTime + 10500), 170);
});

test('a faster clock estimate may increase the display by at most one second once per expiry', () => {
  let now = 0;
  const countdown = new RoomCountdown(() => now);
  const expiresAt = iso(serverTime + 120000);
  assert.equal(countdown.remaining(expiresAt, serverTime + 2500, 3000), 118);
  now += 40;
  assert.equal(countdown.remaining(expiresAt, serverTime + 500, 40), 119);
  assert.equal(
    countdown.remaining(expiresAt, serverTime - 10000, 40),
    119,
    'same sample cannot increase it again',
  );
  now += 1000;
  assert.equal(
    countdown.remaining(expiresAt, serverTime - 9000, 30),
    118,
    'a second better sample cannot increase it again',
  );
  now += 1000;
  assert.equal(
    countdown.remaining(expiresAt, serverTime + 10000, 20),
    117,
    'forward corrections cannot skip a tick',
  );
  const newExpiry = iso(serverTime + 180000);
  assert.equal(countdown.remaining(newExpiry, serverTime + 10500, 20), 170);
  assert.equal(
    countdown.remaining(newExpiry, serverTime + 500, 10),
    171,
    'a new expiry allows one correction',
  );
});

test('slow creates converge after one fast poll within one second of truth and never freeze beyond 1.2 seconds', async () => {
  for (const skew of [-3600000, 0, 3600000]) {
    for (const phase of [0, 100, 499, 500, 950, 970, 999]) {
      let now = serverTime + phase;
      let rtt = 3000;
      let expiresAt = '';
      const client = new RoomsClient(
        undefined,
        async () => {
          now += rtt;
          expiresAt ||= iso(now + 120000);
          return response(
            { code: 'ABC234', ...joined(waiting({ expiresAt })), changed: false },
            200,
            now,
          );
        },
        undefined,
        undefined,
        () => now + skew,
      );
      await client.create(createGame());
      const countdown = new RoomCountdown(() => now + skew);
      const read = () => countdown.remaining(expiresAt, client.serverNow(), client.clockRoundTrip);
      let displayed = read();
      let lastChange = now;
      let increases = 0;
      const check = () => {
        const next = read();
        assert.ok(
          Math.abs(next - remainingSeconds(expiresAt, now)) <= 1,
          `phase ${phase}: ${next} vs truth ${remainingSeconds(expiresAt, now)}`,
        );
        if (next !== displayed) {
          assert.ok(now - lastChange <= 1200, `display froze for ${now - lastChange} ms`);
          assert.ok(
            Math.abs(next - displayed) <= 1,
            'no skipped seconds or large upward correction',
          );
          if (next > displayed) increases++;
          lastChange = now;
        }
        assert.ok(now - lastChange <= 1200, 'display keeps ticking');
        assert.ok(increases <= 1, 'at most one upward correction');
        displayed = next;
      };
      rtt = 40;
      await client.poll('ABC234', 'token', 0);
      check();
      for (let step = 1; step <= 100; step++) {
        now += 100;
        if (step % 12 === 0) {
          rtt = Math.max(10, rtt - 5);
          await client.poll('ABC234', 'token', 0);
        }
        check();
      }
    }
  }
});

test('the controller recovers a slow create on its first fast poll and keeps ticking without replacing the screen', async (t) => {
  let now = serverTime;
  let snapshot: Room;
  let release!: (r: Response) => void;
  const view = loadApp(
    async (url) => {
      if (String(url).endsWith('/api/rooms')) {
        now += 3000;
        snapshot = waiting({ expiresAt: iso(now + 120000) });
        return response({ code: snapshot.code, ...joined(snapshot) }, 200, now);
      }
      return new Promise<Response>((resolve) => (release = resolve));
    },
    undefined,
    () => now,
  );
  t.after(view.stop);
  await view.act({ type: 'mode', mode: 'online' });
  view.click('createRoom');
  await until(() => view.app.connecting === undefined);
  assert.equal(view.text('countdown'), 'Room closes in 1:58');
  now += 40;
  release(response({ changed: false }, 200, now));
  await until(() => view.app.session.client.clockRoundTrip === 40);
  const renders = view.renders;
  view.tick();
  assert.equal(view.text('countdown'), 'Room closes in 1:59');
  for (let second = 1; second <= 10; second++) {
    now += 1000;
    view.tick();
    assert.equal(view.text('countdown'), `Room closes in ${formatRemaining(119 - second)}`);
    assert.ok(Math.abs(119 - second - remainingSeconds(snapshot!.expiresAt, now)) <= 1);
    assert.equal(view.renders, renders);
    assert.equal(view.app.screen, 'waiting');
  }
});
