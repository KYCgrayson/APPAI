/** Compress the travelers' real crossing times into readable toy walking speeds. */
export const walkingSpeed = (minutes: number) => Math.max(.4, Math.min(1, 1 / (1 + (minutes - 1) * .11)));
// The previous shortest crossing was 1160ms; the server's 700ms floor stays safe.
export const crossingDuration = (minutes: number) => Math.min(3500, 1400 / walkingSpeed(minutes));
export const fireProgress = (elapsed: number, limit: number) => Math.max(0, Math.min(1, elapsed / limit));

/** Shared by the rendered HUD and the in-flight crossing preview. */
export function syncFireUrgency(progress: number, won: boolean, classes: Pick<DOMTokenList, 'toggle'>) {
    classes.toggle('fire-urgent', progress > .75 && !won);
}

/** A tiny, absolute offset: undo, restart and motion preference changes leave no drift. */
export function fireTremble(progress: number, reduced: boolean, settled: boolean, time: number) {
    if (reduced || settled || progress <= .9) return 0;
    return Math.min(1, (progress - .9) / .1) * (Math.sin(time * 17) * .006 + Math.sin(time * 23) * .003);
}

/** Faster companions take short strides ahead, then wait for the slower friend. */
export function walkingMotion(progress: number, ownSpeed: number, pairSpeed: number) {
    const cycle = Math.min(1, Math.max(0, progress)) * 4;
    const phase = cycle % 1, duty = pairSpeed / ownSpeed;
    return { progress: (Math.floor(cycle) + Math.min(1, phase / duty)) / 4, moving: phase < duty };
}
