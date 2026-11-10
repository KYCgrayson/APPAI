import { logic as river, levels as riverLevels } from '../../../games/puzzle/src/puzzles/river/logic.ts';
import { logic as bridge, levels as bridgeLevels } from '../../../games/puzzle/src/puzzles/bridge/logic.ts';
import { logic as water, levels as waterLevels } from '../../../games/puzzle/src/puzzles/water/logic.ts';
import type { GameId, LevelId, PuzzleAction } from '../../../games/puzzle/src/puzzles/logic-types.ts';

export type Tier = 'verified' | 'unverified';
export type ScoreDirection = 'asc' | 'desc';
interface BoardBase { game: string; key: string; metric: string; direction: ScoreDirection }
export type Board = BoardBase & ({
  tier: 'verified'; validator: GameId; level: LevelId; minMsPerMove: number;
} | {
  tier: 'unverified'; min: number; max: number;
  // Caps score / elapsed seconds for either direction. On asc boards this is
  // only a plausibility ceiling on reported units, not a minimum score/time.
  maxPerSecond: number;
});

export const puzzleLogics = { river, bridge, water };
// scene.ts durations: river 800ms -> 500ms (~62%); bridge shortest is
// 1100 + 60*1 = 1160ms -> 700ms (~60%); water fill/empty 650ms
// (pour 750ms) -> 390ms (60%). Selection/toggle actions do not count.
const floors = { river: 500, bridge: 700, water: 390 };
const metrics = { river: 'crossings', bridge: 'minutes', water: 'steps' };
export const BOARDS: readonly Board[] = (['river', 'bridge', 'water'] as const).flatMap(validator =>
  (['easy', 'medium', 'hard'] as const).map(level => ({
    game: 'river-crossing', key: `${validator}:${level}`, tier: 'verified' as const,
    metric: metrics[validator], direction: 'asc' as const, validator, level, minMsPerMove: floors[validator],
  })));

export function replay(board: Extract<Board, { tier: 'verified' }>, moves: unknown[]):
  { score: number; moveCount: number } | { error: 'replay_failed' | 'not_won' } {
  // State types differ by puzzle; the union is dispatched before evaluating.
  const verify = <S>(logic: { initial(l: LevelId): S; apply(s: S, a: PuzzleAction): { ok: true; state: S } | { ok: false }; isWin(s: S): boolean; score(s: S): number; isMove(a: PuzzleAction): boolean }) => {
    let state = logic.initial(board.level), moveCount = 0;
    for (const value of moves) {
      if (!value || typeof value !== 'object' || Array.isArray(value) || !('type' in value) || typeof value.type !== 'string') return { error: 'replay_failed' as const };
      const action = value as PuzzleAction;
      // apply is the game's own logic; malformed actions must also fail closed.
      try {
        const result = logic.apply(state, action);
        if (!result.ok) return { error: 'replay_failed' as const };
        state = result.state;
        if (logic.isMove(action)) moveCount++;
      } catch { return { error: 'replay_failed' as const }; }
    }
    if (!logic.isWin(state)) return { error: 'not_won' as const };
    const score = logic.score(state);
    const optimal = { river: riverLevels, bridge: bridgeLevels, water: waterLevels }[board.validator][board.level].optimal;
    if (score < optimal) return { error: 'replay_failed' as const };
    return { score, moveCount };
  };
  switch (board.validator) {
    case 'river': return verify(river);
    case 'bridge': return verify(bridge);
    case 'water': return verify(water);
  }
}
