import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomsClient, OnlineSession, RoomError, normalizeCode, canSkip, pollDelay, initialOnline, apiBase } from '../src/rooms.js';
import { createGame, reduceMove } from '../src/logic.js';
import { rollDie } from '../src/ai.js';
import { FakeServer, memoryStorage } from './fake-server.mjs';

async function setup(n = 2, options = {}) {
  const server = new FakeServer(), storage = memoryStorage();
  const client = new RoomsClient({ fetcher: server.fetch, storage });
  const created = await client.create(createGame({ ...options, players: Array(n).fill('human') }));
  const sessions = [new OnlineSession(client, created)];
  for (let i = 1; i < n; i++) {
    const data = await client.join(created.code);
    // Separate browsers have separate localStorage in real life.
    sessions.push(new OnlineSession(new RoomsClient({ fetcher: server.fetch, storage: memoryStorage() }), data));
  }
  for (const s of sessions) { s.stopped = false; await s.poll(); }
  return { server, client, sessions, code: created.code, storage };
}
test('room codes normalize; origins cannot be selected by a URL query', () => {
  assert.equal(normalizeCode(' ab-c2 34 '), 'ABC234');
  for (const code of ['OIL001', 'ABC', '../ABC234', '<bad>']) assert.throws(() => normalizeCode(code));
  assert.equal(apiBase({ hostname: 'localhost', origin: 'http://localhost:5184' }), 'https://appai.info');
  assert.equal(apiBase({ hostname: 'appai.info', origin: 'https://appai.info' }), 'https://appai.info');
  assert.throws(() => new RoomsClient({ base: 'file:///tmp/a' }));
});
test('create, join, automatic start and a complete four-player room game', async () => {
  const { sessions, server, code } = await setup(4, { board: 'short', again: true });
  let seed = 31337;
  const random = { getRandomValues(a) { a[0] = seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; } };
  let rolls = 0;
  while (sessions[0].state.status !== 'finished' && rolls++ < 1000) {
    const current = sessions[sessions[0].state.turn]; await current.action('roll', { roll: rollDie(random) });
    for (const s of sessions) await s.poll();
    for (const s of sessions) assert.deepEqual(s.state, sessions[0].state);
  }
  assert.ok(rolls < 1000); assert.equal(server.rooms.get(code).status, 'finished');
  assert.equal(server.calls[0].credentials, 'include'); assert.equal(JSON.parse(server.calls[0].body).game, 'snakes-and-ladders');
  assert.ok(server.calls.every(c => !c.url.includes('token-')));
});
test('host can start a four-seat lobby with two players and both clients shrink', async () => {
  const server = new FakeServer(), client = new RoomsClient({ fetcher: server.fetch });
  const data = await client.create(createGame({ players: Array(4).fill('human') }));
  const host = new OnlineSession(client, data); const guest = new OnlineSession(client, await client.join(data.code));
  host.stopped = guest.stopped = false;
  await assert.rejects(() => guest.action('start'), e => e.error === 'not_host');
  await host.action('start'); await guest.poll();
  assert.equal(host.state.players.length, 2); assert.deepEqual(host.state, guest.state);
  await host.action('roll', { roll: 3 }); await guest.poll();
  await guest.action('roll', { roll: 4 }); await host.poll(); assert.deepEqual(host.state, guest.state);
});
test('start requires two joined seats and joining a full room fails', async () => {
  const server = new FakeServer(), client = new RoomsClient({ fetcher: server.fetch });
  const data = await client.create(createGame());
  await assert.rejects(() => client.start(data.code, data.token), e => e.error === 'room_not_ready');
  await client.join(data.code); await assert.rejects(() => client.join(data.code), e => e.error === 'room_full');
});
test('incremental replay validates every roll and reaches the same state', async () => {
  const { sessions } = await setup(2, { again: true });
  await sessions[0].action('roll', { roll: 6 }); await sessions[0].action('roll', { roll: 5 });
  await sessions[1].poll(); assert.deepEqual(sessions[1].state, sessions[0].state); assert.equal(sessions[1].state.turns, 2);
});
test('version conflict refreshes without silently rerolling or resending', async () => {
  const { client, code, sessions } = await setup(2, { again: true });
  const stale = new OnlineSession(client, { code, token: sessions[0].token, seat: 0, room: sessions[0].room, checkpoint: sessions[0].checkpoint() });
  await sessions[0].action('roll', { roll: 6 });
  await assert.rejects(() => stale.action('roll', { roll: 2 }), e => e.error === 'version_conflict');
  assert.deepEqual(stale.state, sessions[0].state); assert.equal(stale.state.turns, 1);
});
test('not_your_turn response synchronizes the latest board', async () => {
  const { sessions, server, code } = await setup();
  // A transport proxy supplies the API's documented race error and latest room.
  const next = reduceMove(sessions[0].state, 0, { roll: 1 }), room = server.rooms.get(code);
  room.moves.push({ version: ++room.version, seat: 0, move: { roll: 1 } }); room.state = next; room.turn = 1;
  server.nextReply = server.response(409, { error: 'not_your_turn', room: server.public(room) });
  await assert.rejects(() => sessions[0].action('roll', { roll: 2 }), e => e.error === 'not_your_turn');
  assert.deepEqual(sessions[0].state, next);
});
test('idle threshold is 120 seconds; skipped seat zero is handled as a number', async () => {
  const { sessions, server, code } = await setup();
  const room = server.rooms.get(code); room.seats[0].idleSeconds = 119;
  await sessions[1].poll(); assert.equal(canSkip(sessions[1].room, 1), false);
  room.seats[0].idleSeconds = 120; await sessions[1].poll(); assert.equal(canSkip(sessions[1].room, 1), true);
  await sessions[1].action('skip'); assert.equal(sessions[1].state.turn, 1); assert.deepEqual(sessions[1].state.positions, [0, 0]);
  const body = JSON.parse(server.calls.at(-1).body); assert.deepEqual(Object.keys(body).sort(), ['skip', 'version']);
  await sessions[0].poll(); await sessions[1].action('roll', { roll: 3 }); await sessions[0].poll();
  assert.deepEqual(sessions[0].state, sessions[1].state);
});
test('received illegal roll is rejected even if the server accepted it', async () => {
  const { sessions, server, code } = await setup(); const before = structuredClone(sessions[1].state), room = server.rooms.get(code);
  room.moves.push({ version: ++room.version, seat: 0, move: { roll: 7 } });
  await assert.rejects(() => sessions[1].poll(), e => e.error === 'invalid_state'); assert.deepEqual(sessions[1].state, before);
});
test('legal-looking forged snapshots do not override replayed rules', async () => {
  const { sessions, server, code } = await setup(); const room = server.rooms.get(code);
  // A real move log with a forged, otherwise well-formed state and matching last.
  room.moves.push({ version: ++room.version, seat: 0, move: { roll: 3 } });
  room.state = { ...room.state, positions: [90, 0], turns: 1, turn: 1 }; room.turn = 1;
  await assert.rejects(() => sessions[1].poll(), e => e.error === 'invalid_state'); assert.equal(sessions[1].state.positions[0], 0);
});
test('wrong-seat moves, forged next turns and forged end are rejected', async () => {
  for (const kind of ['seat', 'turn', 'end']) {
    const { sessions, server, code } = await setup(); const room = server.rooms.get(code);
    room.state = reduceMove(room.state, 0, { roll: 3 }); room.turn = room.state.turn;
    room.moves.push({ version: ++room.version, seat: kind === 'seat' ? 1 : 0, move: { roll: 3 } });
    if (kind === 'turn') room.turn = 0; if (kind === 'end') room.status = 'finished';
    await assert.rejects(() => sessions[1].poll(), e => e.error === 'invalid_state');
  }
});
test('missing move history fails closed rather than accepting an unverified snapshot', async () => {
  const { sessions, server, code } = await setup(2, { again: true });
  for (let i = 0; i < 23; i++) await sessions[0].action('roll', { roll: 6 });
  assert.equal(server.rooms.get(code).moves.length, 20);
  await assert.rejects(() => sessions[1].poll(), e => e.error === 'history_gap');
});
test('reload restores per-room token and validated checkpoint including skips', async () => {
  const { sessions, client, code } = await setup();
  await sessions[0].action('roll', { roll: 2 });
  const cached = client.read(code), { room } = await client.poll(code, cached.token, -1);
  const resumed = new OnlineSession(client, { ...cached, code, room });
  assert.deepEqual(resumed.state, sessions[0].state); assert.equal(resumed.version, sessions[0].version);
  assert.equal(new RoomsClient({ base: 'https://other.example', storage: client.storage }).read(code), null);
});
test('404 removes seat credentials; authentication/network failures are typed', async () => {
  const { server, client, code, sessions, storage } = await setup(); server.rooms.delete(code);
  await assert.rejects(() => client.poll(code, sessions[0].token, 0), e => e.error === 'room_not_found');
  assert.equal(storage.getItem(client.tokenKey(code)), null);
  server.signedIn = false; await assert.rejects(() => client.create(createGame()), e => e.status === 401);
  await assert.rejects(() => new RoomsClient({ fetcher: async () => { throw Error('offline'); } }).create(createGame()), e => e.status === 503);
});
test('429 honors Retry-After seconds and dates with injectable sleep', async () => {
  for (const header of ['2', 'Wed, 01 Jan 2025 00:00:03 GMT']) {
    let calls = 0; const delays = [];
    const client = new RoomsClient({ now: () => Date.parse('2025-01-01T00:00:00Z'), sleep: async ms => delays.push(ms), fetcher: async () => ++calls === 1 ? new Response('{}', { status: 429, headers: { 'Retry-After': header } }) : new Response('{"ok":true}') });
    assert.deepEqual(await client.request('/ABC234'), { ok: true }); assert.deepEqual(delays, [header === '2' ? 2000 : 3000]);
  }
});
test('a second 429 returns an error after the required wait', async () => {
  let sleeps = 0;
  const client = new RoomsClient({ sleep: async () => sleeps++, fetcher: async () => new Response('{"error":"rate_limited"}', { status: 429 }) });
  await assert.rejects(() => client.request('/ABC234'), e => e.error === 'rate_limited'); assert.equal(sleeps, 1);
});
test('polling follows visibility and stops scheduling when stopped', async () => {
  const { sessions } = await setup(); let hidden = false; const scheduled = [];
  const s = sessions[0]; s.hidden = () => hidden; s.setTimer = (fn, ms) => { scheduled.push({ fn, ms }); return 1; }; s.clearTimer = () => {};
  assert.equal(pollDelay(false), 1200); assert.equal(pollDelay(true), 15000);
  await s.tick(); assert.equal(scheduled.at(-1).ms, 1200);
  hidden = true; s.visibilityChanged(); assert.equal(scheduled.at(-1).ms, 15000);
  hidden = false; s.visibilityChanged(); assert.equal(scheduled.at(-1).ms, 0);
  s.stop(); const count = scheduled.length; await s.tick(); assert.equal(scheduled.length, count);
});
test('an older in-flight poll cannot roll back a completed send', async () => {
  const { sessions } = await setup(); const s = sessions[0], oldRoom = structuredClone(s.room);
  let finish; const poll = s.client.poll.bind(s.client);
  s.client.poll = () => new Promise(resolve => { finish = resolve; });
  const pending = s.poll(); await s.action('roll', { roll: 3 }); finish({ changed: true, room: oldRoom }); await pending;
  assert.equal(s.state.positions[0], 3); assert.equal(s.state.turns, 1); s.client.poll = poll;
});
test('online settings force human seats and room payload stays small', () => {
  const game = initialOnline({ players: ['computer', 'computer', 'computer', 'computer'] });
  assert.deepEqual(game.players, Array(4).fill('human')); assert.ok(JSON.stringify(game).length < 8192);
});
