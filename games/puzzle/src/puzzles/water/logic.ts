import type { LevelId, PuzzleAction, PuzzleLogic } from '../types.ts';
export const levels = { easy: { caps: [3, 5], start: [0, 0], optimal: 6, twoStar: 8 }, medium: { caps: [8, 5, 3], start: [8, 0, 0], optimal: 7, twoStar: 10 }, hard: { caps: [12, 7, 5], start: [12, 0, 0], optimal: 11, twoStar: 15 } };
export interface State {
    level: LevelId;
    jugs: number[];
    caps: number[];
    steps: number;
    selected: number | null;
    taps: boolean;
}
export function initial(level: LevelId): State { const l = levels[level]; return { level, jugs: [...l.start], caps: [...l.caps], steps: 0, selected: null, taps: level === 'easy' }; }
export const isWin = (s: State) => s.level === 'easy' ? s.jugs.some(v => v === 4) : s.jugs[0] === (s.level === 'medium' ? 4 : 6) && s.jugs[1] === (s.level === 'medium' ? 4 : 6) && s.jugs[2] === 0;
export function apply(s: State, a: PuzzleAction): ReturnType<PuzzleLogic<State>['apply']> {
    if (isWin(s))
        return { ok: false, reason: 'frozen' };
    if (!['select', 'fill', 'empty', 'pour'].includes(a.type))
        return { ok: false, reason: 'unknown' };
    const jug = 'jug' in a ? a.jug : 'from' in a ? a.from : -1;
    if (!Number.isInteger(jug) || jug < 0 || jug >= s.caps.length)
        return { ok: false, reason: 'unknown' };
    if (a.type === 'select')
        return { ok: true, state: { ...s, selected: s.selected === jug ? null : jug }, sfx: 'select' };
    const jugs = [...s.jugs];
    if (a.type === 'fill') {
        if (!s.taps)
            return { ok: false, reason: 'noTap' };
        if (jugs[jug] === s.caps[jug])
            return { ok: false, reason: 'full' };
        jugs[jug] = s.caps[jug];
    }
    else if (a.type === 'empty') {
        if (!s.taps)
            return { ok: false, reason: 'noDrain' };
        if (!jugs[jug])
            return { ok: false, reason: 'emptyJug' };
        jugs[jug] = 0;
    }
    else if (a.type === 'pour') {
        if (!Number.isInteger(a.to) || a.to < 0 || a.to >= s.caps.length)
            return { ok: false, reason: 'unknown' };
        if (a.from === a.to)
            return { ok: false, reason: 'same' };
        if (!jugs[a.from])
            return { ok: false, reason: 'emptyJug' };
        if (jugs[a.to] === s.caps[a.to])
            return { ok: false, reason: 'targetFull' };
        const amount = Math.min(jugs[a.from], s.caps[a.to] - jugs[a.to]);
        jugs[a.from] -= amount;
        jugs[a.to] += amount;
    }
    else
        return { ok: false, reason: 'unknown' };
    return { ok: true, state: { ...s, jugs, selected: null, steps: s.steps + 1 }, sfx: a.type === 'pour' ? 'pour' : a.type === 'fill' ? 'fill' : 'empty' };
}
export function actions(s: State): PuzzleAction[] { return s.caps.flatMap((_, jug) => [...(s.taps ? [{ type: 'fill' as const, jug }, { type: 'empty' as const, jug }] : []), ...s.caps.map((_, to) => ({ type: 'pour' as const, from: jug, to }))]); }
export function solution(level: LevelId): PuzzleAction[] {
    const start = initial(level), queue = [{ s: start, path: [] as PuzzleAction[] }], seen = new Set([start.jugs.join(',')]);
    for (let q = 0; q < queue.length; q++) {
        const { s, path } = queue[q];
        if (isWin(s))
            return path;
        for (const a of actions(s)) {
            const r = apply(s, a);
            if (r.ok) {
                const k = r.state.jugs.join(',');
                if (!seen.has(k)) {
                    seen.add(k);
                    queue.push({ s: r.state, path: [...path, a] });
                }
            }
        }
    }
    return [];
}
export const solve = (level: LevelId) => solution(level).length || Infinity;
export const logic: PuzzleLogic<State> = { initial, apply, isWin, failure: () => undefined, score: s => s.steps, isMove: a => ['fill', 'empty', 'pour'].includes(a.type), solve, solution, hint: s => s.level === 'easy' && s.steps < 3 ? `hint${s.steps}` : null };
