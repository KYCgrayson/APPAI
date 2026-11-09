export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}
export const safeGet = (s: StorageLike, k: string): unknown => {
  try {
    return JSON.parse(s.getItem(k) ?? 'null');
  } catch {
    return null;
  }
};
export function safeSet(s: StorageLike, k: string, v: unknown) {
  try {
    s.setItem(k, JSON.stringify(v));
  } catch {
    /* Private browsing or full storage: play continues. */
  }
}
export type Scores = Record<
  string,
  {
    wins: [number, number];
    draws: number;
  }
>;
export function readScores(s: StorageLike): Scores {
  const v = safeGet(s, 'guess-duel-scores');
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Scores = {};
  for (const [k, r] of Object.entries(v)) {
    if (
      r &&
      Array.isArray(r.wins) &&
      r.wins.length === 2 &&
      [...r.wins, r.draws].every((x) => Number.isSafeInteger(x) && x >= 0)
    )
      out[k] = r;
  }
  return out;
}
export function recordScore(s: StorageLike, key: string, result: 0 | 1 | 'draw', gameId?: string) {
  const completed = safeGet(s, 'guess-duel:completed');
  const ids = Array.isArray(completed) ? completed.filter((x) => typeof x === 'string') : [];
  if (gameId && ids.includes(gameId)) return readScores(s)[key];
  const rows = readScores(s),
    r = rows[key] ?? { wins: [0, 0], draws: 0 };
  if (result === 'draw') r.draws++;
  else r.wins[result]++;
  rows[key] = r;
  safeSet(s, 'guess-duel-scores', rows);
  if (gameId) safeSet(s, 'guess-duel:completed', [...ids, gameId].slice(-500));
  return r;
}
export function resilientStorage(getStorage: () => Storage): StorageLike {
  const memory = new Map<string, string>();
  let backing: Storage | undefined;
  try {
    backing = getStorage();
  } catch {}
  return {
    getItem(k) {
      if (memory.has(k)) return memory.get(k)!;
      try {
        return backing?.getItem(k) ?? null;
      } catch {
        return memory.get(k) ?? null;
      }
    },
    setItem(k, v) {
      memory.set(k, v);
      try {
        backing?.setItem(k, v);
      } catch {}
    },
    removeItem(k) {
      memory.delete(k);
      try {
        backing?.removeItem(k);
      } catch {}
    },
  };
}
export function cleanupSessions(getStorage: () => Storage, now = Date.now()) {
  try {
    const s = getStorage();
    for (let i = s.length - 1; i >= 0; i--) {
      const k = s.key(i)!;
      if (!/^guess-duel:(online|relay):/.test(k)) continue;
      const v = safeGet(s, k) as any;
      if (!v?.updatedAt || now - v.updatedAt > 2 * 86400000) s.removeItem(k);
    }
  } catch {}
}
