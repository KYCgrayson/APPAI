import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomsClient, RoomError, normalizeCode, type Room } from '../src/net/rooms.ts';
import { processMoves, OnlineSession } from '../src/net/online.ts';
import { createGame, applyCommit, applyGuess, applyReply, type Move } from '../src/logic/game.ts';
function mock(responses: { status?: number; data: any; headers?: Record<string, string> }[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    const r = responses.shift();
    assert.ok(r, 'unexpected fetch');
    return new Response(JSON.stringify(r.data), {
      status: r.status ?? 200,
      headers: { 'Content-Type': 'application/json', ...r.headers },
    });
  }) as typeof fetch;
  return { calls, fetcher };
}
const room = (overrides: Partial<Room> = {}): Room => ({
  code: 'ABC234',
  game: 'guess-duel',
  version: 0,
  state: createGame({ id: 'room' }),
  turn: 0,
  seats: [
    { seat: 0, joined: true, online: true, idleSeconds: 0 },
    { seat: 1, joined: true, online: true, idleSeconds: 0 },
  ],
  moves: [],
  status: 'playing',
  expiresAt: '2030-01-01',
  ...overrides,
});
test('rooms create and join request shapes and saved tokens', async () => {
  const r = room(),
    m = mock([
      { status: 201, data: { code: r.code, seat: 0, token: 'secret-token', room: r } },
      { data: { seat: 1, token: 'guest-token', room: r } },
    ]),
    saved = new Map<string, string>();
  const c = new RoomsClient('https://example.test/path', m.fetcher, {
    getItem: (k) => saved.get(k) ?? null,
    setItem: (k, v) => {
      saved.set(k, v);
    },
    removeItem: (k) => {
      saved.delete(k);
    },
  });
  await c.create(r.state);
  assert.equal(m.calls[0].url, 'https://example.test/api/rooms');
  assert.deepEqual(JSON.parse(m.calls[0].init.body as string), {
    game: 'guess-duel',
    seats: 2,
    state: r.state,
    turn: 0,
  });
  assert.equal(m.calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(saved.get('room:https://example.test/ABC234')!), { token: 'secret-token', seat: 0 });
  await c.join(' ab-c2 34 ');
  assert.equal(m.calls[1].url, 'https://example.test/api/rooms/ABC234/join');
  assert.deepEqual(JSON.parse(m.calls[1].init.body as string), {});
});
test('poll, move and skip use Bearer headers and contract fields', async () => {
  const r = room(),
    m = mock([{ data: { changed: true, room: r } }, { data: { room: r } }, { data: { room: r } }]),
    c = new RoomsClient(undefined, m.fetcher);
  await c.poll(r.code, 'token', 4);
  assert.equal(m.calls[0].url, 'https://appai.info/api/rooms/ABC234?since=4');
  assert.equal(m.calls[0].init.method, 'GET');
  const body = {
    version: 4,
    move: { t: 'guess', g: '012' } as Move,
    state: r.state,
    nextTurn: 1 as const,
  };
  await c.sendMove(r.code, 'token', body);
  await c.skip(r.code, 'token', 5);
  for (const call of m.calls)
    assert.equal((call.init.headers as any).Authorization, 'Bearer token');
  assert.deepEqual(JSON.parse(m.calls[1].init.body as string), body);
  assert.deepEqual(JSON.parse(m.calls[2].init.body as string), { version: 5, skip: true });
});
test('404 clears room token including poll query suffix', async () => {
  let removed = '';
  const m = mock([{ status: 404, data: { error: 'room_not_found' } }]),
    c = new RoomsClient(undefined, m.fetcher, {
      getItem: () => null,
      setItem() {},
      removeItem(k) {
        removed = k;
      },
    });
  await assert.rejects(
    c.poll('ABC234', 'bad', 3),
    (e) => e instanceof RoomError && e.status === 404,
  );
  assert.equal(removed, 'room:https://appai.info/ABC234');
});
test('409 conflict refetches and retries once with rebased state', async () => {
  const r = room({ version: 9 }),
    m = mock([
      { status: 409, data: { error: 'version_conflict' } },
      { data: { changed: true, room: r } },
      { data: { room: { ...r, version: 10 } } },
    ]),
    c = new RoomsClient(undefined, m.fetcher);
  await c.sendMove('ABC234', 'token', { version: 2, skip: true }, (latest) => ({
    version: latest.version,
    skip: true,
  }));
  assert.equal(m.calls.length, 3);
  assert.equal(JSON.parse(m.calls[2].init.body as string).version, 9);
});
test('409 supplied room avoids extra refetch; no endless conflict retry', async () => {
  const r = room({ version: 3 }),
    m = mock([
      { status: 409, data: { error: 'version_conflict', room: r } },
      { status: 409, data: { error: 'version_conflict', room: r } },
    ]),
    c = new RoomsClient(undefined, m.fetcher);
  await assert.rejects(c.skip('ABC234', 'token', 1));
  assert.equal(m.calls.length, 2);
});
test('429 honors Retry-After then retries', async () => {
  const delays: number[] = [],
    m = mock([
      { status: 429, headers: { 'Retry-After': '3' }, data: { error: 'rate_limited' } },
      { data: { changed: false, version: 1, seats: [] } },
    ]),
    c = new RoomsClient(undefined, m.fetcher, undefined, async (ms) => {
      delays.push(ms);
    });
  await c.poll('ABC234', 'token', 0);
  assert.deepEqual(delays, [3000]);
  assert.equal(m.calls.length, 2);
});
test('unavailable, network error and invalid API protocols', async () => {
  const m = mock([{ status: 503, data: { error: 'unavailable' } }]);
  await assert.rejects(
    new RoomsClient(undefined, m.fetcher).create(createGame()),
    (e) => e instanceof RoomError && e.error === 'unavailable',
  );
  const bad = (async () => {
    throw new TypeError('CORS');
  }) as typeof fetch;
  await assert.rejects(
    new RoomsClient(undefined, bad).join('ABC234'),
    (e) => e instanceof RoomError && e.status === 503,
  );
  assert.throws(() => new RoomsClient('javascript:alert(1)'));
  assert.equal(normalizeCode('ab c-234'), 'ABC234');
  assert.throws(() => normalizeCode('IIIIII'));
});
test('all moves between polls are processed in order and invalid peer moves ignored', () => {
  const s = createGame({ id: 'test' }),
    moves: Room['moves'] = [
      { version: 1, seat: 0, move: { t: 'commit', h: 'a'.repeat(64) } },
      { version: 2, seat: 1, move: { t: 'commit', h: 'b'.repeat(64) } },
      { version: 3, seat: 1, move: { t: 'guess', g: '123' } },
      { version: 4, seat: 0, move: { t: 'guess', g: '012' } },
      { version: 5, seat: 1, move: { t: 'reply', r: '0A1B' } },
    ];
  const result = processMoves(s, moves.reverse(), 0);
  assert.equal(result.since, 5);
  assert.deepEqual(result.state.history[0], [{ g: '012', r: { a: 0, b: 1 } }]);
  assert.equal(result.state.history[1].length, 0);
  assert.equal(processMoves(result.state, moves, 5).state, result.state);
});
test('online session commits hand setup turn to the guest', async () => {
  const r = room({ status: 'waiting' }),
    m = mock([
      {
        data: {
          room: { ...r, version: 1, state: applyCommit(r.state, 0, 'a'.repeat(64)), turn: 1 },
        },
      },
    ]),
    c = new RoomsClient(undefined, m.fetcher);
  const s = new OnlineSession(
    c,
    'ABC234',
    'token',
    0,
    r,
    () => {},
    () => {},
  );
  await s.send({ t: 'commit', h: 'a'.repeat(64) });
  assert.equal(JSON.parse(m.calls[0].init.body as string).nextTurn, 1);
});
test('online reveal passes turn so both players can reveal before closing', async () => {
  let state = applyCommit(applyCommit(createGame(), 0, 'a'.repeat(64)), 1, 'b'.repeat(64));
  state = applyReply(applyGuess(state, 0, '012'), 1, '3A0B');
  state = applyReply(applyGuess(state, 1, '345'), 0, '0A0B');
  const r = room({ state, version: 7 }),
    m = mock([{ data: { room: r } }]);
  const s = new OnlineSession(
    new RoomsClient(undefined, m.fetcher),
    'ABC234',
    'token',
    0,
    r,
    () => {},
    () => {},
  );
  await s.send({ t: 'reveal', s: '345', salt: 'a'.repeat(32) });
  assert.equal(JSON.parse(m.calls[0].init.body as string).end, false);
  assert.equal(JSON.parse(m.calls[0].init.body as string).nextTurn, 1);
});
