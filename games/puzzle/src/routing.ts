import type { GameId, LevelId, PuzzleDef } from './puzzles/types.ts';
import { decodeChallenge, runScore, type Challenge } from './share/index.ts';
export type Route = {
    screen: 'home' | 'levels' | 'game';
    game: GameId | null;
    level: LevelId;
    challenge: Challenge | null;
};
export function resolveRoute(params: URLSearchParams, registry: Record<string, PuzzleDef>): Route {
    const fallback: Route = { screen: 'home', game: null, level: 'easy', challenge: null };
    if (params.getAll('game').length > 1)
        return fallback;
    const game = params.get('game') ?? (params.has('challenge') ? 'river' : null);
    if (!game || !Object.prototype.hasOwnProperty.call(registry, game))
        return fallback;
    const def = registry[game], decoded = decodeChallenge(params, registry);
    const challenge = decoded ? { ...decoded, game: game as GameId, score: runScore(decoded) } : null;
    const level = params.get('level');
    if (level && Object.prototype.hasOwnProperty.call(def.levels, level))
        return { screen: 'game', game: game as GameId, level: level as LevelId, challenge };
    if (challenge)
        return { screen: 'levels', game: game as GameId, level: challenge.level, challenge };
    return { screen: 'levels', game: game as GameId, level: 'easy', challenge: null };
}
