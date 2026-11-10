// Shared by the browser game and server replay validation; keep rendering types out.
export type LevelId = 'easy' | 'medium' | 'hard';
export type GameId = 'river' | 'bridge' | 'water';
export type Sfx = 'select' | 'leave' | 'sail' | 'land' | 'fail' | 'win' | 'step' | 'creak' | 'lantern' | 'pour' | 'fill' | 'empty';
export type PuzzleAction = {
    type: 'toggle';
    id: string;
} | {
    type: 'cross' | 'walk' | 'go';
} | {
    type: 'select' | 'fill' | 'empty';
    jug: number;
} | {
    type: 'pour';
    from: number;
    to: number;
};
export interface PuzzleLogic<S, A = PuzzleAction> {
    initial(level: LevelId): S;
    apply(s: S, a: A): {
        ok: true;
        state: S;
        sfx?: Sfx;
    } | {
        ok: false;
        reason: string;
    };
    isWin(s: S): boolean;
    failure(s: S): {
        reason: string;
        ids?: string[];
    } | undefined;
    score(s: S): number;
    isMove(a: A): boolean;
    solve(level: LevelId): number;
    solution(level: LevelId): A[];
    hint(s: S, level: LevelId): string | null;
}
