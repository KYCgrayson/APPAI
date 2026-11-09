import test from "node:test";
import assert from "node:assert/strict";
import {
  createRoom, joinRoom, pollRoom, sendMove, roomsPreflight, normalizeRoomCode, generateRoomCode, roomOriginAllowed,
  RATE_LIMITS, MAX_STATE_BYTES, MAX_ACTIVE_ROOMS, ROOM_TTL_MS, type RoomDeps, type RoomRecord, type RoomStore,
} from "../src/lib/rooms.ts";

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
    async findRoom(code, now) { const r = rooms.get(code); return r && r.expiresAt > now ? structuredClone(r) : null; },
    async updateRoom(code, expected, update, now) {
      const r = rooms.get(code);
      if (!r || r.version !== expected || r.expiresAt <= now) return false;
      Object.assign(r, structuredClone(update));
      return true;
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
  assert.deepEqual(body.room.seats, [{ seat: 0, joined: true }, { seat: 1, joined: false }]);
  assert.equal(body.room.status, "waiting");
  assert.equal(body.room.version, 1);
  assert.equal(new Date(body.room.expiresAt).getTime() - new Date("2026-11-09T00:00:00Z").getTime(), ROOM_TTL_MS);
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

test("poll reports changes only when version advanced", async () => {
  const { t, code } = await startGame();
  const unchanged = await (await pollRoom(req(`/api/rooms/${code}?since=2`), code, t.deps)).json();
  assert.deepEqual(unchanged, { changed: false, version: 2 });
  const changed = await (await pollRoom(req(`/api/rooms/${code}?since=1`), code, t.deps)).json();
  assert.equal(changed.changed, true);
  assert.equal(changed.room.version, 2);
  const noSince = await (await pollRoom(req(`/api/rooms/${code}`), code, t.deps)).json();
  assert.equal(noSince.changed, true);
  assert.equal((await pollRoom(req("/api/rooms/ZZZZZZ"), "ZZZZZZ", t.deps)).status, 404);
});

test("moves need the seat token, current version and the right turn", async () => {
  const { t, created, joined, code } = await startGame();
  const move = (token: string | undefined, body: unknown) => sendMove(req(`/api/rooms/${code}/moves`, { body, token }), code, t.deps);
  assert.equal((await move(undefined, { version: 2, move: { guess: "1234" } })).status, 401);
  assert.equal((await move("forged", { version: 2, move: { guess: "1234" } })).status, 401);
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
  assert.deepEqual(room.lastMove, { seat: 0, move: { guess: "1234" } });
  assert.deepEqual(room.state, { history: ["1234"] });

  // the same version cannot be applied twice
  assert.equal((await move(created.token, { version: 2, move: {} })).status, 409);
  // seat 1 replies and ends the game
  const end = await move(joined.token, { version: 3, move: { reply: "4A0B" }, end: true });
  assert.equal((await end.json()).room.status, "finished");
  const after = await move(created.token, { version: 4, move: {} });
  assert.equal((await after.json()).error, "room_finished");
  assert.equal((await joinRoom(req("/x", { body: {} }), code, t.deps)).status, 409);
});

test("moves are rejected before all seats join and when too large", async () => {
  const t = setup();
  const c = await (await createRoom(req("/api/rooms", { body: { game: "x" } }), t.deps)).json();
  const early = await sendMove(req("/x", { body: { version: 1 }, token: c.token }), c.code, t.deps);
  assert.equal((await early.json()).error, "room_not_ready");
  const { t: t2, created, code } = await startGame();
  const bigMove = await sendMove(req("/x", { body: { version: 2, move: "a".repeat(2000) }, token: created.token }), code, t2.deps);
  assert.equal(bigMove.status, 413);
  const badTurn = await sendMove(req("/x", { body: { version: 2, nextTurn: 7 }, token: created.token }), code, t2.deps);
  assert.equal(badTurn.status, 400);
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
  assert.equal((await sendMove(req("/x", { body: { version: 2 }, token: a.token }), b.code, t.deps)).status, 401);
});

test("rooms expire after 24 hours", async () => {
  const { t, code } = await startGame();
  t.advance(ROOM_TTL_MS + 1);
  assert.equal((await pollRoom(req(`/api/rooms/${code}`), code, t.deps)).status, 404);
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
  assert.equal(roomOriginAllowed("http://localhost:5173", prod), false);
  assert.equal(roomOriginAllowed("http://localhost:5173", { NODE_ENV: "development" }), true);
  assert.equal(roomOriginAllowed("https://games.example", { ...prod, ROOMS_ALLOWED_ORIGINS: "https://games.example" }), true);

  const t = setup(prod);
  const ok = await createRoom(req("/x", { body: { game: "x" }, origin: "https://kycgrayson.github.io" }), t.deps);
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://kycgrayson.github.io");
  const evil = await createRoom(req("/x", { body: { game: "x" }, origin: "https://evil.example" }), t.deps);
  assert.equal(evil.status, 403);
  assert.equal(evil.headers.get("access-control-allow-origin"), null);
  assert.equal(t.rooms.size, 1);

  const pre = roomsPreflight(new Request("https://appai.info/api/rooms", { method: "OPTIONS", headers: { origin: "https://appai.info" } }), prod);
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get("access-control-allow-headers")!, /Authorization/);
  assert.equal(roomsPreflight(new Request("https://appai.info/api/rooms", { method: "OPTIONS", headers: { origin: "https://evil.example" } }), prod).status, 403);
});

test("missing table maps to 503 unavailable", async () => {
  const t = setup();
  t.deps.store.findRoom = async () => { throw Object.assign(new Error("missing"), { code: "P2021" }); };
  const res = await pollRoom(req("/api/rooms/ABCDEF"), "ABCDEF", t.deps);
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "unavailable");
});
