export type Seat = 0 | 1;
export type Reply = {
  a: number;
  b: number;
};
export type Entry = {
  g: string;
  r?: Reply;
};
export type Game = {
  id: string;
  n: number;
  names: [string, string];
  first: Seat;
  turn: Seat;
  seq: number;
  commits: [string | null, string | null];
  reveals: [
    {
      secret: string;
      salt: string;
    } | null,
    {
      secret: string;
      salt: string;
    } | null,
  ];
  history: [Entry[], Entry[]];
  status: 'setup' | 'playing' | 'finished';
  result: Seat | 'draw' | null;
};
export const other = (s: Seat): Seat => (s === 0 ? 1 : 0);
export function isValidCode(code: string, n: number): boolean {
  return (
    (n === 3 || n === 4) &&
    typeof code === 'string' &&
    new RegExp(`^\\d{${n}}$`).test(code) &&
    new Set(code).size === n
  );
}
export function score(secret: string, guess: string): Reply {
  let a = 0,
    b = 0;
  for (let i = 0; i < guess.length; i++) {
    if (secret[i] === guess[i]) a++;
    else if (secret.includes(guess[i])) b++;
  }
  return { a, b };
}
export function createGame(
  opts: {
    n?: number;
    names?: [string, string];
    first?: Seat;
    id?: string;
  } = {},
): Game {
  const n = opts.n ?? 3;
  if (n !== 3 && n !== 4) throw Error('Invalid length');
  return {
    id:
      opts.id ??
      Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join(''),
    n,
    names: opts.names ?? ['Player 1', 'Player 2'],
    first: opts.first ?? 0,
    turn: opts.first ?? 0,
    seq: 0,
    commits: [null, null],
    reveals: [null, null],
    history: [[], []],
    status: 'setup',
    result: null,
  };
}
const clone = (s: Game): Game => structuredClone(s);
export function applyCommit(s: Game, seat: Seat, h: string): Game {
  if (s.status !== 'setup' || s.commits[seat] || !/^[a-f0-9]{64}$/.test(h))
    throw Error('Invalid commitment');
  const t = clone(s);
  t.commits[seat] = h;
  t.seq++;
  if (t.commits.every(Boolean)) t.status = 'playing';
  return t;
}
export function applyGuess(s: Game, seat: Seat, g: string): Game {
  if (
    s.status !== 'playing' ||
    s.turn !== seat ||
    !isValidCode(g, s.n) ||
    s.history.some((h) => h.some((e) => !e.r))
  )
    throw Error('Invalid guess or turn');
  const t = clone(s);
  t.history[seat].push({ g });
  t.turn = other(seat);
  t.seq++;
  return t;
}
export function applyReply(s: Game, seat: Seat, r: Reply | string): Game {
  if (typeof r === 'string') {
    const m = /^(\d)A(\d)B$/.exec(r);
    if (!m) throw Error('Invalid reply');
    r = { a: +m[1], b: +m[2] };
  }
  const guesser = other(seat),
    entry = s.history[guesser].at(-1);
  if (
    s.status !== 'playing' ||
    s.turn !== seat ||
    !entry ||
    entry.r ||
    !Number.isInteger(r.a) ||
    !Number.isInteger(r.b) ||
    r.a < 0 ||
    r.b < 0 ||
    r.a + r.b > s.n ||
    (r.a === s.n - 1 && r.b === 1)
  )
    throw Error('Invalid reply');
  const t = clone(s);
  t.history[guesser].at(-1)!.r = r;
  t.seq++;
  const f = t.first,
    second = other(f),
    fh = t.history[f],
    sh = t.history[second];
  if (guesser === second) {
    if (r.a === t.n) t.result = fh.at(-1)?.r?.a === t.n ? 'draw' : second;
    else if (fh.at(-1)?.r?.a === t.n) t.result = f;
  }
  if (t.result !== null) t.status = 'finished';
  return t;
}
export function applyReveal(s: Game, seat: Seat, secret: string, salt: string): Game {
  if (
    s.status !== 'finished' ||
    s.reveals[seat] ||
    !isValidCode(secret, s.n) ||
    !/^[a-f0-9]{32}$/.test(salt)
  )
    throw Error('Invalid reveal');
  const t = clone(s);
  t.reveals[seat] = { secret, salt };
  t.seq++;
  return t;
}
export const winner = (s: Game) => s.result;
const cache = new Map<number, string[]>();
export function allCodes(n: number): string[] {
  if (cache.has(n)) return cache.get(n)!;
  const out: string[] = [];
  function walk(s: string) {
    if (s.length === n) {
      out.push(s);
      return;
    }
    for (let d = 0; d < 10; d++) if (!s.includes(String(d))) walk(s + d);
  }
  walk('');
  cache.set(n, out);
  return out;
}
export function candidates(n: number, history: Entry[]): string[] {
  return allCodes(n).filter((c) =>
    history.every(
      (e) =>
        !e.r ||
        (() => {
          const r = score(c, e.g);
          return r.a === e.r.a && r.b === e.r.b;
        })(),
    ),
  );
}
export function aiGuess(
  n: number,
  history: Entry[],
  difficulty = 'normal',
  rng: () => number = Math.random,
): string {
  const h = difficulty === 'easy' && rng() < 0.5 ? history.slice(-1) : history;
  const pool = candidates(n, h);
  if (!pool.length) throw Error('Inconsistent replies');
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}
export type Move =
  | {
      t: 'commit';
      h: string;
    }
  | {
      t: 'guess';
      g: string;
    }
  | {
      t: 'reply';
      r: string;
    }
  | {
      t: 'reveal';
      s: string;
      salt: string;
    };
export function reduceMove(s: Game, seat: Seat, m: Move): Game {
  switch (m.t) {
    case 'commit':
      return applyCommit(s, seat, m.h);
    case 'guess':
      return applyGuess(s, seat, m.g);
    case 'reply':
      return applyReply(s, seat, m.r);
    case 'reveal':
      return applyReveal(s, seat, m.s, m.salt);
    default:
      throw Error('Invalid move');
  }
}
// A skip forfeits the unanswered guess, if any, and hands play to the next seat.
export function applySkip(s: Game): Game {
  if (s.status !== 'playing') throw Error('Invalid skip');
  const t = clone(s);
  for (const h of t.history) if (h.at(-1) && !h.at(-1)!.r) h.pop();
  t.turn = other(s.turn);
  t.seq++;
  return t;
}
export function validateGame(value: unknown): Game {
  const s = value as Game;
  if (
    !s ||
    typeof s !== 'object' ||
    typeof s.id !== 'string' ||
    !/^[\w-]{1,64}$/.test(s.id) ||
    ![3, 4].includes(s.n) ||
    ![0, 1].includes(s.first) ||
    ![0, 1].includes(s.turn) ||
    !Number.isSafeInteger(s.seq) ||
    s.seq < 0 ||
    !Array.isArray(s.names) ||
    s.names.length !== 2 ||
    !s.names.every((n) => typeof n === 'string' && n.length > 0 && n.length <= 40) ||
    !Array.isArray(s.commits) ||
    s.commits.length !== 2 ||
    !s.commits.every((h) => h === null || (typeof h === 'string' && /^[a-f0-9]{64}$/.test(h))) ||
    !Array.isArray(s.history) ||
    s.history.length !== 2 ||
    !s.history.every(
      (h) =>
        Array.isArray(h) &&
        h.length <= 200 &&
        h.every(
          (e) =>
            e &&
            isValidCode(e.g, s.n) &&
            (!e.r ||
              (Number.isInteger(e.r.a) &&
                Number.isInteger(e.r.b) &&
                e.r.a >= 0 &&
                e.r.b >= 0 &&
                e.r.a + e.r.b <= s.n &&
                !(e.r.a === s.n - 1 && e.r.b === 1))),
        ),
    ) ||
    !['setup', 'playing', 'finished'].includes(s.status) ||
    ![null, 0, 1, 'draw'].includes(s.result) ||
    !Array.isArray(s.reveals) ||
    s.reveals.length !== 2 ||
    !s.reveals.every(
      (r) =>
        r === null ||
        (s.status === 'finished' &&
          isValidCode(r.secret, s.n) &&
          typeof r.salt === 'string' &&
          /^[a-f0-9]{32}$/.test(r.salt)),
    ) ||
    (s.status !== 'setup' && !s.commits.every(Boolean)) ||
    (s.status === 'finished') !== (s.result !== null)
  )
    throw Error('Invalid game state');
  if (s.status === 'setup' && (s.history.some((h) => h.length) || s.commits.every(Boolean)))
    throw Error('Invalid setup');
  if (s.history.flat().filter((e) => !e.r).length > 1) throw Error('Invalid pending guess');
  return {
    id: s.id,
    n: s.n,
    names: [...s.names],
    first: s.first,
    turn: s.turn,
    seq: s.seq,
    commits: [...s.commits],
    reveals: s.reveals.map((r) =>
      r ? { secret: r.secret, salt: r.salt } : null,
    ) as Game['reveals'],
    history: s.history.map((h) =>
      h.map((e) => (e.r ? { g: e.g, r: { a: e.r.a, b: e.r.b } } : { g: e.g })),
    ) as Game['history'],
    status: s.status,
    result: s.result,
  };
}
