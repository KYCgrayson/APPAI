import { levels, type LevelId } from '../logic/index.ts';
export interface Run { level: LevelId; crossings: number; ms: number; at: number }
export interface Challenge { level: LevelId; crossings: number; ms: number; name?: string }
export function rank(runs: Run[], run: Run, limit = 5) {
    const sorted = [...runs.filter(r => r.level === run.level), run].sort((a, b) => a.crossings - b.crossings || a.ms - b.ms || a.at - b.at);
    const index = sorted.indexOf(run), top = sorted.slice(0, Math.max(0, limit));
    return { runs: top, place: index < top.length ? index + 1 : null };
}
export const cleanName = (name: string) => name.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff<>&"']/g, '').trim();
export function decodeChallenge(p: URLSearchParams): Challenge | null {
    if (['challenge', 'c', 't', 'n'].some(k => p.getAll(k).length > 1)) return null;
    const level = p.get('challenge'), c = p.get('c'), t = p.get('t');
    if (!level || !Object.prototype.hasOwnProperty.call(levels, level) || !c || !t || !/^\d+$/.test(c) || !/^\d+$/.test(t)) return null;
    const crossings = Number(c), seconds = Number(t), name = cleanName(p.get('n') || '');
    if (!Number.isInteger(crossings) || crossings < levels[level as LevelId].optimal || crossings > 999 || !Number.isInteger(seconds) || seconds < 1 || seconds > 86399 || Array.from(name).length > 12) return null;
    return { level: level as LevelId, crossings, ms: seconds * 1000, ...(name ? { name } : {}) };
}
export function encodeChallenge(c: Challenge): string {
    const p = new URLSearchParams({ challenge: c.level, c: String(c.crossings), t: String(Math.max(1, Math.floor(c.ms / 1000))) });
    if (c.name) p.set('n', cleanName(c.name));
    return p.toString();
}
export function formatTime(ms: number) {
    const s = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(s / 60);
    return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
}
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function compareToChallenge(crossings: number, ms: number, challenge: Challenge): 'beat' | 'tie' | 'behind' {
    const difference = crossings - challenge.crossings || Math.floor(ms / 1000) - Math.floor(challenge.ms / 1000);
    return difference < 0 ? 'beat' : difference === 0 ? 'tie' : 'behind';
}
export function isValidRun(value: unknown): value is Run {
    if (!value || typeof value !== 'object') return false;
    const r = value as Run;
    return Object.prototype.hasOwnProperty.call(levels, r.level) && Number.isInteger(r.crossings) && r.crossings >= levels[r.level].optimal && r.crossings <= 999 && Number.isFinite(r.ms) && r.ms >= 0 && r.ms <= 86_399_999 && Number.isFinite(r.at) && r.at > 0 && r.at <= 8.64e15;
}
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
