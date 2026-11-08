export type LevelId = 'easy' | 'medium' | 'hard';
export type Kind = 'farmer' | 'wolf' | 'goat' | 'cabbage' | 'rabbit' | 'fox';
export interface Piece {
    id: string;
    kind: Kind;
}
export interface Level {
    id: LevelId;
    capacity: number;
    captains?: string[];
    optimal: number;
    pieces: Piece[];
}
const herd = (n: number): Piece[] => (['rabbit', 'fox'] as const).flatMap(kind => Array.from({ length: n }, (_, i) => ({ id: `${kind}${i + 1}`, kind })));
export const levels: Record<LevelId, Level> = {
    easy: { id: 'easy', capacity: 2, optimal: 7, pieces: (['farmer', 'wolf', 'goat', 'cabbage'] as Kind[]).map(kind => ({ id: kind, kind })) },
    medium: { id: 'medium', capacity: 2, optimal: 11, pieces: herd(3) },
    hard: { id: 'hard', capacity: 3, optimal: 13, captains: ['rabbit1', 'fox1'], pieces: herd(5) },
};
export interface Failure {
    reason: 'predators' | 'wolfGoat' | 'goatCabbage';
    ids: string[];
}
export interface State {
    level: LevelId;
    positions: Record<string, 0 | 1>;
    boat: 0 | 1;
    aboard: string[];
    crossings: number;
    failure?: Failure;
}
export type Result = {
    ok: true;
    state: State;
} | {
    ok: false;
    reason: 'capacity' | 'remote' | 'empty' | 'farmer' | 'boatRule' | 'rower' | 'frozen' | 'unknown';
};
export function initial(level: LevelId): State { return { level, positions: Object.fromEntries(levels[level].pieces.map(p => [p.id, 0])), boat: 0, aboard: [], crossings: 0 }; }
export function isWin(s: State): boolean { return !s.failure && Object.values(s.positions).every(p => p === 1); }
export function toggle(s: State, id: string): Result {
    if (s.failure || isWin(s))
        return { ok: false, reason: 'frozen' };
    if (!(id in s.positions))
        return { ok: false, reason: 'unknown' };
    if (s.positions[id] !== s.boat)
        return { ok: false, reason: 'remote' };
    if (s.aboard.includes(id))
        return { ok: true, state: { ...s, aboard: s.aboard.filter(p => p !== id) } };
    if (s.aboard.length >= levels[s.level].capacity)
        return { ok: false, reason: 'capacity' };
    return { ok: true, state: { ...s, aboard: [...s.aboard, id] } };
}
function check(s: State): Failure | undefined {
    for (const bank of [0, 1]) {
        const pieces = levels[s.level].pieces.filter(p => s.positions[p.id] === bank);
        const has = (kind: Kind) => pieces.some(p => p.kind === kind);
        if (s.level === 'easy') {
            if (!has('farmer') && has('goat')) {
                if (has('wolf'))
                    return { reason: 'wolfGoat', ids: ['wolf', 'goat'] };
                if (has('cabbage'))
                    return { reason: 'goatCabbage', ids: ['goat', 'cabbage'] };
            }
        }
        else {
            const rabbits = pieces.filter(p => p.kind === 'rabbit').length;
            if (rabbits > 0 && pieces.length - rabbits > rabbits)
                return { reason: 'predators', ids: pieces.map(p => p.id) };
        }
    }
}
export function cross(s: State): Result {
    if (s.failure || isWin(s))
        return { ok: false, reason: 'frozen' };
    if (!s.aboard.length)
        return { ok: false, reason: 'empty' };
    if (s.level === 'easy' && !s.aboard.includes('farmer'))
        return { ok: false, reason: 'farmer' };
    const captains = levels[s.level].captains;
    if (captains && !s.aboard.some(id => captains.includes(id)))
        return { ok: false, reason: 'rower' };
    if (s.level === 'hard') {
        const r = s.aboard.filter(id => id.startsWith('rabbit')).length;
        if (r > 0 && s.aboard.length - r > r)
            return { ok: false, reason: 'boatRule' };
    }
    const boat = s.boat === 0 ? 1 : 0;
    const next: State = { ...s, boat, positions: { ...s.positions }, crossings: s.crossings + 1 };
    for (const id of s.aboard)
        next.positions[id] = boat;
    next.failure = check(next);
    return { ok: true, state: next };
}
// Symmetry reduction retains a concrete path while merging interchangeable animals.
export function solution(level: LevelId): string[][] {
    const captains = levels[level].captains ?? [];
    const key = (s: State) => `${s.boat}|${captains.map(id => s.positions[id]).join(',')}|` + (['farmer', 'wolf', 'goat', 'cabbage', 'rabbit', 'fox'] as Kind[]).map(k => levels[level].pieces.filter(p => p.kind === k && !captains.includes(p.id) && s.positions[p.id] === 1).length).join(',');
    const queue: {
        s: State;
        path: string[][];
    }[] = [{ s: initial(level), path: [] }];
    const seen = new Set([key(queue[0]!.s)]);
    for (let q = 0; q < queue.length; q++) {
        const { s, path } = queue[q]!;
        if (isWin(s))
            return path;
        const available = levels[level].pieces.filter(p => s.positions[p.id] === s.boat).map(p => p.id);
        const visit = (start: number, load: string[]) => {
            if (load.length) {
                const r = cross({ ...s, aboard: load });
                if (r.ok && !r.state.failure) {
                    const k = key(r.state);
                    if (!seen.has(k)) {
                        seen.add(k);
                        queue.push({ s: { ...r.state, aboard: [] }, path: [...path, load] });
                    }
                }
            }
            if (load.length === levels[level].capacity)
                return;
            for (let i = start; i < available.length; i++)
                visit(i + 1, [...load, available[i]!]);
        };
        visit(0, []);
    }
    return [];
}
export function solve(level: LevelId): number { const path = solution(level); return path.length || Infinity; }
