import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import { corsHeaders, roomOriginAllowed } from "./rooms-cors.ts";

// Generic room-code rooms for turn-based games played on two to four devices.
// The server stores only public game state; hidden information stays on each device.

export { ROOM_ORIGINS, corsHeaders, roomOriginAllowed } from "./rooms-cors.ts";
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
export const MAX_STATE_BYTES = 8 * 1024;
export const MAX_MOVE_BYTES = 1024;
export const MAX_BODY_BYTES = 12 * 1024;
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
// A room that has not started closes 2 minutes after it was created or after the latest join.
export const WAITING_TTL_MS = 2 * 60 * 1000;
export const MAX_MOVES_PER_ROOM = 2000;
export const RECENT_MOVES = 20;
export const MAX_ACTIVE_ROOMS = 5000;
export const MIN_SEATS = 2;
export const MAX_SEATS = 4;
export const ONLINE_WINDOW_MS = 30 * 1000;
export const TOUCH_INTERVAL_MS = 10 * 1000;
// Long enough that a player who briefly switches apps is not skipped.
export const SKIP_AFTER_MS = 120 * 1000;
// A full room nobody has polled for this long is closed, so abandoned rooms do not hold the room cap.
export const IDLE_TTL_MS = 15 * 60 * 1000;
export const MAX_JSON_DEPTH = 64;

export const RATE_LIMITS = {
  // Room creation needs a signed-in account; these limits are per account.
  create: { limit: 20, windowMs: 60 * 60 * 1000 },
  createDaily: { limit: 40, windowMs: 24 * 60 * 60 * 1000 },
  // Backstop for many accounts behind one network.
  createNetwork: { limit: 60, windowMs: 60 * 60 * 1000 },
  join: { limit: 30, windowMs: 10 * 60 * 1000 },
  move: { limit: 300, windowMs: 10 * 60 * 1000 },
} as const;
export type RateKind = keyof typeof RATE_LIMITS;

export type RoomStatus = "waiting" | "playing" | "finished";
export interface RoomMove { version: number; seat: number; move: unknown; skipped?: number }
export interface RoomRecord {
  code: string;
  game: string;
  // Internal user id of the signed-in creator; never returned by the API.
  creatorId: string;
  state: unknown;
  version: number;
  turn: number | null;
  // sha256 hex of each seat's token; "" while the seat is empty.
  seatTokens: string[];
  // Last time each seat polled or moved; epoch 0 for empty seats.
  seatSeenAt: Date[];
  moves: RoomMove[];
  status: RoomStatus;
  moveCount: number;
  createdAt: Date;
  expiresAt: Date;
}
// Presence (seatSeenAt) is never part of a CAS update; it is written per seat by touchSeat.
export type RoomUpdate = Pick<RoomRecord, "state" | "version" | "turn" | "seatTokens" | "moves" | "status" | "moveCount" | "expiresAt">;

export interface RoomStore {
  // Atomically count one hit for key in the current window; returns the count including this hit.
  rateHit(key: string, windowMs: number, now: Date): Promise<number>;
  activeRoomCount(now: Date): Promise<number>;
  // false when the code is already taken.
  createRoom(room: RoomRecord): Promise<boolean>;
  // Must not return expired rooms.
  findRoom(code: string, now: Date): Promise<RoomRecord | null>;
  // Compare-and-swap on version; returns false when another write won.
  updateRoom(code: string, expectedVersion: number, update: RoomUpdate, now: Date): Promise<boolean>;
  // Presence only: sets one seat's last-seen time (and the expiry, when given) without changing the version.
  touchSeat(code: string, seat: number, now: Date, expiresAt: Date | null): Promise<void>;
  cleanup(now: Date): Promise<void>;
}
type Env = Record<string, string | undefined>;
export interface RoomDeps {
  store: RoomStore;
  // Signed-in AppAI user id for this request, or null.
  currentUser(request: Request): Promise<string | null>;
  env: Env;
  now?: () => Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  return code;
}
const codePattern = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
export function normalizeRoomCode(raw: string): string | null {
  const code = raw.replace(/[\s-]/g, "").toUpperCase();
  return codePattern.test(code) ? code : null;
}
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
function newToken() {
  return randomBytes(24).toString("base64url");
}
export function jsonBytes(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}
// Postgres jsonb rejects NUL and unpaired surrogates; catch them as a 400 instead of a 500.
export function jsonStorable(value: unknown, depth = 0): boolean {
  if (depth > MAX_JSON_DEPTH) return false;
  if (typeof value === "string") return !value.includes("\0") && value.isWellFormed();
  if (Array.isArray(value)) return value.every(item => jsonStorable(item, depth + 1));
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).every(([key, item]) => jsonStorable(key) && jsonStorable(item, depth + 1));
  }
  return true;
}
// The write has already committed; a failed presence update must not turn it into an error
// (for a join that would lose the token of a seat that is already taken).
async function touchAfterWrite(deps: RoomDeps, code: string, seat: number, now: Date) {
  try { await deps.store.touchSeat(code, seat, now, null); } catch { console.error("Room presence update failed"); }
}
// Full rooms live 24 hours from creation, but close early once every seat has gone quiet.
export function activeExpiry(room: Pick<RoomRecord, "createdAt">, now: Date) {
  return new Date(Math.min(room.createdAt.getTime() + ROOM_TTL_MS, now.getTime() + IDLE_TTL_MS));
}

export function roomsPreflight(request: Request, env: Env) {
  const origin = request.headers.get("origin");
  if (!origin || !roomOriginAllowed(origin, env)) return new Response(null, { status: 403, headers: { Vary: "Origin" } });
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request, env),
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "600",
    },
  });
}

// IPv6 hosts usually control a whole /64, so limits apply per /64.
export function clientNetwork(ip: string): string {
  if (!ip.includes(":")) return ip;
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return mapped[1];
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  return `${groups.slice(0, 4).map(g => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}
export function roomIpKey(request: Request, env: Env): string | null {
  const secret = env.ROOM_IP_SALT || env.NEXTAUTH_SECRET || env.AUTH_SECRET || (env.NODE_ENV !== "production" ? "dev-only-room-salt" : "");
  if (!secret) return null;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return createHmac("sha256", secret).update(`room-ip\0${clientNetwork(ip)}`).digest("hex").slice(0, 32);
}

type ErrorCode =
  | "invalid_request" | "state_too_large" | "room_not_found" | "room_full"
  | "version_conflict" | "not_your_turn" | "room_finished" | "room_not_ready" | "rate_limited"
  | "origin_not_allowed" | "unavailable" | "login_required" | "not_host";
class RoomError extends Error {
  status: number;
  code: ErrorCode;
  extra: Record<string, unknown>;
  retryAfter?: number;
  constructor(status: number, code: ErrorCode, message: string, extra: Record<string, unknown> = {}, retryAfter?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
    this.retryAfter = retryAfter;
  }
}
// A wrong or missing seat token looks exactly like a missing room, so poll and move cannot reveal which codes exist.
const notFound = () => new RoomError(404, "room_not_found", "Room not found or expired");

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const length = request.headers.get("content-length");
  if (length !== null && Number(length) > MAX_BODY_BYTES) throw new RoomError(413, "state_too_large", "Request body too large");
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RoomError(413, "state_too_large", "Request body too large");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new RoomError(400, "invalid_request", "Body must be JSON"); }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new RoomError(400, "invalid_request", "Body must be a JSON object");
  return parsed as Record<string, unknown>;
}

function isSeat(value: unknown, seats: number): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < seats;
}
function checkState(state: unknown) {
  if (typeof state !== "object" || state === null) throw new RoomError(400, "invalid_request", "state must be a JSON object or array");
  if (!jsonStorable(state)) throw new RoomError(400, "invalid_request", `state contains NUL, invalid Unicode or nesting deeper than ${MAX_JSON_DEPTH}`);
  if (jsonBytes(state) > MAX_STATE_BYTES) throw new RoomError(413, "state_too_large", `state must be at most ${MAX_STATE_BYTES} bytes`);
}

function idleMs(room: RoomRecord, seat: number, now: Date) {
  return now.getTime() - room.seatSeenAt[seat].getTime();
}
export function publicRoom(room: RoomRecord, now: Date) {
  return {
    code: room.code,
    game: room.game,
    version: room.version,
    state: room.state,
    turn: room.turn,
    seats: publicSeats(room, now),
    moves: room.moves,
    lastMove: room.moves.at(-1) ?? null,
    status: room.status,
    expiresAt: room.expiresAt.toISOString(),
  };
}
function publicSeats(room: RoomRecord, now: Date) {
  return room.seatTokens.map((token, seat) => {
    const joined = token !== "";
    const idle = joined ? Math.max(0, Math.floor(idleMs(room, seat, now) / 1000)) : null;
    return { seat, joined, online: joined && idleMs(room, seat, now) < ONLINE_WINDOW_MS, idleSeconds: idle };
  });
}

async function rateLimit(kind: RateKind, request: Request, deps: RoomDeps, now: Date, subject?: string) {
  const ipKey = roomIpKey(request, deps.env);
  if (!ipKey) throw new RoomError(503, "unavailable", "Rooms are not configured");
  const { limit, windowMs } = RATE_LIMITS[kind];
  const count = await deps.store.rateHit(`${kind}:${subject ?? ipKey}`, windowMs, now);
  if (count > limit) throw new RoomError(429, "rate_limited", "Too many requests. Please try again later.", {}, Math.ceil(windowMs / 1000));
}

function bearer(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}
// Loads the room and the caller's seat; any mismatch is reported as a missing room.
async function loadSeat(rawCode: string, request: Request, deps: RoomDeps, now: Date) {
  const token = bearer(request);
  const code = normalizeRoomCode(rawCode);
  if (!token || !code) throw notFound();
  const room = await deps.store.findRoom(code, now);
  const seat = room ? room.seatTokens.indexOf(hashToken(token)) : -1;
  if (!room || seat < 0) throw notFound();
  return { room, seat };
}

function isMissingTable(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  if (error.code === "P2021") return true;
  // Raw queries report a missing table as P2010 carrying the Postgres code 42P01.
  return error.code === "P2010" && "meta" in error && JSON.stringify(error.meta ?? "").includes("42P01");
}
async function respond(request: Request, deps: RoomDeps, run: () => Promise<{ status: number; body: unknown }>) {
  const headers = corsHeaders(request, deps.env);
  const origin = request.headers.get("origin");
  if (origin && !roomOriginAllowed(origin, deps.env)) {
    return Response.json({ error: "origin_not_allowed", message: "This origin may not use rooms" }, { status: 403, headers });
  }
  try {
    const { status, body } = await run();
    return Response.json(body, { status, headers });
  } catch (error) {
    if (error instanceof RoomError) {
      const extra: Record<string, string> = error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {};
      return Response.json({ error: error.code, message: error.message, ...error.extra }, { status: error.status, headers: { ...headers, ...extra } });
    }
    if (isMissingTable(error)) {
      return Response.json({ error: "unavailable", message: "Rooms are not available yet" }, { status: 503, headers });
    }
    const name = typeof error === "object" && error !== null ? ("code" in error ? String(error.code) : (error as Error).name) : typeof error;
    console.error(`Room request failed: ${name}`);
    return Response.json({ error: "unavailable", message: "Room request failed" }, { status: 500, headers });
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const gamePattern = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const EPOCH = new Date(0);

export function createRoom(request: Request, deps: RoomDeps) {
  return respond(request, deps, async () => {
    const now = deps.now?.() ?? new Date();
    const body = await readBody(request);
    const game = body.game;
    if (typeof game !== "string" || !gamePattern.test(game)) throw new RoomError(400, "invalid_request", "game must be 1-40 characters of a-z, 0-9 and -");
    const seats = body.seats === undefined ? 2 : body.seats;
    if (!Number.isInteger(seats) || (seats as number) < MIN_SEATS || (seats as number) > MAX_SEATS) {
      throw new RoomError(400, "invalid_request", `seats must be an integer from ${MIN_SEATS} to ${MAX_SEATS}`);
    }
    const seatCount = seats as number;
    const state = body.state === undefined ? {} : body.state;
    checkState(state);
    const turn = body.turn === undefined ? 0 : body.turn;
    if (turn !== null && !isSeat(turn, seatCount)) throw new RoomError(400, "invalid_request", "turn must be a seat index or null");

    const userId = await deps.currentUser(request);
    if (!userId) throw new RoomError(401, "login_required", "Sign in to AppAI to create a room");
    await rateLimit("createNetwork", request, deps, now);
    await rateLimit("create", request, deps, now, `user:${userId}`);
    await rateLimit("createDaily", request, deps, now, `user:${userId}`);
    await deps.store.cleanup(now);
    if (await deps.store.activeRoomCount(now) >= MAX_ACTIVE_ROOMS) throw new RoomError(503, "unavailable", "Too many active rooms. Please try again later.");

    const token = newToken();
    for (let attempt = 0; attempt < 5; attempt++) {
      const room: RoomRecord = {
        code: generateRoomCode(), game, creatorId: userId, state, version: 1, turn: turn as number | null,
        seatTokens: Array.from({ length: seatCount }, (_, i) => i === 0 ? hashToken(token) : ""),
        seatSeenAt: Array.from({ length: seatCount }, (_, i) => i === 0 ? now : EPOCH),
        moves: [], status: "waiting", moveCount: 0, createdAt: now, expiresAt: new Date(now.getTime() + WAITING_TTL_MS),
      };
      if (await deps.store.createRoom(room)) return { status: 201, body: { code: room.code, seat: 0, token, room: publicRoom(room, now) } };
    }
    throw new RoomError(503, "unavailable", "Could not allocate a room code");
  });
}

export function joinRoom(request: Request, rawCode: string, deps: RoomDeps) {
  return respond(request, deps, async () => {
    const now = deps.now?.() ?? new Date();
    await rateLimit("join", request, deps, now);
    await deps.store.cleanup(now);
    const code = normalizeRoomCode(rawCode);
    if (!code) throw notFound();
    for (let attempt = 0; attempt < 3; attempt++) {
      const room = await deps.store.findRoom(code, now);
      if (!room) throw notFound();
      if (room.status === "finished") throw new RoomError(409, "room_finished", "This game has ended");
      const seat = room.seatTokens.indexOf("");
      if (seat < 0) throw new RoomError(409, "room_full", "All seats are taken");
      const token = newToken();
      const seatTokens = room.seatTokens.map((value, i) => i === seat ? hashToken(token) : value);
      const full = !seatTokens.includes("");
      const update: RoomUpdate = {
        state: room.state, turn: room.turn, moves: room.moves, moveCount: room.moveCount,
        seatTokens, version: room.version + 1, status: full ? "playing" : "waiting",
        expiresAt: full ? activeExpiry(room, now) : new Date(now.getTime() + WAITING_TTL_MS),
      };
      if (await deps.store.updateRoom(room.code, room.version, update, now)) {
        await touchAfterWrite(deps, room.code, seat, now);
        const seatSeenAt = room.seatSeenAt.map((value, i) => i === seat ? now : value);
        return { status: 200, body: { seat, token, room: publicRoom({ ...room, ...update, seatSeenAt }, now) } };
      }
    }
    throw new RoomError(409, "version_conflict", "Room is busy, please retry");
  });
}

export function pollRoom(request: Request, rawCode: string, deps: RoomDeps) {
  return respond(request, deps, async () => {
    const now = deps.now?.() ?? new Date();
    const { room, seat } = await loadSeat(rawCode, request, deps, now);
    if (idleMs(room, seat, now) >= TOUCH_INTERVAL_MS) {
      // Only a game in progress is kept open by polling; waiting and finished rooms keep their expiry.
      const expiresAt = room.status === "playing" ? activeExpiry(room, now) : null;
      await deps.store.touchSeat(room.code, seat, now, expiresAt);
      room.seatSeenAt[seat] = now;
      if (expiresAt) room.expiresAt = expiresAt;
    }
    const since = Number(new URL(request.url).searchParams.get("since"));
    if (Number.isInteger(since) && since >= room.version) {
      return { status: 200, body: { changed: false, version: room.version, seats: publicSeats(room, now) } };
    }
    return { status: 200, body: { changed: true, seat, room: publicRoom(room, now) } };
  });
}

export function sendMove(request: Request, rawCode: string, deps: RoomDeps) {
  return respond(request, deps, async () => {
    const now = deps.now?.() ?? new Date();
    await rateLimit("move", request, deps, now);
    const { room, seat } = await loadSeat(rawCode, request, deps, now);
    const body = await readBody(request);
    if (!Number.isInteger(body.version)) throw new RoomError(400, "invalid_request", "version is required");
    const move = body.move === undefined ? null : body.move;
    if (!jsonStorable(move)) throw new RoomError(400, "invalid_request", `move contains NUL, invalid Unicode or nesting deeper than ${MAX_JSON_DEPTH}`);
    if (jsonBytes(move) > MAX_MOVE_BYTES) throw new RoomError(413, "state_too_large", `move must be at most ${MAX_MOVE_BYTES} bytes`);
    const seats = room.seatTokens.length;
    if (body.skip === true && (body.state !== undefined || body.end !== undefined || body.nextTurn !== undefined)) {
      // A skip only passes the turn on; it cannot rewrite the game or end it.
      throw new RoomError(400, "invalid_request", "skip cannot carry state, end or nextTurn");
    }
    if (body.nextTurn !== undefined && body.nextTurn !== null && !isSeat(body.nextTurn, seats)) throw new RoomError(400, "invalid_request", "nextTurn must be a seat index or null");
    if (body.end !== undefined && typeof body.end !== "boolean") throw new RoomError(400, "invalid_request", "end must be a boolean");
    if (body.skip !== undefined && typeof body.skip !== "boolean") throw new RoomError(400, "invalid_request", "skip must be a boolean");
    const state = body.state === undefined ? room.state : body.state;
    checkState(state);

    if (room.status === "finished") throw new RoomError(409, "room_finished", "This game has ended");
    if (room.status !== "playing") throw new RoomError(409, "room_not_ready", "Waiting for players to join");
    if (body.version !== room.version) throw new RoomError(409, "version_conflict", "Room changed; refresh and retry", { room: publicRoom(room, now) });
    if (room.moveCount >= MAX_MOVES_PER_ROOM) throw new RoomError(409, "room_finished", "Move limit reached for this room");

    let skipped: number | undefined;
    if (body.skip === true) {
      // Any other seated player may pass the turn of a player who has gone quiet.
      if (room.turn === null || room.turn === seat) throw new RoomError(400, "invalid_request", "skip is only for another player's turn");
      if (idleMs(room, room.turn, now) < SKIP_AFTER_MS) throw new RoomError(409, "not_your_turn", "That player is still connected", { room: publicRoom(room, now) });
      skipped = room.turn;
    } else if (room.turn !== null && room.turn !== seat) {
      throw new RoomError(409, "not_your_turn", "It is not your turn", { room: publicRoom(room, now) });
    }
    const version = room.version + 1;
    const entry: RoomMove = skipped === undefined ? { version, seat, move } : { version, seat, move, skipped };
    const update: RoomUpdate = {
      state, seatTokens: room.seatTokens, version,
      turn: skipped !== undefined ? (skipped + 1) % seats : body.nextTurn === undefined ? room.turn : body.nextTurn as number | null,
      moves: [...room.moves, entry].slice(-RECENT_MOVES), status: body.end === true ? "finished" : "playing",
      moveCount: room.moveCount + 1, expiresAt: activeExpiry(room, now),
    };
    if (!await deps.store.updateRoom(room.code, room.version, update, now)) {
      const latest = await deps.store.findRoom(room.code, now);
      throw new RoomError(409, "version_conflict", "Room changed; refresh and retry", latest ? { room: publicRoom(latest, now) } : {});
    }
    await touchAfterWrite(deps, room.code, seat, now);
    const seatSeenAt = room.seatSeenAt.map((value, i) => i === seat ? now : value);
    return { status: 200, body: { room: publicRoom({ ...room, ...update, seatSeenAt }, now) } };
  });
}

// The creator (seat 0) starts the game with whoever has joined; empty seats are dropped.
export function startRoom(request: Request, rawCode: string, deps: RoomDeps) {
  return respond(request, deps, async () => {
    const now = deps.now?.() ?? new Date();
    await rateLimit("move", request, deps, now);
    const { room, seat } = await loadSeat(rawCode, request, deps, now);
    if (seat !== 0) throw new RoomError(403, "not_host", "Only the room creator can start the game");
    if (room.status !== "waiting") throw new RoomError(409, "room_finished", "The game has already started");
    const seatTokens = room.seatTokens.filter(token => token !== "");
    if (seatTokens.length < MIN_SEATS) throw new RoomError(409, "room_not_ready", `At least ${MIN_SEATS} players are needed`);
    // Seats fill in order and nobody leaves before the start, so joined seats are 0..n-1.
    const update: RoomUpdate = {
      state: room.state, seatTokens, version: room.version + 1,
      turn: room.turn !== null && room.turn >= seatTokens.length ? 0 : room.turn,
      moves: room.moves, status: "playing", moveCount: room.moveCount, expiresAt: activeExpiry(room, now),
    };
    if (!await deps.store.updateRoom(room.code, room.version, update, now)) {
      throw new RoomError(409, "version_conflict", "Room changed; refresh and retry");
    }
    const seatSeenAt = room.seatSeenAt.slice(0, seatTokens.length);
    return { status: 200, body: { room: publicRoom({ ...room, ...update, seatSeenAt }, now) } };
  });
}
