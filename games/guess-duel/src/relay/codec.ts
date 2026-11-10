import {
  createGame,
  applyCommit,
  applyGuess,
  applyReply,
  applyReveal,
  allCodes,
  validateGame,
  type Game,
  type Seat,
} from '../logic/game.ts';
// Binary fields stay binary: 18 bits per guess/reply, 32 bytes per hash, 16 per salt.
export function encode(s: Game): string {
  const bytes: number[] = [];
  const header = new TextEncoder().encode(JSON.stringify([s.id, s.n, s.names, s.first]));
  bytes.push(header.length >> 8, header.length & 255, ...header);
  const hex = (v: string) => {
    for (let i = 0; i < v.length; i += 2) bytes.push(parseInt(v.slice(i, i + 2), 16));
  };
  for (const h of s.commits) {
    bytes.push(h ? 1 : 0);
    if (h) hex(h);
  }
  const entries = [];
  for (let i = 0; i < Math.max(...s.history.map((h) => h.length)); i++)
    for (const seat of [s.first, (1 - s.first) as Seat]) {
      const e = s.history[seat][i];
      if (e) entries.push(e);
    }
  bytes.push(entries.length >> 8, entries.length & 255);
  let bits = '';
  const codes = allCodes(s.n);
  for (const e of entries)
    bits += ((codes.indexOf(e.g) << 5) | (e.r ? e.r.a * 5 + e.r.b : 31))
      .toString(2)
      .padStart(18, '0');
  for (let i = 0; i < bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8).padEnd(8, '0'), 2));
  for (const r of s.reveals) {
    bytes.push(r ? 1 : 0);
    if (r) {
      const index = codes.indexOf(r.secret);
      bytes.push(index >> 8, index & 255);
      hex(r.salt);
    }
  }
  return (
    '#r=' +
    btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  );
}
export function decode(fragment: string): Game {
  if (fragment.length > 12000 || !/^#r=[A-Za-z0-9_-]+$/.test(fragment)) throw Error('Invalid link');
  const bytes = Uint8Array.from(
    atob(fragment.slice(3).replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0),
  );
  let pos = 0;
  const read = () => {
    if (pos >= bytes.length) throw Error('Invalid link');
    return bytes[pos++];
  };
  const hex = (n: number) =>
    Array.from({ length: n }, () => read().toString(16).padStart(2, '0')).join('');
  const size = read() * 256 + read();
  const head = JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(pos, pos + size)),
  );
  pos += size;
  if (!Array.isArray(head) || head.length !== 4) throw Error('Invalid link');
  let s = validateGame(createGame({ id: head[0], n: head[1], names: head[2], first: head[3] }));
  for (const seat of [0, 1] as Seat[]) {
    const flag = read();
    if (flag > 1) throw Error('Invalid link');
    if (flag) s = applyCommit(s, seat, hex(32));
  }
  const count = read() * 256 + read();
  if (count > 400) throw Error('Invalid history');
  const length = Math.ceil((count * 18) / 8);
  let bits = '';
  for (let i = 0; i < length; i++) bits += read().toString(2).padStart(8, '0');
  const codes = allCodes(s.n);
  for (let i = 0; i < count; i++) {
    const v = parseInt(bits.slice(i * 18, i * 18 + 18), 2),
      reply = v & 31;
    s = applyGuess(s, s.turn, codes[v >> 5]);
    if (reply !== 31) s = applyReply(s, s.turn, { a: Math.floor(reply / 5), b: reply % 5 });
    else if (i !== count - 1) throw Error('Invalid pending guess');
  }
  for (const seat of [0, 1] as Seat[]) {
    const flag = read();
    if (flag > 1) throw Error('Invalid link');
    if (flag) {
      const secret = codes[read() * 256 + read()];
      s = applyReveal(s, seat, secret, hex(16));
    }
  }
  if (pos !== bytes.length) throw Error('Invalid link');
  return validateGame(s);
}
