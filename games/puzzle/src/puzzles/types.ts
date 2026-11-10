import type { Group, Object3D } from 'three';
import type { Stage } from '../scene/stage.ts';
import type { GameId, LevelId, PuzzleLogic } from './logic-types.ts';
export type { GameId, LevelId, PuzzleAction, PuzzleLogic, Sfx } from './logic-types.ts';
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
