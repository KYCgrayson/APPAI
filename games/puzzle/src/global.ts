import type { PuzzleAction } from './puzzles/types.ts';
export interface GlobalEntry { id: string; rank: number; nickname: string; score: number; timeMs: number; tier: string }
export interface GlobalBoard { board: string; tier: string; entries: GlobalEntry[]; total: number; me?: GlobalEntry | null }
export interface Credentials { runId: string; token: string; board: string; expiresAt: string }
export interface Finished { verified: boolean; score: number; timeMs: number; wouldRank: number }
export interface Claimed { rank: number | null; personalBest: boolean; needsNickname: boolean }
export interface Attempt { board: string; credentials: Promise<Credentials | null>; finished?: Promise<Finished | null> }
export class GlobalError extends Error {
    code: string; loginUrl?: string;
    constructor(code: string, message: string, loginUrl?: string) { super(message); this.code = code; this.loginUrl = loginUrl; }
}
const base = '/api/games/river-crossing';
const prefix = 'appai:leaderboard:';
export function createGlobalClient(fetcher: typeof fetch, storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
    async function request<T>(path: string, method = 'GET', body?: unknown, token?: string): Promise<T> {
        const response = await fetcher(path, { method, credentials: 'same-origin', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        const result = await response.json();
        if (!response.ok) throw new GlobalError(result.error, result.message, result.loginUrl);
        return result;
    }
    return {
        start(board: string): Attempt {
            return { board, credentials: request<Omit<Credentials, 'board'> & { startedAt: string }>(`${base}/runs`, 'POST', { board }).then(result => {
                const credentials = { ...result, board };
                try { storage?.setItem(prefix + result.runId, JSON.stringify(credentials)); } catch { /* Private/offline storage must not stop play. */ }
                return credentials;
            }).catch(() => null) };
        },
        resume(id: string): Attempt | null {
            try {
                const saved: Credentials = JSON.parse(storage?.getItem(prefix + id) ?? 'null');
                if (saved?.runId === id && /^[\w-]{32,128}$/.test(saved.token) && /^(river|bridge|water):(easy|medium|hard)$/.test(saved.board) && Date.parse(saved.expiresAt) > Date.now()) return { board: saved.board, credentials: Promise.resolve(saved) };
            } catch { /* Missing or corrupt credentials are ignored. */ }
            return null;
        },
        finish(attempt: Attempt, moves: PuzzleAction[]) {
            if (!attempt.finished) attempt.finished = attempt.credentials.then(async credentials => {
                if (!credentials) return null;
                const result = await request<Finished>(`${base}/runs/${credentials.runId}/finish`, 'POST', { moves }, credentials.token);
                credentials.expiresAt = new Date(Date.now() + 86_400_000).toISOString();
                try { storage?.setItem(prefix + credentials.runId, JSON.stringify(credentials)); } catch { }
                return result;
            }).catch(() => null);
            return attempt.finished;
        },
        async claim(attempt: Attempt) {
            const credentials = await attempt.credentials;
            if (!credentials) throw new GlobalError('unavailable', '');
            return request<Claimed>(`${base}/runs/${credentials.runId}/claim`, 'POST', {}, credentials.token);
        },
        leaderboard: (board: string, limit = 50) => request<GlobalBoard>(`${base}/leaderboard?board=${encodeURIComponent(board)}&limit=${limit}`),
        nickname: (nickname: string) => request<{ nickname: string; nextChangeAt: string }>('/api/games/profile', 'PUT', { nickname }),
    };
}
