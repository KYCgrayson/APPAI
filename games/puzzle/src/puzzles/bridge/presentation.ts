/** Compress the travelers' real crossing times into readable toy walking speeds. */
export const walkingSpeed = (minutes: number) => Math.max(.4, Math.min(1, 1 / (1 + (minutes - 1) * .11)));
// The previous shortest crossing was 1160ms; the server's 700ms floor stays safe.
export const crossingDuration = (minutes: number) => Math.min(3500, 1400 / walkingSpeed(minutes));
export const fireProgress = (elapsed: number, limit: number) => Math.max(0, Math.min(1, elapsed / limit));

/** Faster companions take short strides ahead, then wait for the slower friend. */
export function walkingMotion(progress: number, ownSpeed: number, pairSpeed: number) {
    const cycle = Math.min(1, Math.max(0, progress)) * 4;
    const phase = cycle % 1, duty = pairSpeed / ownSpeed;
    return { progress: (Math.floor(cycle) + Math.min(1, phase / duty)) / 4, moving: phase < duty };
}
