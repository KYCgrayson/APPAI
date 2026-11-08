import type { LevelId } from '../logic/index.ts';

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
