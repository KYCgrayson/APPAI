import { type LeaderboardData, type LeaderboardDeps, type Player, type Run, type Score, isBetter, DAY } from '../../src/lib/games/leaderboard.ts';
import type { Board, Tier, ScoreDirection } from '../../src/lib/games/boards.ts';
export function setup(boards?: readonly Board[]) {
  let now = new Date('2026-11-09T00:00:00Z'), user: string | null = null;
  const players = new Map<string, Player>(), runs = new Map<string, Run>(), scores = new Map<string, Score>();
  const rates = new Map<string, { start: number; count: number }>();
  const compare = (direction: ScoreDirection) => (a: Score, b: Score) => isBetter(a, b, direction) ? -1 : isBetter(b, a, direction) ? 1 : a.id.localeCompare(b.id);
  const visible = (game: string, board: string, tier: Tier, direction: ScoreDirection) => [...scores.values()].filter(s => s.game === game && s.board === board && s.tier === tier && !s.hidden && players.get(s.userId)?.status === 'active' && players.get(s.userId)?.nickname !== '').sort(compare(direction));
  const data: LeaderboardData = {
    async player(id) { return structuredClone(players.get(id) ?? null); },
    async nicknameOwner(key) { return structuredClone([...players.values()].find(p => p.nicknameKey === key) ?? null); },
    async putPlayer(p) { players.set(p.userId, structuredClone(p)); },
    async run(id) { return structuredClone(runs.get(id) ?? null); },
    async putRun(r) { runs.set(r.id, structuredClone(r)); },
    async score(board, userId, tier) { return structuredClone([...scores.values()].find(s => s.board === board && s.userId === userId && s.tier === tier) ?? null); },
    async scoreById(id) { return structuredClone(scores.get(id) ?? null); },
    async putScore(s) { scores.set(s.id, structuredClone(s)); },
    async rank(game, board, tier, result, direction, excludeUserId) { return visible(game, board, tier, direction).filter(s => s.userId !== excludeUserId && isBetter(s, result, direction)).length + 1; },
    async view(game, board, tier, limit, userId, direction) {
      const all = visible(game, board, tier, direction).map((s, i) => ({ id: s.id, nickname: players.get(s.userId)!.nickname, tier: s.tier, rank: i + 1, score: s.score, timeMs: s.timeMs, achievedAt: s.achievedAt }));
      const ownId = [...scores.values()].find(s => s.game === game && s.board === board && s.tier === tier && s.userId === userId)?.id;
      return { entries: all.slice(0, limit), total: all.length, ...(userId ? { me: all.find(s => s.id === ownId) ?? null } : {}) };
    },
    async profileScores(userId) { return structuredClone([...scores.values()].filter(s => s.userId === userId)); },
    async deletePlayer(userId) {
      players.delete(userId);
      for (const [id, s] of scores) if (s.userId === userId) scores.delete(id); else s.reporters = s.reporters.filter(r => r !== userId);
      for (const [id, r] of runs) if (r.userId === userId) runs.delete(id);
    },
  };
  let queue = Promise.resolve();
  const deps: LeaderboardDeps = { env: { NODE_ENV: 'test' }, boards, now: () => now, currentUser: async () => user, store: {
    async transaction(fn) {
      const previous = queue; let release = () => {}; queue = new Promise(resolve => { release = resolve; }); await previous;
      const oldPlayers = structuredClone(players), oldRuns = structuredClone(runs), oldScores = structuredClone(scores), oldRates = structuredClone(rates);
      try { return await fn(data); }
      catch (error) {
        players.clear(); oldPlayers.forEach((p, k) => players.set(k, p));
        runs.clear(); oldRuns.forEach((r, k) => runs.set(k, r));
        scores.clear(); oldScores.forEach((s, k) => scores.set(k, s));
        rates.clear(); oldRates.forEach((r, k) => rates.set(k, r));
        throw error;
      } finally { release(); }
    },
    async rateHit(key, window, time) {
      const old = rates.get(key);
      if (!old || old.start <= +time - window) { rates.set(key, { start: +time, count: 1 }); return 1; }
      return ++old.count;
    },
    async cleanup(time) {
      for (const r of runs.values()) { if (r.expiresAt <= time) r.status = 'expired'; if (r.finishedAt && +r.finishedAt <= +time - 7 * DAY) r.moves = null; }
      for (const [key, hit] of rates) if (key.startsWith('lb:') && hit.start <= +time - DAY) rates.delete(key);
    },
  } };
  return { deps, players, runs, scores, rates, signIn: (id: string | null) => { user = id; }, advance: (ms: number) => { now = new Date(+now + ms); } };
}
export function req(body?: unknown, token?: string, options: { method?: string; path?: string; origin?: string; raw?: string } = {}) {
  return new Request('https://appai.info' + (options.path ?? '/api/games/river-crossing/runs'), {
    method: options.method ?? (body === undefined && options.raw === undefined ? 'GET' : 'POST'),
    headers: { 'x-forwarded-for': '203.0.113.1', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.origin ? { Origin: options.origin } : {}) },
    body: options.raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
}
