import test from "node:test";
import assert from "node:assert/strict";
import {
  createRoom, joinRoom, pollRoom, sendMove, roomsPreflight, normalizeRoomCode, generateRoomCode, roomOriginAllowed, clientNetwork, roomIpKey,
  RATE_LIMITS, MAX_STATE_BYTES, MAX_ACTIVE_ROOMS, ROOM_TTL_MS, WAITING_TTL_MS, SKIP_AFTER_MS, IDLE_TTL_MS, RECENT_MOVES, type RoomDeps, type RoomRecord, type RoomStore,
} from "../src/lib/rooms.ts";
import { roomRateBucket } from "../src/lib/rooms-cors.ts";

function memoryStore() {
  const rooms = new Map<string, RoomRecord>();
  const hits = new Map<string, { start: number; count: number }>();
  let activeOverride: number | null = null;
  const store: RoomStore = {
    async rateHit(key, windowMs, now) {
      const entry = hits.get(key);
      if (!entry || entry.start <= now.getTime() - windowMs) { hits.set(key, { start: now.getTime(), count: 1 }); return 1; }
      entry.count++;
      return entry.count;
    },
    async activeRoomCount(now) { return activeOverride ?? [...rooms.values()].filter(r => r.expiresAt > now).length; },
    async createRoom(room) { if (rooms.has(room.code)) return false; rooms.set(room.code, structuredClone(room)); return true; },
    async findRoom(code, now) { await Promise.resolve(); const r = rooms.get(code); return r && r.expiresAt > now ? structuredClone(r) : null; },
    async updateRoom(code, expected, update, now) {
      await Promise.resolve();
      const r = rooms.get(code);
      if (!r || r.version !== expected || r.expiresAt <= now) return false;
      Object.assign(r, structuredClone(update));
      return true;
    },
    async touchSeat(code, seat, now, expiresAt) {
      const r = rooms.get(code);
      if (!r || r.expiresAt <= now) return;
      r.seatSeenAt[seat] = now;
      if (expiresAt) r.expiresAt = expiresAt;
    },
    async cleanup(now) { for (const [code, r] of rooms) if (r.expiresAt <= now) rooms.delete(code); },
  };
  return { store, rooms, setActive: (n: number | null) => { activeOverride = n; } };
}
function setup(env: Record<string, string | undefined> = { NODE_ENV: "test" }) {
  const mem = memoryStore();
  let clock = new Date("2026-11-09T00:00:00Z");
  const deps: RoomDeps = { store: mem.store, env, now: () => clock };
  return { ...mem, deps, advance: (ms: number) => { clock = new Date(clock.getTime() + ms); } };
}
function req(path: string, init: { method?: string; body?: unknown; token?: string; ip?: string; origin?: string; raw?: string } = {}) {
  const headers: Record<string, string> = { "x-forwarded-for": init.ip ?? "203.0.113.1" };
  if (init.body !== undefined || init.raw !== undefined) headers["content-type"] = "application/json";
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  if (init.origin) headers.origin = init.origin;
  return new Request(`https://appai.info${path}`, {
    method: init.method ?? (init.body !== undefined || init.raw !== undefined ? "POST" : "GET"),
    headers, body: init.raw ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  });
}
async function startGame(t = setup()) {
  const created = await (await createRoom(req("/api/rooms", { body: { game: "abcd-1a2b", state: { history: [] } } }), t.deps)).json();
  const joined = await (await joinRoom(req(`/api/rooms/${created.code}/join`, { body: {}, ip: "203.0.113.2" }), created.code, t.deps)).json();
  return { t, created, joined, code: created.code as string };
}

test("room codes use the unambiguous alphabet and normalize user input", () => {
  for (let i = 0; i < 200; i++) assert.match(generateRoomCode(), /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  assert.equal(normalizeRoomCode(" k7m-3qx "), "K7M3QX");
  assert.equal(normalizeRoomCode("k7m 3qx"), "K7M3QX");
  assert.equal(normalizeRoomCode("K7M3Q"), null);
  assert.equal(normalizeRoomCode("k7m-3qa"), "K7M3QA");
  assert.equal(normalizeRoomCode("K7M3Q0"), null); // 0 excluded
  assert.equal(normalizeRoomCode("../../x"), null);
});

test("create returns a code, seat 0 token and public room without token hashes", async () => {
  const t = setup();
  const res = await createRoom(req("/api/rooms", { body: { game: "abcd-1a2b", state: { n: 1 } } }), t.deps);
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.seat, 0);
  assert.equal(typeof body.token, "string");
  assert.ok(body.token.length >= 32);
  assert.deepEqual(body.room.seats, [{ seat: 0, joined: true, online: true, idleSeconds: 0 }, { seat: 1, joined: false, online: false, idleSeconds: null }]);
  assert.equal(body.room.status, "waiting");
  assert.equal(body.room.version, 1);
  assert.equal(new Date(body.room.expiresAt).getTime() - new Date("2026-11-09T00:00:00Z").getTime(), WAITING_TTL_MS);
  assert.ok(!JSON.stringify(body.room).includes(t.rooms.get(body.code)!.seatTokens[0]));
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("create validates game, seats, turn and state size", async () => {
  const t = setup();
  const bad = [
    {}, { game: "" }, { game: "Bad Name" }, { game: "a".repeat(41) }, { game: "x", seats: 1 }, { game: "x", seats: 5 },
    { game: "x", turn: 2 }, { game: "x", state: "string" }, { game: "x", state: null },
  ];
  for (const body of bad) assert.equal((await createRoom(req("/api/rooms", { body }), t.deps)).status, 400, JSON.stringify(body));
  assert.equal((await createRoom(req("/api/rooms", { raw: "{" }), t.deps)).status, 400);
  const big = { game: "x", state: { blob: "a".repeat(MAX_STATE_BYTES) } };
  assert.equal((await createRoom(req("/api/rooms", { body: big }), t.deps)).status, 413);
  const huge = { game: "x", state: { blob: "a".repeat(20000) } };
  assert.equal((await createRoom(req("/api/rooms", { body: huge }), t.deps)).status, 413);
  assert.equal(t.rooms.size, 0);
});

test("join fills seats, then rejects; game becomes playing", async () => {
  const { t, joined, code } = await startGame();
  assert.equal(joined.seat, 1);
  assert.equal(joined.room.status, "playing");
  assert.equal(joined.room.version, 2);
  const full = await joinRoom(req(`/api/rooms/${code}/join`, { body: {} }), code, t.deps);
  assert.equal(full.status, 409);
  assert.equal((await full.json()).error, "room_full");
  assert.equal((await joinRoom(req("/api/rooms/ZZZZZZ/join", { body: {} }), "ZZZZZZ", t.deps)).status, 404);
  assert.equal((await joinRoom(req("/api/rooms/bad/join", { body: {} }), "bad", t.deps)).status, 404);
  // lowercase code works
  const t2 = setup();
  const c = await (await createRoom(req("/api/rooms", { body: { game: "x" } }), t2.deps)).json();
  assert.equal((await joinRoom(req("/x", { body: {} }), c.code.toLowerCase(), t2.deps)).status, 200);
});

const poll = (t: ReturnType<typeof setup>, code: string, token?: string, since?: number) =>
  pollRoom(req(`/api/rooms/${code}${since === undefined ? "" : `?since=${since}`}`, { token }), code, t.deps);

test("poll needs the seat token; wrong token and missing room look identical", async () => {
  const { t, created, code } = await startGame();
  const unchanged = await (await poll(t, code, created.token, 2)).json();
  assert.equal(unchanged.changed, false);
  assert.equal(unchanged.version, 2);
  assert.equal(unchanged.seats.length, 2);
  const changed = await (await poll(t, code, created.token, 1)).json();
  assert.equal(changed.changed, true);
  assert.equal(changed.seat, 0);
  assert.equal(changed.room.version, 2);
  assert.equal((await (await poll(t, code, created.token)).json()).changed, true);
  const noToken = await poll(t, code);
  const forged = await poll(t, code, "forged");
  const missing = await poll(t, "ZZZZZZ", created.token);
  for (const res of [noToken, forged, missing]) {
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: "room_not_found", message: "Room not found or expired" });
  }
});

test("moves need the seat token, current version and the right turn", async () => {
  const { t, created, joined, code } = await startGame();
  const move = (token: string | undefined, body: unknown) => sendMove(req(`/api/rooms/${code}/moves`, { body, token }), code, t.deps);
  assert.equal((await move(undefined, { version: 2, move: { guess: "1234" } })).status, 404);
  assert.equal((await move("forged", { version: 2, move: { guess: "1234" } })).status, 404);
  const wrongTurn = await move(joined.token, { version: 2, move: {} });
  assert.equal(wrongTurn.status, 409);
  assert.equal((await wrongTurn.json()).error, "not_your_turn");
  const stale = await move(created.token, { version: 1, move: {} });
  assert.equal(stale.status, 409);
  const staleBody = await stale.json();
  assert.equal(staleBody.error, "version_conflict");
  assert.equal(staleBody.room.version, 2);
  assert.equal((await move(created.token, { move: {} })).status, 400);

  const ok = await move(created.token, { version: 2, move: { guess: "1234" }, state: { history: ["1234"] }, nextTurn: 1 });
  assert.equal(ok.status, 200);
  const room = (await ok.json()).room;
  assert.equal(room.version, 3);
  assert.equal(room.turn, 1);
  assert.deepEqual(room.lastMove, { version: 3, seat: 0, move: { guess: "1234" } });
  assert.deepEqual(room.state, { history: ["1234"] });

  assert.equal((await move(created.token, { version: 2, move: {} })).status, 409);
  const end = await move(joined.token, { version: 3, move: { reply: "4A0B" }, end: true });
  assert.equal((await end.json()).room.status, "finished");
  const after = await move(created.token, { version: 4, move: {} });
  assert.equal((await after.json()).error, "room_finished");
  assert.equal((await joinRoom(req("/x", { body: {} }), code, t.deps)).status, 409);
});

test("recent moves list keeps every move between two polls", async () => {
  const t = setup();
  const c = await (await createRoom(req("/x", { body: { game: "x", turn: null } }), t.deps)).json();
  const j = await (await joinRoom(req("/x", { body: {} }), c.code, t.deps)).json();
  for (let v = 2; v < 2 + RECENT_MOVES + 3; v++) {
    assert.equal((await sendMove(req("/x", { body: { version: v, move: v } , token: c.token }), c.code, t.deps)).status, 200);
  }
  const room = (await (await poll(t, c.code, j.token, 2)).json()).room;
  assert.equal(room.moves.length, RECENT_MOVES);
  assert.deepEqual(room.moves.map((m: { version: number }) => m.version), Array.from({ length: RECENT_MOVES }, (_, i) => room.version - RECENT_MOVES + 1 + i));
});

test("moves are rejected before all seats join, when too large, or not storable", async () => {
  const t = setup();
  const c = await (await createRoom(req("/api/rooms", { body: { game: "x" } }), t.deps)).json();
  const early = await sendMove(req("/x", { body: { version: 1 }, token: c.token }), c.code, t.deps);
  assert.equal((await early.json()).error, "room_not_ready");
  const { t: t2, created, code } = await startGame();
  const send = (body: unknown) => sendMove(req("/x", { body, token: created.token }), code, t2.deps);
  assert.equal((await send({ version: 2, move: "a".repeat(2000) })).status, 413);
  assert.equal((await send({ version: 2, nextTurn: 7 })).status, 400);
  assert.equal((await send({ version: 2, move: "a\u0000b" })).status, 400);
  assert.equal((await send({ version: 2, state: { ["\ud800"]: 1 } })).status, 400);
  assert.equal((await createRoom(req("/x", { body: { game: "x", state: { s: "\udc00" } } }), t2.deps)).status, 400);
});

test("free-turn rooms (turn null) accept any seated player", async () => {
  const t = setup();
  const c = await (await createRoom(req("/api/rooms", { body: { game: "x", turn: null } }), t.deps)).json();
  const j = await (await joinRoom(req("/x", { body: {}, ip: "198.51.100.9" }), c.code, t.deps)).json();
  const res = await sendMove(req("/x", { body: { version: 2, move: 1 }, token: j.token }), c.code, t.deps);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).room.turn, null);
});

test("token from one room does not work in another", async () => {
  const t = setup();
  const a = await (await createRoom(req("/api/rooms", { body: { game: "x" } }), t.deps)).json();
  const b = await (await createRoom(req("/api/rooms", { body: { game: "x" } }), t.deps)).json();
  await joinRoom(req("/x", { body: {} }), b.code, t.deps);
  assert.equal((await sendMove(req("/x", { body: { version: 2 }, token: a.token }), b.code, t.deps)).status, 404);
  assert.equal((await poll(t, b.code, a.token)).status, 404);
});

test("unfilled rooms expire after 30 minutes; full rooms 24 hours after creation", async () => {
  const t = setup();
  const c = await (await createRoom(req("/x", { body: { game: "x" } }), t.deps)).json();
  assert.equal(new Date(c.room.expiresAt).getTime() - new Date("2026-11-09T00:00:00Z").getTime(), WAITING_TTL_MS);
  t.advance(WAITING_TTL_MS + 1);
  assert.equal((await poll(t, c.code, c.token)).status, 404);
  assert.equal((await joinRoom(req("/x", { body: {} }), c.code, t.deps)).status, 404);

  // A full room stays open while someone polls, up to 24 hours from creation.
  const { t: t2, created, code, joined } = await startGame();
  assert.equal(new Date(joined.room.expiresAt).getTime() - new Date("2026-11-09T00:00:00Z").getTime(), IDLE_TTL_MS);
  for (let elapsed = 0; elapsed < ROOM_TTL_MS - 10 * 60_000; elapsed += 10 * 60_000) {
    t2.advance(10 * 60_000);
    assert.equal((await poll(t2, code, created.token)).status, 200, `at ${elapsed}`);
  }
  t2.advance(10 * 60_000);
  assert.equal((await poll(t2, code, created.token)).status, 404);

  // A full room nobody polls closes after 15 minutes.
  const { t: t3, created: c3, code: code3 } = await startGame();
  t3.advance(IDLE_TTL_MS + 1);
  assert.equal((await poll(t3, code3, c3.token)).status, 404);
});

test("four-player room: seats fill in order, turn passes around, everyone sees it", async () => {
  const t = setup();
  const c = await (await createRoom(req("/x", { body: { game: "x", seats: 4 } }), t.deps)).json();
  const tokens = [c.token];
  for (let i = 1; i < 4; i++) {
    const j = await (await joinRoom(req("/x", { body: {}, ip: `198.51.100.${i}` }), c.code, t.deps)).json();
    assert.equal(j.seat, i);
    assert.equal(j.room.status, i === 3 ? "playing" : "waiting");
    tokens.push(j.token);
  }
  assert.equal((await joinRoom(req("/x", { body: {} }), c.code, t.deps)).status, 409);
  let version = 4;
  for (let round = 0; round < 8; round++) {
    const seat = round % 4;
    const res = await sendMove(req("/x", { body: { version, move: { n: round }, nextTurn: (seat + 1) % 4 }, token: tokens[seat] }), c.code, t.deps);
    assert.equal(res.status, 200, `round ${round}`);
    version++;
  }
  const view = (await (await poll(t, c.code, tokens[2], 4)).json()).room;
  assert.equal(view.turn, 0);
  assert.equal(view.moves.length, 8);
  assert.deepEqual(view.seats.map((s: { joined: boolean }) => s.joined), [true, true, true, true]);
});

test("presence: polls mark a seat online, throttled; quiet seats go offline", async () => {
  const { t, created, joined, code } = await startGame();
  let writes = 0;
  const touch = t.deps.store.touchSeat;
  t.deps.store.touchSeat = async (...args) => { writes++; return touch(...args); };
  await poll(t, code, created.token);
  assert.equal(writes, 0); // seen at create, within the throttle window
  t.advance(11_000);
  await poll(t, code, created.token);
  await poll(t, code, created.token);
  assert.equal(writes, 1);
  t.advance(25_000);
  const seats = (await (await poll(t, code, created.token, 99)).json()).seats;
  assert.equal(seats[0].online, true);
  assert.equal(seats[1].online, false); // joined 36 s ago, never polled
  assert.equal(seats[1].idleSeconds, 36);
  void joined;
});

test("a quiet player's turn can be skipped by another seat, only to the next seat", async () => {
  const t = setup();
  const c = await (await createRoom(req("/x", { body: { game: "x", seats: 3 } }), t.deps)).json();
  const b = await (await joinRoom(req("/x", { body: {} }), c.code, t.deps)).json();
  const d = await (await joinRoom(req("/x", { body: {} }), c.code, t.deps)).json();
  const skip = (token: string, version: number, extra = {}) => sendMove(req("/x", { body: { version, skip: true, ...extra }, token }), c.code, t.deps);
  // seat 0 holds the turn and was just seen
  const early = await skip(b.token, 3);
  assert.equal(early.status, 409);
  assert.equal((await skip(c.token, 3)).status, 400); // cannot skip yourself
  t.advance(SKIP_AFTER_MS - 1000);
  await poll(t, c.code, b.token);
  await poll(t, c.code, d.token);
  t.advance(2000);
  for (const extra of [{ nextTurn: 2 }, { state: { score: 0 } }, { end: true }]) {
    assert.equal((await skip(d.token, 3, extra)).status, 400, JSON.stringify(extra));
  }
  const ok = await skip(d.token, 3, { move: { note: "timeout" } });
  assert.equal(ok.status, 200);
  const room = (await ok.json()).room;
  assert.equal(room.turn, 1);
  assert.deepEqual(room.lastMove, { version: 4, seat: 2, move: { note: "timeout" }, skipped: 0 });
  // the skipped player can rejoin the rotation with its token later
  assert.equal((await poll(t, c.code, c.token)).status, 200);
});

test("concurrent joins never share a seat; concurrent moves apply once", async () => {
  const t = setup();
  const c = await (await createRoom(req("/x", { body: { game: "x" } }), t.deps)).json();
  const results = await Promise.all([1, 2, 3].map(i => joinRoom(req("/x", { body: {}, ip: `192.0.2.${i}` }), c.code, t.deps)));
  const statuses = results.map(r => r.status).sort();
  assert.deepEqual(statuses, [200, 409, 409]);
  assert.equal(t.rooms.get(c.code)!.seatTokens.filter(Boolean).length, 2);

  const { t: t2, created, code } = await startGame();
  const moves = await Promise.all([0, 1, 2].map(n => sendMove(req("/x", { body: { version: 2, move: n }, token: created.token }), code, t2.deps)));
  assert.deepEqual(moves.map(r => r.status).sort(), [200, 409, 409]);
  assert.equal(t2.rooms.get(code)!.version, 3);
  assert.equal(t2.rooms.get(code)!.moves.length, 1);
});

test("per-IP limits apply to create and join attempts, including misses", async () => {
  const t = setup();
  for (let i = 0; i < RATE_LIMITS.create.limit; i++) assert.equal((await createRoom(req("/x", { body: { game: "x" } }), t.deps)).status, 201);
  const limited = await createRoom(req("/x", { body: { game: "x" } }), t.deps);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  assert.equal((await createRoom(req("/x", { body: { game: "x" }, ip: "198.51.100.7" }), t.deps)).status, 201);

  for (let i = 0; i < RATE_LIMITS.join.limit; i++) await joinRoom(req("/x", { body: {}, ip: "192.0.2.50" }), "ZZZZZZ", t.deps);
  assert.equal((await joinRoom(req("/x", { body: {}, ip: "192.0.2.50" }), "ZZZZZZ", t.deps)).status, 429);
  t.advance(RATE_LIMITS.join.windowMs + 1);
  assert.equal((await joinRoom(req("/x", { body: {}, ip: "192.0.2.50" }), "ZZZZZZ", t.deps)).status, 404);
});

test("IPv6 clients are limited per /64", async () => {
  assert.equal(clientNetwork("2001:db8:1:2:aaaa::1"), "2001:db8:1:2::/64");
  assert.equal(clientNetwork("2001:0db8:0001:0002:ffff:ffff:ffff:ffff"), "2001:db8:1:2::/64");
  assert.equal(clientNetwork("2001:db8::5"), "2001:db8:0:0::/64");
  assert.equal(clientNetwork("::ffff:203.0.113.4"), "203.0.113.4");
  assert.equal(clientNetwork("203.0.113.4"), "203.0.113.4");
  const env = { NODE_ENV: "test" };
  const key = (ip: string) => roomIpKey(req("/x", { ip }), env);
  assert.equal(key("2001:db8:1:2::1"), key("2001:db8:1:2:ffff::9"));
  assert.notEqual(key("2001:db8:1:2::1"), key("2001:db8:1:3::1"));
  const t = setup();
  for (let i = 0; i < RATE_LIMITS.create.limit; i++) await createRoom(req("/x", { body: { game: "x" }, ip: `2001:db8:1:2::${i.toString(16)}` }), t.deps);
  assert.equal((await createRoom(req("/x", { body: { game: "x" }, ip: "2001:db8:1:2::ffff" }), t.deps)).status, 429);
});

test("middleware buckets room routes by action, never by room code", () => {
  assert.equal(roomRateBucket("/api/rooms/ABCDEF", "GET"), roomRateBucket("/api/rooms/ZZZZZZ", "GET"));
  assert.equal(roomRateBucket("/api/rooms/abc-def", "GET"), "rooms:poll");
  assert.equal(roomRateBucket("/api/rooms/ABCDEF/join", "POST"), "rooms:join");
  assert.equal(roomRateBucket("/api/rooms/ABCDEF/moves", "POST"), "rooms:moves");
  assert.equal(roomRateBucket("/api/rooms", "POST"), "rooms:create");
  assert.equal(roomRateBucket("/api/feedback/web", "POST"), null);
});

test("global active room cap returns 503", async () => {
  const t = setup();
  t.setActive(MAX_ACTIVE_ROOMS);
  assert.equal((await createRoom(req("/x", { body: { game: "x" } }), t.deps)).status, 503);
});

test("production without an IP salt fails closed", async () => {
  const t = setup({ NODE_ENV: "production" });
  assert.equal((await createRoom(req("/x", { body: { game: "x" } }), t.deps)).status, 503);
});

test("CORS allows only listed origins; disallowed origins are refused", async () => {
  const prod = { NODE_ENV: "production", NEXTAUTH_SECRET: "s" };
  assert.equal(roomOriginAllowed("https://kycgrayson.github.io", prod), true);
  assert.equal(roomOriginAllowed("https://appai.info", prod), true);
  assert.equal(roomOriginAllowed("https://evil.example", prod), false);
  assert.equal(roomOriginAllowed("null", prod), false);
  assert.equal(roomOriginAllowed("http://localhost:5173", prod), false);
  assert.equal(roomOriginAllowed("http://localhost:5173", { NODE_ENV: "development" }), true);
  assert.equal(roomOriginAllowed("https://games.example", { ...prod, ROOMS_ALLOWED_ORIGINS: "https://games.example" }), true);

  const t = setup(prod);
  const ok = await createRoom(req("/x", { body: { game: "x" }, origin: "https://kycgrayson.github.io" }), t.deps);
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://kycgrayson.github.io");
  assert.match(ok.headers.get("access-control-expose-headers")!, /Retry-After/);
  const evil = await createRoom(req("/x", { body: { game: "x" }, origin: "https://evil.example" }), t.deps);
  assert.equal(evil.status, 403);
  assert.equal(evil.headers.get("access-control-allow-origin"), null);
  assert.equal(t.rooms.size, 1);

  const pre = roomsPreflight(new Request("https://appai.info/api/rooms", { method: "OPTIONS", headers: { origin: "https://appai.info" } }), prod);
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get("access-control-allow-headers")!, /Authorization/);
  assert.equal(roomsPreflight(new Request("https://appai.info/api/rooms", { method: "OPTIONS", headers: { origin: "https://evil.example" } }), prod).status, 403);
});

test("missing table maps to 503 unavailable, including raw-query errors", async () => {
  for (const error of [{ code: "P2021" }, { code: "P2010", meta: { code: "42P01" } }]) {
    const t = setup();
    t.deps.store.rateHit = async () => { throw Object.assign(new Error("missing"), error); };
    const res = await createRoom(req("/x", { body: { game: "x" } }), t.deps);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error, "unavailable");
  }
});

test("deeply nested JSON is a 400, not a 500", async () => {
  const t = setup();
  const deep = "[".repeat(5000) + "]".repeat(5000);
  const res = await createRoom(req("/x", { raw: `{"game":"x","state":${deep}}` }), t.deps);
  assert.equal(res.status, 400);
  let ok: unknown = {};
  for (let i = 0; i < 60; i++) ok = { a: ok };
  assert.equal((await createRoom(req("/x", { body: { game: "x", state: ok } }), t.deps)).status, 201);
});

test("daily create limit bounds rooms per network", async () => {
  const t = setup();
  let created = 0;
  for (let hour = 0; hour < 3; hour++) {
    for (let i = 0; i < RATE_LIMITS.create.limit; i++) {
      if ((await createRoom(req("/x", { body: { game: "x" } }), t.deps)).status === 201) created++;
    }
    t.advance(RATE_LIMITS.create.windowMs + 1);
  }
  assert.equal(created, RATE_LIMITS.createDaily.limit);
});
