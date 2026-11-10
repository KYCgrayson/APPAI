import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/logic/game.ts';
import {
  formatRemaining,
  remainingSeconds,
  RoomCountdown,
  serverClockBounds,
  serverClockOffset,
  waitingRoomState,
  type ClockBounds,
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

test('clock calibration intersects equal and slower RTT samples instead of keeping only the fastest', async () => {
  for (const skew of [-600000, 0, 600000]) {
    let now = serverTime + 100;
    const samples = [
      { advance: 0, rtt: 0, date: serverTime, error: 400 },
      { advance: 400, rtt: 0, date: serverTime, error: 200 },
      { advance: 490, rtt: 100, date: serverTime + 1000, error: 205 },
      { advance: 100, rtt: 200, date: serverTime + 1000, error: 205 },
      { advance: 600, rtt: 0, date: serverTime + 1000, error: -40 },
    ];
    const client = new RoomsClient(
      undefined,
      async () => {
        const sample = samples[0];
        now += sample.rtt;
        return response({ code: 'ABC234', ...joined(waiting()), changed: false }, 200, sample.date);
      },
      undefined,
      undefined,
      () => now + skew,
    );
    await client.create(createGame());
    assert.equal(client.serverNow(), now + samples.shift()!.error);
    while (samples.length) {
      const sample = samples[0];
      now += sample.advance;
      await client.poll('ABC234', 'token', 0);
      assert.equal(client.serverNow(), now + sample.error);
      assert.equal(client.clockRoundTrip, 0, 'RTT remains a diagnostic, not the sample selector');
      samples.shift();
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
      response(
        String(url).endsWith('/join') ? joined(latest) : { changed: true, room: latest },
        200,
        now - 3600000,
      ),
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

test('Date intervals narrow across fractional phases, retain missing samples and reset disjoint bounds', () => {
  for (const skew of [-600000, 0, 600000]) {
    let bounds = serverClockBounds(
      new Date(serverTime).toUTCString(),
      serverTime + skew + 10,
      serverTime + skew + 10,
    )!;
    assert.deepEqual(bounds, { lower: -skew - 10, upper: -skew + 990 });
    bounds = serverClockBounds(
      new Date(serverTime).toUTCString(),
      serverTime + skew + 990,
      serverTime + skew + 990,
      bounds,
    )!;
    assert.deepEqual(bounds, { lower: -skew - 10, upper: -skew + 10 });
    assert.equal(serverClockBounds(null, 0, 0, bounds), bounds);
    assert.equal(serverClockBounds('invalid', 0, 0, bounds), bounds);
    const reset = serverClockBounds(
      new Date(serverTime + 10000).toUTCString(),
      serverTime + skew + 1000,
      serverTime + skew + 1300,
      bounds,
    );
    assert.deepEqual(reset, { lower: -skew + 8700, upper: -skew + 10000 });
  }
  // A touching upper bound is excluded by Date's [D, D + 1000) interval.
  assert.deepEqual(
    serverClockBounds(new Date(serverTime).toUTCString(), serverTime + 1000, serverTime + 1000, {
      lower: 0,
      upper: 1000,
    }),
    { lower: -1000, upper: 0 },
  );
});

test('Date offset bounds include request and response timestamps at RTT 0, 300 and 800 ms', () => {
  for (const skew of [-600000, 0, 600000]) {
    for (const rtt of [0, 300, 800]) {
      for (const phase of [0, 100, 499, 500, 999]) {
        const sentAt = serverTime + phase + skew;
        for (const stampAt of [sentAt - skew, sentAt - skew + rtt]) {
          const bounds = serverClockBounds(new Date(stampAt).toUTCString(), sentAt, sentAt + rtt)!;
          assert.ok(bounds.lower <= -skew && -skew < bounds.upper);
          assert.equal(bounds.upper - bounds.lower, 1000 + rtt);
        }
      }
    }
  }
});

test('interval intersections converge to millisecond precision even after an 800 ms create', async () => {
  for (const skew of [-600000, 0, 600000]) {
    let now = serverTime;
    let rtt = 800;
    const client = new RoomsClient(
      undefined,
      async () => {
        now += rtt;
        return response({ code: 'ABC234', ...joined(waiting()), changed: false }, 200, now);
      },
      undefined,
      undefined,
      () => now + skew,
    );
    await client.create(createGame());
    assert.equal(client.serverNow() - now, 100);
    now = serverTime + 999;
    rtt = 0;
    await client.poll('ABC234', 'token', 0);
    assert.equal(client.serverNow() - now, -399.5);
    now = serverTime + 1000;
    await client.poll('ABC234', 'token', 0);
    assert.equal(client.serverNow() - now, 0.5);
    now = serverTime + 1999;
    await client.poll('ABC234', 'token', 0);
    assert.equal(client.serverNow() - now, 0.5);
  }
});

test('a fractional expiry keeps 2:00 with 119.7 seconds left and uses the actual first boundary', () => {
  let now = serverTime + 1200;
  const expiresAt = iso(serverTime + 120900);
  const countdown = new RoomCountdown(() => now);
  assert.equal(formatRemaining(countdown.remaining(expiresAt, now)), '2:00');
  now = serverTime + 1899;
  assert.equal(countdown.remaining(expiresAt, now), 120);
  now++;
  assert.equal(countdown.remaining(expiresAt, now), 119);
  now += 1000;
  assert.equal(countdown.remaining(expiresAt, now), 118);
});

test('20 ms reads match truth in the first and last ten seconds for centered Date samples, all RTTs and skews', async () => {
  for (const skew of [-600000, 0, 600000]) {
    for (const rtt of [0, 300, 800]) {
      // The Date interval's midpoint is the real offset for this header phase.
      let now = serverTime + 500 - rtt / 2;
      const expiresAt = iso(now + 120000);
      const expiry = Date.parse(expiresAt);
      const client = new RoomsClient(
        undefined,
        async () => {
          now += rtt;
          return response({ code: 'ABC234', ...joined(waiting({ expiresAt })) }, 200, now);
        },
        undefined,
        undefined,
        () => now + skew,
      );
      await client.create(createGame());
      const countdown = new RoomCountdown(() => now + skew);
      const startedAt = now;
      let previous = countdown.remaining(expiresAt, client.serverNow());
      assert.equal(formatRemaining(previous), '2:00');
      let changedAt = now;
      let changes = 0;
      const matches = [0, 0];
      const samples = [0, 0];
      for (; now <= expiry + 1000; now += 20) {
        const displayed = countdown.remaining(expiresAt, client.serverNow());
        const truth = remainingSeconds(expiresAt, now);
        assert.equal(displayed, truth);
        assert.ok(displayed <= previous);
        if (displayed !== previous) {
          assert.equal(previous - displayed, 1, 'visible reads never skip a second');
          const duration = now - changedAt;
          if (changes) assert.ok(duration >= 750 && duration <= 1250, `duration ${duration}`);
          else assert.ok(duration <= 1250, 'the first second may be shorter');
          changes++;
          changedAt = now;
        }
        for (const window of [0, 1]) {
          if (window === 0 ? now - startedAt < 10000 : now >= expiry - 10000 && now < expiry) {
            samples[window]++;
            if (displayed === truth) matches[window]++;
          }
        }
        previous = displayed;
      }
      assert.equal(changes, 120);
      for (const window of [0, 1]) assert.ok(matches[window] / samples[window] >= 0.95);
    }
  }
});

test('full precision preserves partial seconds beyond two minutes without a cap', () => {
  let now = serverTime;
  const expiresAt = iso(now + 300137);
  const countdown = new RoomCountdown(() => now);
  assert.equal(countdown.remaining(expiresAt, now), 301);
  now += 136;
  assert.equal(countdown.remaining(expiresAt, now), 301);
  now++;
  assert.equal(countdown.remaining(expiresAt, now), 300);
});

test('no clock correction can increase the display, including faster estimates and reads after zero', () => {
  let now = serverTime;
  const countdown = new RoomCountdown(() => now);
  const expiresAt = iso(now + 120000);
  assert.equal(countdown.remaining(expiresAt, now + 500), 120);
  now += 500;
  assert.equal(countdown.remaining(expiresAt, now + 500), 119);
  assert.equal(countdown.remaining(expiresAt, now - 500), 119);
  now += 1000;
  assert.equal(countdown.remaining(expiresAt, now), 119);
  now += 500;
  assert.equal(countdown.remaining(expiresAt, now), 118);
  now += 118000;
  assert.equal(countdown.remaining(expiresAt, now), 0);
  assert.equal(countdown.remaining(expiresAt, now - 10000), 0);
  assert.equal(countdown.remaining(iso(now + 180000), now), 180, 'a changed API expiry resyncs');
});

test('hidden-tab elapsed time catches up immediately rather than decrementing once per read', () => {
  let now = serverTime + 333;
  const expiresAt = iso(now + 120000);
  const countdown = new RoomCountdown(() => now);
  assert.equal(countdown.remaining(expiresAt, now), 120);
  now += 18260;
  assert.equal(countdown.remaining(expiresAt, now), 102);
  now += 104000;
  assert.equal(countdown.remaining(expiresAt, now), 0);
});

test('zero follows the full-precision deadline within the Date offset error and one display tick', async () => {
  for (const phase of [0, 100, 499, 500, 900, 999]) {
    for (const skew of [-600000, 0, 600000]) {
      for (const rtt of [0, 300, 800]) {
        let now = serverTime + phase;
        const expiresAt = iso(now + 120000);
        const expiry = Date.parse(expiresAt);
        const client = new RoomsClient(
          undefined,
          async () => {
            now += rtt;
            return response({ code: 'ABC234', ...joined(waiting({ expiresAt })) }, 200, now);
          },
          undefined,
          undefined,
          () => now + skew,
        );
        await client.create(createGame());
        const error = client.serverNow() - now;
        const countdown = new RoomCountdown(() => now + skew);
        let previous = countdown.remaining(expiresAt, client.serverNow());
        assert.ok(Math.abs(previous - remainingSeconds(expiresAt, now)) <= 1);
        let zeroAt: number | undefined;
        for (; now <= expiry + 1000; now += 20) {
          const displayed = countdown.remaining(expiresAt, client.serverNow());
          assert.ok(Math.abs(displayed - remainingSeconds(expiresAt, now)) <= 1);
          assert.ok(displayed <= previous && previous - displayed <= 1);
          if (!displayed && zeroAt === undefined) zeroAt = now;
          previous = displayed;
        }
        assert.ok(zeroAt !== undefined);
        assert.ok(zeroAt >= expiry - error, 'never zero before the calibrated deadline');
        assert.ok(zeroAt < expiry - error + 20, 'zero on the next display tick');
        assert.ok(zeroAt <= expiry + 1000);
      }
    }
  }
});

test('whole-second Date samples alone cannot guarantee 95% accuracy for arbitrary server phases', () => {
  // Both offsets can produce these same headers with 800 ms RTT: Date can be
  // stamped at request receipt or response send. More identical samples add no precision.
  let bounds: ClockBounds | undefined;
  for (let sentAt = 0; sentAt <= 20000; sentAt += 2000) {
    bounds = serverClockBounds(
      new Date(serverTime + sentAt + 900).toUTCString(),
      sentAt,
      sentAt + 800,
      bounds,
    );
  }
  assert.ok(bounds!.lower <= serverTime + 100 && serverTime + 900 < bounds!.upper);
  const expiresAt = iso(serverTime + 120900);
  let disagreements = 0;
  for (let elapsed = 0; elapsed < 10000; elapsed += 20) {
    if (
      remainingSeconds(expiresAt, serverTime + 900 + elapsed) !==
      remainingSeconds(expiresAt, serverTime + 1700 + elapsed)
    )
      disagreements++;
  }
  assert.ok(disagreements / 500 > 0.1, 'one display cannot be 95% correct for both clocks');
});

test('the controller follows fractional boundaries at 20 ms without screen replacement or extra polling', async (t) => {
  let now = serverTime + 350;
  let snapshot: Room;
  let polls = 0;
  const view = loadApp(
    async (url) => {
      if (String(url).endsWith('/api/rooms')) {
        const createdAt = now;
        now += 300;
        snapshot = waiting({ expiresAt: iso(createdAt + 120000) });
        return response({ code: snapshot.code, ...joined(snapshot) }, 200, now);
      }
      polls++;
      return new Promise<Response>(() => {});
    },
    undefined,
    () => now,
  );
  t.after(view.stop);
  await view.act({ type: 'mode', mode: 'online' });
  view.click('createRoom');
  await until(() => view.app.connecting === undefined);
  assert.equal(view.text('countdown'), 'Room closes in 2:00');
  const renders = view.renders;
  const before = polls;
  const startedAt = now;
  for (; now - startedAt < 10000; now += 20) {
    view.tick(20);
    assert.equal(
      view.text('countdown'),
      `Room closes in ${formatRemaining(remainingSeconds(snapshot!.expiresAt, now))}`,
    );
    assert.equal(view.renders, renders);
    assert.equal(polls, before, 'display updates do not poll');
  }
  now = Date.parse(snapshot!.expiresAt);
  view.tick(20);
  assert.equal(view.text('countdown'), 'Room closes in 0:00');
  assert.equal(polls, before, 'expiry checks retain their one-second cadence');
  view.tick(1000);
  assert.equal(polls, before + 1, 'the existing zero check still requests confirmation');
  assert.equal(view.app.screen, 'waiting');
});

test('returning to a visible tab updates its text immediately while its confirming poll is pending', async (t) => {
  let now = serverTime + 500;
  const snapshot = waiting({ expiresAt: iso(now + 120000) });
  const view = loadApp(
    async (url) =>
      String(url).endsWith('/api/rooms')
        ? response({ code: snapshot.code, ...joined(snapshot) }, 200, now)
        : new Promise<Response>(() => {}),
    undefined,
    () => now,
  );
  t.after(view.stop);
  await view.act({ type: 'mode', mode: 'online' });
  view.click('createRoom');
  await until(() => view.app.connecting === undefined);
  view.setHidden(true);
  now += 18260;
  view.setHidden(false);
  assert.equal(view.text('countdown'), 'Room closes in 1:42');
  assert.equal(view.app.screen, 'waiting');
});
