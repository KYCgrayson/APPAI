import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";

// Generic room-code rooms for turn-based games played on two or more devices.
// The server stores only public game state; hidden information stays on each device.

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
export const MAX_STATE_BYTES = 8 * 1024;
export const MAX_MOVE_BYTES = 1024;
export const MAX_BODY_BYTES = 12 * 1024;
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_MOVES_PER_ROOM = 2000;
export const MAX_ACTIVE_ROOMS = 5000;
export const MIN_SEATS = 2;
export const MAX_SEATS = 4;

export const ROOM_ORIGINS = ["https://appai.info", "https://www.appai.info", "https://kycgrayson.github.io"];

export const RATE_LIMITS = {
  create: { limit: 20, windowMs: 60 * 60 * 1000 },
  join: { limit: 30, windowMs: 10 * 60 * 1000 },
  move: { limit: 300, windowMs: 10 * 60 * 1000 },
} as const;
export type RateKind = keyof typeof RATE_LIMITS;

export type RoomStatus = "waiting" | "playing" | "finished";
export interface RoomRecord {
  code: string;
  game: string;
  state: unknown;
  version: number;
  turn: number | null;
  // sha256 hex of each seat's token; "" while the seat is empty.
  seatTokens: string[];
  lastMove: { seat: number; move: unknown } | null;
  status: RoomStatus;
  moveCount: number;
  expiresAt: Date;
}
export type RoomUpdate = Pick<RoomRecord, "state" | "version" | "turn" | "seatTokens" | "lastMove" | "status" | "moveCount">;

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
  cleanup(now: Date): Promise<void>;
}
type Env = Record<string, string | undefined>;
export interface RoomDeps {
  store: RoomStore;
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

export function roomOriginAllowed(origin: string, env: Env) {
  const extra = (env.ROOMS_ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (ROOM_ORIGINS.includes(origin) || extra.includes(origin)) return true;
  if (env.NODE_ENV !== "production") return /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origin);
  return false;
}
export function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = { Vary: "Origin", "Cache-Control": "no-store" };
  if (origin && roomOriginAllowed(origin, env)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
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

export function roomIpKey(request: Request, env: Env): string | null {
  const secret = env.ROOM_IP_SALT || env.NEXTAUTH_SECRET || env.AUTH_SECRET || (env.NODE_ENV !== "production" ? "dev-only-room-salt" : "");
  if (!secret) return null;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return createHmac("sha256", secret).update(`room-ip\0${ip}`).digest("hex").slice(0, 32);
}

type ErrorCode =
  | "invalid_request" | "state_too_large" | "room_not_found" | "room_full" | "unauthorized"
  | "version_conflict" | "not_your_turn" | "room_finished" | "room_not_ready" | "rate_limited"
  | "origin_not_allowed" | "unavailable";
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
  if (jsonBytes(state) > MAX_STATE_BYTES) throw new RoomError(413, "state_too_large", `state must be at most ${MAX_STATE_BYTES} bytes`);
}

export function publicRoom(room: RoomRecord) {
  return {
    code: room.code,
    game: room.game,
    version: room.version,
    state: room.state,
    turn: room.turn,
    seats: room.seatTokens.map((token, seat) => ({ seat, joined: token !== "" })),
    lastMove: room.lastMove,
    status: room.status,
    expiresAt: room.expiresAt.toISOString(),
  };
}

async function rateLimit(kind: RateKind, request: Request, deps: RoomDeps, now: Date) {
  const ipKey = roomIpKey(request, deps.env);
  if (!ipKey) throw new RoomError(503, "unavailable", "Rooms are not configured");
  const { limit, windowMs } = RATE_LIMITS[kind];
  const count = await deps.store.rateHit(`${kind}:${ipKey}`, windowMs, now);
  if (count > limit) throw new RoomError(429, "rate_limited", "Too many requests. Please try again later.", {}, Math.ceil(windowMs / 1000));
}

function seatForToken(room: RoomRecord, request: Request): number {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new RoomError(401, "unauthorized", "Missing seat token");
  const seat = room.seatTokens.indexOf(hashToken(token));
  if (seat < 0) throw new RoomError(401, "unauthorized", "Seat token does not match this room");
  return seat;
}

async function loadRoom(rawCode: string, deps: RoomDeps, now: Date) {
  const code = normalizeRoomCode(rawCode);
  const room = code ? await deps.store.findRoom(code, now) : null;
  if (!room) throw new RoomError(404, "room_not_found", "Room not found or expired");
  return room;
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
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2021") {
      return Response.json({ error: "unavailable", message: "Rooms are not available yet" }, { status: 503, headers });
    }
    console.error("Room request failed");
    return Response.json({ error: "unavailable", message: "Room request failed" }, { status: 500, headers });
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const gamePattern = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

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

    await rateLimit("create", request, deps, now);
    await deps.store.cleanup(now);
    if (await deps.store.activeRoomCount(now) >= MAX_ACTIVE_ROOMS) throw new RoomError(503, "unavailable", "Too many active rooms. Please try again later.");

    const token = newToken();
    for (let attempt = 0; attempt < 5; attempt++) {
      const room: RoomRecord = {
        code: generateRoomCode(), game, state, version: 1, turn: turn as number | null,
        seatTokens: Array.from({ length: seatCount }, (_, i) => i === 0 ? hashToken(token) : ""),
        lastMove: null, status: "waiting", moveCount: 0, expiresAt: new Date(now.getTime() + ROOM_TTL_MS),
      };
      if (await deps.store.createRoom(room)) return { status: 201, body: { code: room.code, seat: 0, token, room: publicRoom(room) } };
    }
    throw new RoomError(503, "unavailable", "Could not allocate a room code");
  });
}

export function joinRoom(request: Request, rawCode: string, deps: RoomDeps) {
  return respond(request, deps, async () => {
    const now = deps.now?.() ?? new Date();
    await rateLimit("join", request, deps, now);
    for (let attempt = 0; attempt < 3; attempt++) {
      const room = await loadRoom(rawCode, deps, now);
      if (room.status === "finished") throw new RoomError(409, "room_finished", "This game has ended");
      const seat = room.seatTokens.indexOf("");
      if (seat < 0) throw new RoomError(409, "room_full", "All seats are taken");
      const token = newToken();
      const seatTokens = room.seatTokens.map((value, i) => i === seat ? hashToken(token) : value);
      const update: RoomUpdate = {
        state: room.state, turn: room.turn, lastMove: room.lastMove, moveCount: room.moveCount,
        seatTokens, version: room.version + 1, status: seatTokens.includes("") ? "waiting" : "playing",
      };
      if (await deps.store.updateRoom(room.code, room.version, update, now)) {
        return { status: 200, body: { seat, token, room: publicRoom({ ...room, ...update }) } };
      }
    }
    throw new RoomError(409, "version_conflict", "Room is busy, please retry");
  });
}

export function pollRoom(request: Request, rawCode: string, deps: RoomDeps) {
  return respond(request, deps, async () => {
    const now = deps.now?.() ?? new Date();
    const room = await loadRoom(rawCode, deps, now);
    const since = Number(new URL(request.url).searchParams.get("since"));
    if (Number.isInteger(since) && since >= room.version) return { status: 200, body: { changed: false, version: room.version } };
    return { status: 200, body: { changed: true, room: publicRoom(room) } };
  });
}

export function sendMove(request: Request, rawCode: string, deps: RoomDeps) {
  return respond(request, deps, async () => {
    const now = deps.now?.() ?? new Date();
    await rateLimit("move", request, deps, now);
    const room = await loadRoom(rawCode, deps, now);
    const seat = seatForToken(room, request);
    const body = await readBody(request);
    if (!Number.isInteger(body.version)) throw new RoomError(400, "invalid_request", "version is required");
    const move = body.move === undefined ? null : body.move;
    if (jsonBytes(move) > MAX_MOVE_BYTES) throw new RoomError(413, "state_too_large", `move must be at most ${MAX_MOVE_BYTES} bytes`);
    const seats = room.seatTokens.length;
    if (body.nextTurn !== undefined && body.nextTurn !== null && !isSeat(body.nextTurn, seats)) throw new RoomError(400, "invalid_request", "nextTurn must be a seat index or null");
    if (body.end !== undefined && typeof body.end !== "boolean") throw new RoomError(400, "invalid_request", "end must be a boolean");
    const state = body.state === undefined ? room.state : body.state;
    checkState(state);

    if (room.status === "finished") throw new RoomError(409, "room_finished", "This game has ended");
    if (room.status !== "playing") throw new RoomError(409, "room_not_ready", "Waiting for players to join");
    if (body.version !== room.version) throw new RoomError(409, "version_conflict", "Room changed; refresh and retry", { room: publicRoom(room) });
    if (room.turn !== null && room.turn !== seat) throw new RoomError(409, "not_your_turn", "It is not your turn", { room: publicRoom(room) });
    if (room.moveCount >= MAX_MOVES_PER_ROOM) throw new RoomError(409, "room_finished", "Move limit reached for this room");

    const update: RoomUpdate = {
      state, seatTokens: room.seatTokens, version: room.version + 1,
      turn: body.nextTurn === undefined ? room.turn : body.nextTurn as number | null,
      lastMove: { seat, move }, status: body.end === true ? "finished" : "playing", moveCount: room.moveCount + 1,
    };
    if (!await deps.store.updateRoom(room.code, room.version, update, now)) {
      const latest = await deps.store.findRoom(room.code, now);
      throw new RoomError(409, "version_conflict", "Room changed; refresh and retry", latest ? { room: publicRoom(latest) } : {});
    }
    return { status: 200, body: { room: publicRoom({ ...room, ...update }) } };
  });
}
