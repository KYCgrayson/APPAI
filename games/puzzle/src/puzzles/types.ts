import type { Group, Object3D } from 'three';
import type { Stage } from '../scene/stage.ts';
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
export interface PuzzleScene<S = any> {
    root: Group;
    hit: Object3D[];
    secondaryIds?: string[];
    bounds: {
        x: number;
        y: [
            number,
            number
        ];
        z: number;
    };
    sync(s: S): void;
    animate(from: S, to: S, done: () => void): void;
    busy: boolean;
    update(t: number, dt: number, hover: string): void;
    dispose(): void;
}
export interface PuzzleDef {
    id: GameId;
    storagePrefix: string;
    metric: 'crossings' | 'minutes' | 'steps';
    levels: Record<LevelId, {
        optimal: number;
        twoStar: number;
        limit?: number;
    }>;
    logic: PuzzleLogic<any>;
    strings: Record<string, string>;
    night?: boolean;
    loadScene: () => Promise<{
        create(stage: Stage, level: LevelId): PuzzleScene;
    }>;
}
export const levelIds: LevelId[] = ['easy', 'medium', 'hard'];
export const starsFor = (score: number, level: {
    optimal: number;
    twoStar: number;
}) => score <= level.optimal ? 3 : score <= level.twoStar ? 2 : 1;
