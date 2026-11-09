import type { LevelId, PuzzleAction, PuzzleLogic } from '../types.ts';
export const people: Record<number, string> = { 1: 'kid', 2: 'runner', 3: 'dancer', 4: 'painter', 5: 'baker', 6: 'gardener', 8: 'grandpa', 10: 'grandma', 12: 'woodcutter' };
export const levels = { easy: { times: [1, 2, 5, 10], optimal: 17, twoStar: 19, limit: 22 }, medium: { times: [1, 3, 6, 8, 12], optimal: 29, twoStar: 31, limit: 38 }, hard: { times: [1, 2, 4, 6, 8, 10], optimal: 28, twoStar: 30, limit: 36 } };
export interface State {
    level: LevelId;
    side: Record<string, 0 | 1>;
    lantern: 0 | 1;
    selected: string[];
    minutes: number;
    trips: number;
    failure?: {
        reason: 'timeout';
    };
}
export const ids = (level: LevelId) => levels[level].times.map(String);
export function initial(level: LevelId): State { return { level, side: Object.fromEntries(ids(level).map(id => [id, 0])), lantern: 0, selected: [], minutes: 0, trips: 0 }; }
export const isWin = (s: State) => !s.failure && Object.values(s.side).every(x => x === 1);
export function apply(s: State, a: PuzzleAction): ReturnType<PuzzleLogic<State>['apply']> {
    if (s.failure || isWin(s))
        return { ok: false, reason: 'frozen' };
    if (a.type === 'toggle') {
        if (!Object.prototype.hasOwnProperty.call(s.side, a.id))
            return { ok: false, reason: 'unknown' };
        if (s.side[a.id] !== s.lantern)
            return { ok: false, reason: 'remote' };
        if (s.selected.includes(a.id))
            return { ok: true, state: { ...s, selected: s.selected.filter(id => id !== a.id) }, sfx: 'leave' };
        if (s.selected.length === 2)
            return { ok: false, reason: 'capacity' };
        return { ok: true, state: { ...s, selected: [...s.selected, a.id] }, sfx: 'select' };
    }
    if (a.type !== 'walk' && a.type !== 'go')
        return { ok: false, reason: 'unknown' };
    if (!s.selected.length)
        return { ok: false, reason: 'empty' };
    const lantern = s.lantern === 0 ? 1 : 0, minutes = s.minutes + Math.max(...s.selected.map(Number));
    return { ok: true, state: { ...s, side: { ...s.side, ...Object.fromEntries(s.selected.map(id => [id, lantern])) }, lantern, selected: [], minutes, trips: s.trips + 1, failure: minutes > levels[s.level].limit ? { reason: 'timeout' } : undefined }, sfx: 'step' };
}
export const toggle = (s: State, id: string) => apply(s, { type: 'toggle', id });
export const walk = (s: State) => apply(s, { type: 'walk' });
// Dijkstra retains concrete actions; selection has zero cost, each walk costs the slower time.
export function solution(level: LevelId): PuzzleAction[] {
    const key = (s: State) => ids(level).map(id => s.side[id]).join('') + s.lantern;
    const queue: {
        s: State;
        path: PuzzleAction[];
    }[] = [{ s: initial(level), path: [] }], dist = new Map([[key(queue[0].s), 0]]);
    while (queue.length) {
        queue.sort((a, b) => a.s.minutes - b.s.minutes);
        const { s, path } = queue.shift()!;
        if (s.minutes !== dist.get(key(s)))
            continue;
        if (isWin(s))
            return path;
        const here = ids(level).filter(id => s.side[id] === s.lantern);
        for (let i = 0; i < here.length; i++)
            for (let j = i; j < here.length; j++) {
                const selected = j === i ? [here[i]] : [here[i], here[j]], r = walk({ ...s, selected });
                if (!r.ok || r.state.failure)
                    continue;
                const k = key(r.state);
                if (r.state.minutes < (dist.get(k) ?? Infinity)) {
                    dist.set(k, r.state.minutes);
                    queue.push({ s: r.state, path: [...path, ...selected.map(id => ({ type: 'toggle' as const, id })), { type: 'walk' }] });
                }
            }
    }
    return [];
}
export function solve(level: LevelId) { let s = initial(level); for (const a of solution(level)) {
    const r = apply(s, a);
    if (r.ok)
        s = r.state;
} return isWin(s) ? s.minutes : Infinity; }
export const logic: PuzzleLogic<State> = { initial, apply, isWin, failure: s => s.failure, score: s => s.minutes, isMove: a => a.type === 'walk' || a.type === 'go', solve, solution, hint: s => s.level === 'easy' && s.trips < 3 ? `hint${s.trips}` : null };
