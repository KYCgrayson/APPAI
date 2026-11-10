import type { LevelId } from './logic.ts';

export const ACTOR_SCALE = 1.8;
export const HIT_WIDTH = .6;
// Stable slots preserve the two species rows even as travelers leave the bank.
export function bankSlot(level: LevelId, index: number, bank: number) {
    const columns = level === 'easy' ? 2 : level === 'medium' ? 3 : 5;
    return {
        x: (bank === 0 ? -1 : 1) * (2.45 + Math.floor(index / columns) * 1.65),
        z: (index % columns - (columns - 1) / 2) * 1.4,
    };
}
export const boatSeats = (capacity: number) => capacity === 3 ? [-1.5, 0, 1.5] : [-.85, .85];

// Conservative horizontal bounds for large scenery; keep these outside traveler slots.
export const TREE_Z = -3.75;
export const BUSH_X = 4.72, BUSH_Z = 3.6;
export const SIGN_X = 3.275, ROCK_Z = 3.72;
export const propFootprints = [
    ...[-1, 1].flatMap(side => [
        ...[3.05, 3.6, 4.15].map(x => ({ x: side*x, z: TREE_Z, rx: .25, rz: .25 })),
        { x: side*(BUSH_X+.03), z: BUSH_Z+.06, rx: .19, rz: .20 },
        { x: side*SIGN_X, z: 2.8, rx: .24, rz: .15 },
        { x: side*4.5, z: ROCK_Z, rx: .35, rz: .30 },
    ]),
];
