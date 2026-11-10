import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { hashToken, roomIpKey, jsonStorable } from '../rooms.ts';
import { corsHeaders, roomOriginAllowed } from '../rooms-cors.ts';
import { BOARDS, replay, type Board, type Tier, type ScoreDirection } from './boards.ts';
import { normalizeNickname } from './nickname.ts';
import { NICKNAME_COOLDOWN_MS } from '../rooms-rate-limit.ts';

export const DAY = 86_400_000;
export const MAX_BODY_BYTES = 8192;
export interface Player { userId: string; nickname: string; nicknameKey: string; nicknameSetAt: Date; status: string; createdAt: Date }
export interface Run {
  id: string; game: string; board: string; tokenHash: string; status: string; startedAt: Date;
  finishedAt: Date | null; score: number | null; timeMs: number | null; moves: unknown;
  userId: string | null; expiresAt: Date;
}
export interface Score { id: string; game: string; board: string; userId: string; tier: string; score: number; timeMs: number; achievedAt: Date; runId: string; hidden: boolean; reporters: string[] }
export type ResultScore = Pick<Score, 'score' | 'timeMs' | 'achievedAt'>;
export interface Entry extends ResultScore { id: string; rank: number; nickname: string; tier: string }
export interface BoardView { entries: Entry[]; total: number; me?: Entry | null }
export interface LeaderboardData {
  player(userId: string): Promise<Player | null>;
  nicknameOwner(key: string): Promise<Player | null>;
  putPlayer(player: Player): Promise<void>;
  nicknameSetAt(key: string): Promise<Date | null>;
  putNicknameCooldown(key: string, now: Date): Promise<void>;
  run(id: string): Promise<Run | null>;
  putRun(run: Run): Promise<void>;
  score(board: string, userId: string, tier: Tier): Promise<Score | null>;
  scoreById(id: string): Promise<Score | null>;
  putScore(score: Score): Promise<void>;
  rank(game: string, board: string, tier: Tier, result: ResultScore, direction: ScoreDirection, excludeUserId: string | null): Promise<number>;
  view(game: string, board: string, tier: Tier, limit: number, userId: string | null, direction: ScoreDirection): Promise<BoardView>;
  profileScores(userId: string): Promise<Score[]>;
  deletePlayer(userId: string): Promise<void>;
}
export interface LeaderboardStore {
  // Serializable transaction, retried on serialization conflicts. Includes reads
  // so concurrent claims, nickname changes, reports and deletion cannot race.
  transaction<T>(fn: (data: LeaderboardData) => Promise<T>): Promise<T>;
  rateHit(key: string, windowMs: number, now: Date): Promise<number>;
  cleanup(now: Date): Promise<void>;
}
export interface LeaderboardDeps {
  store: LeaderboardStore;
  currentUser(request: Request): Promise<string | null>;
  env: Record<string, string | undefined>;
  now?: () => Date;
  boards?: readonly Board[];
}
class ApiError extends Error {
  status: number; code: string; extra: Record<string, unknown>; retryAfter?: number;
  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}, retryAfter?: number) {
    super(message); this.status = status; this.code = code; this.extra = extra; this.retryAfter = retryAfter;
  }
}
const fail = (status: number, code: string, message = code): never => { throw new ApiError(status, code, message); };
const clock = (deps: LeaderboardDeps) => deps.now?.() ?? new Date();
const boardFor = (deps: LeaderboardDeps, game: string, key: unknown) => {
  const board = (deps.boards ?? BOARDS).find(b => b.game === game && b.key === key);
  if (!board) return fail(400, 'unknown_board');
  return board;
};
async function body(request: Request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) fail(413, 'moves_too_large');
  const reader = request.body?.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); fail(413, 'moves_too_large'); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  let value: unknown;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return fail(400, 'invalid_request', 'Body must be JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || !jsonStorable(value)) return fail(400, 'invalid_request');
  return value as Record<string, unknown>;
}
async function rate(request: Request, deps: LeaderboardDeps, kind: string, limit: number, windowMs: number, subject?: string) {
  const key = subject ?? roomIpKey(request, deps.env);
  if (!key) fail(503, 'unavailable');
  if (await deps.store.rateHit(`lb:${kind}:${key}`, windowMs, clock(deps)) > limit) throw new ApiError(429, 'rate_limited', 'Please try again later', {}, Math.ceil(windowMs / 1000));
}
async function signedIn(request: Request, deps: LeaderboardDeps, path = '/games/') {
  const id = await deps.currentUser(request);
  if (!id) throw new ApiError(401, 'login_required', 'Sign in to upload your score', { loginUrl: `/login?callbackUrl=${encodeURIComponent(path)}` });
  return id;
}
async function allowedPlayer(data: LeaderboardData, userId: string) {
  const player = await data.player(userId);
  if (player?.status === 'banned') fail(403, 'player_banned');
  return player;
}
async function loadRun(data: LeaderboardData, request: Request, game: string, id: string, now: Date) {
  const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1];
  const run = token ? await data.run(id) : null;
  const hashed = hashToken(token ?? '');
  if (!run || run.game !== game || run.tokenHash.length !== hashed.length || !timingSafeEqual(Buffer.from(run.tokenHash), Buffer.from(hashed))) return fail(404, 'run_not_found');
  if (run.expiresAt <= now || run.status === 'expired') fail(410, 'run_expired');
  return run;
}
interface Reply { status?: number; body?: unknown; headers?: Record<string, string> }
async function respond(request: Request, deps: LeaderboardDeps, fn: () => Promise<Reply>) {
  const headers = corsHeaders(request, deps.env), origin = request.headers.get('origin');
  if (origin && !roomOriginAllowed(origin, deps.env)) return Response.json({ error: 'origin_not_allowed', message: 'This origin may not use leaderboards' }, { status: 403, headers });
  try {
    const result = await fn();
    const init = { status: result.status ?? 200, headers: { ...headers, ...result.headers } };
    return init.status === 204 ? new Response(null, init) : Response.json(result.body, init);
  } catch (error) {
    if (error instanceof ApiError) return Response.json({ error: error.code, message: error.message, ...error.extra }, { status: error.status, headers: { ...headers, ...(error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {}) } });
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002' && 'meta' in error && JSON.stringify(error.meta).includes('nicknameKey')) return Response.json({ error: 'nickname_taken', message: 'That nickname is taken' }, { status: 409, headers });
    console.error('Leaderboard request failed', typeof error === 'object' && error && 'code' in error ? error.code : 'unavailable');
    return Response.json({ error: 'unavailable', message: 'Leaderboards are unavailable' }, { status: 503, headers });
  }
}
export function leaderboardPreflight(request: Request, deps: LeaderboardDeps) {
  return respond(request, deps, async () => {
    if (!request.headers.get('origin')) fail(403, 'origin_not_allowed');
    return { status: 204, headers: { 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' } };
  });
}
export function createRun(request: Request, game: string, deps: LeaderboardDeps) {
  return respond(request, deps, async () => {
    await rate(request, deps, 'create', 60, 10 * 60_000);
    const board = boardFor(deps, game, (await body(request)).board), now = clock(deps);
    const userId = await deps.currentUser(request);
    await deps.store.cleanup(now);
    return deps.store.transaction(async data => {
      if (userId) await allowedPlayer(data, userId);
      const token = randomBytes(24).toString('base64url');
      const run: Run = { id: randomUUID(), game, board: board.key, tokenHash: hashToken(token), status: 'open', startedAt: now, expiresAt: new Date(+now + DAY), finishedAt: null, score: null, timeMs: null, moves: null, userId: null };
      await data.putRun(run);
      return { status: 201, body: { runId: run.id, token, startedAt: run.startedAt, expiresAt: run.expiresAt } };
    });
  });
}
export function finishRun(request: Request, game: string, id: string, deps: LeaderboardDeps) {
  return respond(request, deps, async () => {
    const now = clock(deps); // Stop at receipt, before replay/database work.
    await rate(request, deps, 'finish', 60, 10 * 60_000);
    const input = await body(request);
    const userId = await deps.currentUser(request);
    return deps.store.transaction(async data => {
      const run = await loadRun(data, request, game, id, now);
      if (run.status !== 'open') fail(409, 'already_finished');
      const board = boardFor(deps, game, run.board), timeMs = Math.max(0, +now - +run.startedAt);
      const reject = async (status: number, error: string): Promise<Reply> => {
        // A token gets one replay attempt, including an invalid or too-fast one.
        await data.putRun({ ...run, status: 'rejected', finishedAt: now });
        return { status, body: { error, message: error } };
      };
      let score: number;
      if (board.tier === 'verified') {
        if (!Array.isArray(input.moves)) return reject(400, 'invalid_request');
        if (input.moves.length > 400) return reject(413, 'moves_too_large');
        const result = replay(board, input.moves);
        if ('error' in result) return reject(422, result.error);
        if (timeMs < board.minMsPerMove * result.moveCount) return reject(422, 'too_fast');
        score = result.score;
      } else {
        if (!Number.isSafeInteger(input.score) || (input.score as number) < board.min || (input.score as number) > board.max ||
          timeMs <= 0 || (input.score as number) / (timeMs / 1000) > board.maxPerSecond) return reject(422, 'replay_failed');
        score = input.score as number;
      }
      await data.putRun({ ...run, status: 'verified', finishedAt: now, score, timeMs, moves: board.tier === 'verified' ? input.moves : null, expiresAt: new Date(+now + DAY) });
      return { body: { verified: board.tier === 'verified', tier: board.tier, score, timeMs, wouldRank: await data.rank(game, board.key, board.tier, { score, timeMs, achievedAt: now }, board.direction, userId) } };
    });
  });
}
export const isBetter = (a: ResultScore, b: ResultScore, direction: ScoreDirection) =>
  (direction === 'desc' ? a.score > b.score : a.score < b.score) || a.score === b.score && (a.timeMs < b.timeMs || a.timeMs === b.timeMs && a.achievedAt < b.achievedAt);
export function claimRun(request: Request, game: string, id: string, deps: LeaderboardDeps) {
  return respond(request, deps, async () => {
    const userId = await signedIn(request, deps, `/games/${encodeURIComponent(game)}/?claim=${encodeURIComponent(id)}`), now = clock(deps);
    await rate(request, deps, 'claim', 200, DAY, userId);
    // Inspect token before allowing it to choose a board-specific rate bucket.
    const boardKey = await deps.store.transaction(async data => (await loadRun(data, request, game, id, now)).board);
    await rate(request, deps, 'claim-board', 30, DAY, `${userId}:${boardKey}`);
    return deps.store.transaction(async data => {
      const player = await allowedPlayer(data, userId), run = await loadRun(data, request, game, id, now);
      if (run.status === 'claimed') fail(409, 'already_claimed');
      if (run.status !== 'verified' || run.score === null || run.timeMs === null || !run.finishedAt) return fail(400, 'invalid_request', 'Finish the run first');
      if (+now - +run.finishedAt >= DAY) fail(410, 'run_expired');
      const board = boardFor(deps, game, run.board), old = await data.score(board.key, userId, board.tier);
      const candidate: Score = { id: old?.id ?? randomUUID(), game, board: board.key, userId, tier: board.tier, score: run.score, timeMs: run.timeMs, achievedAt: run.finishedAt, runId: id, hidden: old?.hidden ?? false, reporters: old?.reporters ?? [] };
      const personalBest = !old || isBetter(candidate, old, board.direction), best = personalBest ? candidate : old!;
      if (personalBest) await data.putScore(candidate);
      await data.putRun({ ...run, status: 'claimed', userId });
      const view = await data.view(game, board.key, board.tier, 1, userId, board.direction);
      return { body: { rank: view.me?.rank ?? null, personalBest, needsNickname: !player?.nickname, score: best.score } };
    });
  });
}
export function getLeaderboard(request: Request, game: string, deps: LeaderboardDeps) {
  return respond(request, deps, async () => {
    await rate(request, deps, 'read', 300, 60_000);
    const params = new URL(request.url).searchParams, board = boardFor(deps, game, params.get('board'));
    const tier = params.get('tier') ?? 'verified', rawLimit = params.get('limit') ?? '50';
    if (!['verified', 'unverified'].includes(tier) || !/^\d+$/.test(rawLimit) || Number(rawLimit) < 1) fail(400, 'invalid_request');
    const userId = await deps.currentUser(request);
    return deps.store.transaction(async data => ({
      body: { board: board.key, metric: board.metric, direction: board.direction, tier, ...await data.view(game, board.key, tier as Tier, Math.min(50, Number(rawLimit)), userId, board.direction) },
      headers: { 'Cache-Control': userId ? 'private, no-store' : 'public, max-age=30', Vary: 'Origin, Cookie' },
    }));
  });
}
export function profile(request: Request, deps: LeaderboardDeps) {
  return respond(request, deps, async () => {
    const userId = await signedIn(request, deps), now = clock(deps);
    if (request.method === 'DELETE') return deps.store.transaction(async data => {
      // Preserve cooldowns for profiles created before the rate record existed.
      const player = await data.player(userId), key = `lb:nick:${hashToken(userId)}`;
      if (player && +(await data.nicknameSetAt(key) ?? 0) < +player.nicknameSetAt) await data.putNicknameCooldown(key, player.nicknameSetAt);
      await data.deletePlayer(userId);
      return { status: 204 };
    });
    if (request.method === 'GET') return deps.store.transaction(async data => {
      const player = await allowedPlayer(data, userId);
      const scores = (await data.profileScores(userId)).map(({ game, board, tier, score, timeMs, achievedAt }) => ({ game, board, tier, score, timeMs, achievedAt }));
      return { body: { nickname: player?.nickname ?? null, scores } };
    });
    await rate(request, deps, 'nickname', 20, 3_600_000, userId);
    const normalized = normalizeNickname((await body(request)).nickname);
    if ('error' in normalized) return fail(422, normalized.error);
    return deps.store.transaction(async data => {
      const player = await allowedPlayer(data, userId);
      const cooldownKey = `lb:nick:${hashToken(userId)}`;
      const lastSetAt = Math.max(+(await data.nicknameSetAt(cooldownKey) ?? 0), +(player?.nicknameSetAt ?? 0));
      if (+now < lastSetAt + NICKNAME_COOLDOWN_MS) throw new ApiError(429, 'rate_limited', 'Nicknames can change once every 7 days', {}, Math.ceil((lastSetAt + NICKNAME_COOLDOWN_MS - +now) / 1000));
      const owner = await data.nicknameOwner(normalized.nicknameKey);
      if (owner && owner.userId !== userId) fail(409, 'nickname_taken');
      await data.putPlayer({ ...normalized, userId, nicknameSetAt: now, status: player?.status ?? 'active', createdAt: player?.createdAt ?? now });
      // Same transaction as the nickname: failed/conflicting writes consume no cooldown.
      // This hashed rate record survives profile deletion and stores no nickname.
      await data.putNicknameCooldown(cooldownKey, now);
      return { body: { nickname: normalized.nickname, nextChangeAt: new Date(+now + NICKNAME_COOLDOWN_MS) } };
    });
  });
}
export function reportScore(request: Request, game: string, id: string, deps: LeaderboardDeps) {
  return respond(request, deps, async () => {
    const userId = await signedIn(request, deps);
    await rate(request, deps, 'report', 20, DAY, userId);
    return deps.store.transaction(async data => {
      await allowedPlayer(data, userId);
      const score = await data.scoreById(id);
      if (!score || score.game !== game) return fail(404, 'run_not_found');
      if (score.reporters.length < 3 && !score.reporters.includes(userId)) {
        const reporters = [...score.reporters, userId];
        await data.putScore({ ...score, reporters, hidden: score.hidden || reporters.length >= 3 });
      }
      return { status: 202, body: {} };
    });
  });
}
