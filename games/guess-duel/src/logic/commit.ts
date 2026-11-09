import { score, other, type Game, type Seat } from './game.ts';
export function randomSalt(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
export async function commit(secret: string, salt: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret + ':' + salt));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function verify(secret: string, salt: string, hash: string): Promise<boolean> {
  return (await commit(secret, salt)) === hash;
}
export async function verifyGame(s: Game): Promise<boolean> {
  for (const seat of [0, 1] as Seat[]) {
    const reveal = s.reveals[seat];
    if (!reveal || !(await verify(reveal.secret, reveal.salt, s.commits[seat]!))) return false;
    for (const e of s.history[other(seat)]) {
      const r = score(reveal.secret, e.g);
      if (!e.r || e.r.a !== r.a || e.r.b !== r.b) return false;
    }
  }
  return true;
}
