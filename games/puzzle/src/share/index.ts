import type { LevelId, PuzzleDef } from '../puzzles/types.ts';
import { registry } from '../puzzles/registry.ts';
import type { GameId } from '../puzzles/types.ts';
export interface Run {
    game: GameId;
    level: LevelId;
    score: number;
    ms: number;
    at: number;
}
export interface LegacyRun {
    level: LevelId;
    crossings: number;
    ms: number;
    at: number;
    game?: undefined;
}
export interface Challenge {
    level: LevelId;
    game?: GameId;
    score?: number;
    crossings?: number;
    ms: number;
    name?: string;
}
export const runScore = (r: {
    score?: number;
    crossings?: number;
}) => r.score ?? r.crossings ?? Infinity;
export function rank<T extends Run | LegacyRun>(runs: T[], run: T, limit = 5) {
    const sorted = [...runs.filter(r => (r.game ?? 'river') === (run.game ?? 'river') && r.level === run.level), run].sort((a, b) => runScore(a) - runScore(b) || a.ms - b.ms || a.at - b.at);
    const index = sorted.indexOf(run), top = sorted.slice(0, Math.max(0, limit));
    return { runs: top, place: index < top.length ? index + 1 : null };
}
export const cleanName = (name: string) => name.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff<>&"']/g, '').trim();
export function decodeChallenge(p: URLSearchParams, definitions: Record<string, PuzzleDef> = registry): Challenge | null {
    if (['game', 'challenge', 'c', 't', 'n'].some(k => p.getAll(k).length > 1))
        return null;
    const game = p.get('game') ?? 'river';
    if (!Object.prototype.hasOwnProperty.call(definitions, game))
        return null;
    const def = definitions[game], level = p.get('challenge'), c = p.get('c'), t = p.get('t');
    if (!level || !Object.prototype.hasOwnProperty.call(def.levels, level) || !c || !t || !/^\d+$/.test(c) || !/^\d+$/.test(t))
        return null;
    const score = Number(c), seconds = Number(t), name = cleanName(p.get('n') || '');
    if (!Number.isInteger(score) || score < def.levels[level as LevelId].optimal || score > 999 || !Number.isInteger(seconds) || seconds < 1 || seconds > 86399 || Array.from(name).length > 12)
        return null;
    // The legacy river decoder shape remains supported for existing consumers.
    return { level: level as LevelId, ...(game === 'river' ? { crossings: score } : { game: game as GameId, score }), ms: seconds * 1000, ...(name ? { name } : {}) };
}
export function encodeChallenge(c: Challenge): string {
    const p = new URLSearchParams({ game: c.game ?? 'river', challenge: c.level, c: String(runScore(c)), t: String(Math.max(1, Math.floor(c.ms / 1000))) });
    if (c.name)
        p.set('n', cleanName(c.name));
    return p.toString();
}
export function formatTime(ms: number) {
    const s = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(s / 60);
    return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
}
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function compareToChallenge(crossings: number, ms: number, challenge: Challenge): 'beat' | 'tie' | 'behind' {
    const difference = crossings - runScore(challenge) || Math.floor(ms / 1000) - Math.floor(challenge.ms / 1000);
    return difference < 0 ? 'beat' : difference === 0 ? 'tie' : 'behind';
}
export function migrateRun(value: unknown, game: GameId = 'river'): Run | null {
    if (!value || typeof value !== 'object')
        return null;
    const v = value as Partial<Run> & {
        crossings?: number;
    };
    const id = v.game ?? game;
    if (!Object.prototype.hasOwnProperty.call(registry, id))
        return null;
    const def = registry[id], score = v.score ?? (id === 'river' ? v.crossings : undefined), level = v.level;
    if (!level || !Object.prototype.hasOwnProperty.call(def.levels, level) || !Number.isInteger(score) || score! < def.levels[level].optimal || score! > 999 || !Number.isFinite(v.ms) || v.ms! < 0 || v.ms! > 86399999 || !Number.isFinite(v.at) || v.at! <= 0 || v.at! > 8.64e15)
        return null;
    return { game: id, level, score: score!, ms: v.ms!, at: v.at! };
}
export function isValidRun(value: unknown): value is Run | LegacyRun { return !!migrateRun(value); }
export function relativeLuminance(hex: string): number {
    const rgb = hex.replace('#', '').match(/.{2}/g)!.map(c => {
        const s = parseInt(c, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
}
export function accentTextColor(hex: string): '#000000' | '#ffffff' {
    return relativeLuminance(hex) > Math.sqrt(0.0525) - 0.05 ? '#000000' : '#ffffff';
}
