import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, validateGame } from '../src/logic.js';
import { RoomsClient, RoomError, normalizeCode, apiBase, signInUrl, validateRoom, OnlineSession, canSkip, pollDelay } from '../src/rooms.js';
import { FakeServer, MemoryStorage } from './fake-server.mjs';

async function setup(size = 9) {
  const server = new FakeServer(), storage = new MemoryStorage();
  const black = new RoomsClient({ base: 'https://appai.info', fetcher: server.fetch, storage });
  const white = new RoomsClient({ base: 'https://appai.info', fetcher: server.fetch, storage: new MemoryStorage() });
  const a = await black.create(newGame(size)), b = await white.join(a.code);
  const room = validateRoom((await black.poll(a.code, a.token, -1)).room);
  const sessions = [new OnlineSession(black, a.code, a, room), new OnlineSession(white, a.code, b, b.room)];
  return { server, storage, black, white, a, b, sessions };
}
test('create/join/poll through a full game: both clients validate every move', async () => {
  const { sessions: [black, white], server, storage, a } = await setup();
  const indices = [0, 72, 1, 74, 2, 76, 3, 78, 4];
  for (let n = 0; n < indices.length; n++) {
    const [current, other] = n % 2 ? [white, black] : [black, white];
    await current.send(indices[n]); await other.poll();
    assert.deepEqual(black.room.state, white.room.state);
    validateGame(black.room.state);
  }
  assert.equal(black.room.state.winner, 0); assert.equal(white.room.status, 'finished');
  assert.equal(server.room.state.board.length, 81); assert.equal(server.room.state.moves.length, 9);
  assert.ok(JSON.stringify(server.room.state).length < 8192);
  assert.equal(server.requests[0].credentials, 'include');
  assert.equal(JSON.parse(server.requests[0].body).game, 'five-in-a-row');
  assert.equal(JSON.parse(server.requests[0].body).seats, 2);
  assert.ok(storage.getItem(black.client.tokenKey(a.code)).includes(a.token));
  assert.ok(server.requests.every((request) => !request.url.includes('token')));
});
test('the fake API accepts illegal rules; the receiving client rejects them and preserves its board', async () => {
  const { sessions: [black, white], server } = await setup();
  await black.send(0); await white.poll();
  const before = black.room;
  // Pretend white overwrote an occupied intersection and sent the result.
  server.room.version++;
  server.room.state.board = '2' + server.room.state.board.slice(1);
  server.room.state.turn = 0; server.room.turn = 0;
  server.room.moves.push({ version: server.room.version, seat: 1, move: { index: 0 } });
  await assert.rejects(black.poll(), (e) => e.error === 'invalid_state');
  assert.equal(black.room, before);
});
test('a legal rewritten history and a forged move log are rejected', async () => {
  const { sessions: [black], server } = await setup();
  await black.send(0);
  const raw = structuredClone(server.room);
  raw.state.moves[0][0] = 1; raw.state.board = '01' + raw.state.board.slice(2); raw.moves[0].move.index = 1;
  assert.throws(() => validateRoom(raw, black.room), /invalid_state/);
  const forged = structuredClone(server.room); forged.moves[0].seat = 1;
  assert.throws(() => validateRoom(forged), /invalid_state/);
});
test('version conflicts revalidate the move on the latest board before retrying', async () => {
  const { sessions: [black], server } = await setup();
  // A stale lobby version can safely rebase because the same seat still has its turn.
  black.room = { ...black.room, version: 1 };
  await black.send(0);
  assert.equal(black.room.version, 3);
  assert.equal(server.requests.filter((r) => r.url.endsWith('/moves')).length, 2);
  assert.equal(black.room.state.moves.length, 1);
});
test('not_your_turn adopts the latest valid board and does not retry a stale placement', async () => {
  const { sessions: [black, white], server } = await setup();
  await black.send(0);
  await white.poll();
  await white.send(72);
  assert.equal(white.room.state.moves.length, 2);
  const before = black.room.state.board;
  await assert.rejects(black.send(1), /not_your_turn/);
  assert.equal(black.room.state.board, before);
  // A server-side not_your_turn error also carries the current snapshot.
  await black.poll();
  const queued = server.response({ error: 'not_your_turn', room: server.room }, 409);
  server.queued.push(queued);
  await assert.rejects(black.send(1), (e) => e.error === 'not_your_turn');
  assert.equal(black.room.version, server.room.version);
});
test('idle skip handles numeric seat zero and the returning player keeps their stones', async () => {
  const { sessions: [black, white], server } = await setup();
  server.room.seats[0].idleSeconds = 120; server.room.seats[0].online = false;
  await white.poll(); assert.ok(canSkip(white.room, 1));
  await white.send(null, true); await black.poll();
  assert.equal(white.room.turn, 1); assert.deepEqual(white.room.state.moves, [[-1, 0]]);
  const sent = JSON.parse(server.requests.findLast((r) => r.url.endsWith('/moves')).body);
  assert.deepEqual(Object.keys(sent).sort(), ['skip', 'version']);
  await white.send(40); await black.poll(); await black.send(41); await white.poll();
  assert.equal(white.room.state.board[40], '2'); assert.equal(white.room.state.board[41], '1');
  assert.deepEqual(black.room.state, white.room.state);
});
test('cannot skip an active opponent, self, or a waiting room', async () => {
  const { sessions: [black, white] } = await setup();
  assert.equal(canSkip(black.room, 0), false); assert.equal(canSkip(white.room, 1), false);
  await assert.rejects(white.send(null, true), /not_your_turn/);
  assert.equal(canSkip({ ...white.room, status: 'waiting', seats: [{ seat: 0, idleSeconds: 200 }] }, 1), false);
});
test('reload restores a snapshot after more than 20 moves and after more than 20 skips', async () => {
  const { sessions: [black, white], black: client, a, server } = await setup(15);
  const points = [[], []];
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) points[(Math.floor(c / 2) + r) % 2].push(r * 15 + c);
  for (let n = 0; n < 30; n++) {
    const [current, other] = n % 2 ? [white, black] : [black, white];
    await current.send(points[n % 2].shift()); await other.poll();
  }
  assert.equal(server.room.moves.length, 20);
  const credential = client.credential(a.code);
  let raw = (await client.poll(a.code, credential.token, -1)).room;
  assert.deepEqual(validateRoom(raw).state, black.room.state);
  for (let n = 0; n < 25; n++) {
    const turn = server.room.turn, current = turn === 0 ? white : black;
    server.room.seats[turn].idleSeconds = 121;
    await current.poll(); await current.send(null, true);
  }
  raw = (await client.poll(a.code, credential.token, -1)).room;
  const restored = validateRoom(raw);
  assert.equal(restored.state.moves.length, 55); assert.equal(restored.state.board, black.room.state.board);
  assert.equal(restored.turn, server.room.turn);
  validateGame(restored.state);
});
test('room authentication errors, missing rooms and token scoping', async () => {
  const { server, black, a, storage } = await setup();
  const otherOrigin = new RoomsClient({ base: 'https://other.example', fetcher: server.fetch, storage });
  assert.equal(otherOrigin.credential(a.code), null);
  assert.equal(black.credential(a.code).seat, 0);
  await assert.rejects(black.poll(a.code, 'wrong', -1), (e) => e.status === 404 && e.error === 'room_not_found');
  assert.equal(black.credential(a.code), null);
  server.signedIn = false;
  await assert.rejects(black.create(newGame()), (e) => e.status === 401 && e.error === 'login_required');
  server.queued.push(new Error('offline'));
  await assert.rejects(black.create(newGame()), (e) => e.status === 503 && e.error === 'unavailable');
});
test('sign-in mirrors the reference login flow and returns to this game', () => {
  const url = new URL(signInUrl('?lang=hi&room=ABC234'));
  assert.equal(url.origin, 'https://appai.info'); assert.equal(url.pathname, '/login');
  assert.equal(url.searchParams.get('callbackUrl'), '/games/five-in-a-row/?lang=hi&room=ABC234');
});
test('join normalizes codes; start follows server errors; invalid codes never fetch', async () => {
  const server = new FakeServer();
  const client = new RoomsClient({ fetcher: server.fetch });
  const a = await client.create(newGame());
  await assert.rejects(client.start(a.code, a.token), /room_not_ready/);
  const b = await client.join('ab-c 234');
  assert.equal(b.seat, 1); assert.equal(b.room.status, 'playing');
  await assert.rejects(client.start(a.code, a.token), /already_started/);
  await assert.rejects(client.join(a.code), /room_full/);
  const count = server.requests.length;
  await assert.rejects(client.join('invalid'), /invalid_code/);
  assert.equal(server.requests.length, count);
  assert.equal(normalizeCode(' ab-c 234 '), 'ABC234');
  assert.throws(() => normalizeCode('OOOOOO'), /invalid_code/);
  assert.equal(apiBase({ hostname: 'localhost', origin: 'http://localhost:5181' }), 'https://appai.info');
  assert.equal(apiBase({ hostname: 'www.appai.info', origin: 'https://www.appai.info' }), 'https://www.appai.info');
  assert.throws(() => new RoomsClient({ base: 'file:///tmp' }), /invalid_origin/);
});
test('429 honors numeric and HTTP-date Retry-After, with only one retry', async () => {
  for (const [header, expected] of [['2', 2000], ['Tue, 10 Nov 2026 00:00:03 GMT', 3000], ['bad', 1000]]) {
    const sleeps = [], server = new FakeServer();
    const client = new RoomsClient({ fetcher: server.fetch, sleep: async (ms) => { sleeps.push(ms); }, now: () => Date.parse('2026-11-10T00:00:00Z') });
    server.queued.push(server.response({ error: 'rate_limited' }, 429, { 'Retry-After': header }));
    await client.create(newGame()); assert.deepEqual(sleeps, [expected]);
  }
  const server = new FakeServer(), client = new RoomsClient({ fetcher: server.fetch, sleep: async () => {} });
  server.queued.push(server.response({ error: 'rate_limited' }, 429), server.response({ error: 'rate_limited' }, 429));
  await assert.rejects(client.create(newGame()), (e) => e instanceof RoomError && e.status === 429);
  assert.equal(server.requests.length, 2);
});
test('visibility-aware polling has one timer, and stopping ignores a delayed reply', async () => {
  const { black, a, sessions } = await setup();
  let hidden = false, timers = [], changes = 0;
  const session = new OnlineSession(black, a.code, a, sessions[0].room, () => changes++, () => {}, {
    hidden: () => hidden, schedule: (fn, delay) => { const timer = { fn, delay }; timers.push(timer); return timer; },
    cancel: (timer) => { timers = timers.filter((item) => item !== timer); },
  });
  session.start(); await new Promise(setImmediate);
  assert.equal(timers.length, 1); assert.equal(timers[0].delay, 1200);
  hidden = true; session.refresh(); await new Promise(setImmediate);
  assert.equal(timers.length, 1); assert.equal(timers[0].delay, 15000);
  assert.equal(pollDelay(false), 1200); assert.equal(pollDelay(true), 15000);
  let resolve;
  black.fetcher = () => new Promise((r) => { resolve = r; });
  const poll = session.poll(); session.stop();
  const before = changes;
  resolve(Response.json({ changed: true, room: {} })); await poll;
  assert.equal(changes, before); assert.equal(timers.length, 0);
});
test('a move waits for the in-flight poll and never races it', async () => {
  const { sessions: [black], server } = await setup();
  const fetcher = black.client.fetcher;
  let resolve;
  black.client.fetcher = (...args) => args[0].includes('?since=') ? new Promise((r) => { resolve = () => fetcher(...args).then(r); }) : fetcher(...args);
  const polling = black.poll(), sending = black.send(0);
  resolve(); await Promise.all([polling, sending]);
  assert.equal(black.room.state.moves.length, 1); assert.equal(server.room.version, 3);
});
test('invalid payloads, wrong game, turn and finish status are rejected', async () => {
  const { server } = await setup();
  for (const change of [{ game: 'other' }, { turn: 1 }, { version: -1 }, { status: 'finished' }, { seats: [] }, { moves: [{}] }]) {
    assert.throws(() => validateRoom({ ...structuredClone(server.room), ...change }), /invalid_state/);
  }
});
