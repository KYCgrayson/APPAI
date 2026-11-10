import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomsClient, RoomError, apiBase } from '../src/net/rooms.ts';
import { processMoves } from '../src/net/online.ts';
import {
  createGame,
  applyCommit,
  applyGuess,
  applyReply,
  applyReveal,
  applySkip,
  validateGame,
} from '../src/logic/game.ts';
import { encode, decode } from '../src/relay/codec.ts';
import { resilientStorage, cleanupSessions } from '../src/ui/storage.ts';
import { Audio } from '../src/ui/audio.ts';
import { keyboardAction, rematchNames } from '../src/ui/input.ts';
const playing = () => applyCommit(applyCommit(createGame(), 0, 'a'.repeat(64)), 1, 'b'.repeat(64));
test('fetch is called without a client receiver; create includes credentials; start uses Bearer', async () => {
  const calls: RequestInit[] = [];
  const fetcher = async function (this: unknown, _url: unknown, init?: RequestInit) {
    assert.equal(this, undefined);
    calls.push(init!);
    return new Response('{}');
  } as typeof fetch;
  const client = new RoomsClient(undefined, fetcher);
  await client.create(createGame());
  await client.start('ABC234', 'token');
  assert.equal(calls[0].credentials, 'include');
  assert.equal((calls[1].headers as any).Authorization, 'Bearer token');
  assert.equal(calls[1].body, '{}');
});
test('default fetch wrapper supports a this-sensitive global fetch', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async function (this: unknown) {
    assert.equal(this, undefined);
    return new Response('{}');
  } as typeof fetch;
  try {
    await new RoomsClient().create(createGame());
  } finally {
    globalThis.fetch = original;
  }
});
test('v4 origins and override validation', () => {
  assert.equal(
    apiBase({ hostname: 'appai.info', origin: 'https://appai.info' }),
    'https://appai.info',
  );
  assert.equal(
    apiBase({ hostname: 'www.appai.info', origin: 'https://www.appai.info' }),
    'https://www.appai.info',
  );
  assert.equal(
    apiBase({ hostname: 'localhost', origin: 'http://localhost' }),
    'https://appai.info',
  );
  assert.equal(
    apiBase({ hostname: 'localhost', origin: 'http://localhost' }, 'javascript:bad'),
    'https://appai.info',
  );
});
test('?api= cannot send seat tokens to another origin', () => {
  const prod = { hostname: 'appai.info', origin: 'https://appai.info' };
  assert.equal(apiBase(prod, 'https://evil.example'), 'https://appai.info');
  assert.equal(apiBase(prod, 'https://appai.info/x'), 'https://appai.info');
  assert.equal(
    apiBase({ hostname: 'localhost', origin: 'http://localhost:5173' }, 'https://evil.example'),
    'https://appai.info',
  );
  assert.equal(
    apiBase({ hostname: 'localhost', origin: 'http://localhost:5173' }, 'http://localhost:4300', true),
    'http://localhost:4300',
  );
});
test('seat tokens are stored per API origin', () => {
  const a = new RoomsClient('https://appai.info'),
    b = new RoomsClient('http://localhost:4300');
  assert.notEqual(a.tokenKey('ABC234'), b.tokenKey('ABC234'));
});
test('hostile room state is rejected on success and conflict responses', async () => {
  for (const status of [200, 409]) {
    for (const bad of [
      { n: '<img src=x>' },
      { history: [[{ g: '012', r: { a: '<svg>', b: 0 } }], []] },
      { reveals: [{ secret: '<img>', salt: 'a'.repeat(32) }, null] },
    ]) {
      const fetcher = async () =>
        new Response(
          JSON.stringify({ error: 'version_conflict', room: { state: { ...playing(), ...bad } } }),
          { status },
        );
      await assert.rejects(
        new RoomsClient(undefined, fetcher as typeof fetch).poll('ABC234', 'x', 0),
        (e) => e instanceof RoomError && e.error === 'invalid_state',
      );
    }
  }
  const clean = validateGame({ ...createGame(), secret: 'PRIVATE' });
  assert.equal('secret' in clean, false);
  assert.throws(() => validateGame({ ...createGame(), id: 123 }));
});
test('skip removes pending guess immutably and both clients derive the same next turn', () => {
  const state = applyGuess(playing(), 0, '012');
  const moves = [
    { version: 7, seat: 0 as const, skipped: true, move: { t: 'guess' as const, g: 'bad' } },
  ];
  const a = processMoves(state, moves, 6).state;
  assert.deepEqual(a, applySkip(state));
  assert.equal(a.turn, 0);
  assert.equal(a.history[0].length, 0);
  assert.equal(state.history[0].length, 1);
  assert.deepEqual(processMoves(structuredClone(state), moves, 6).state, a);
  assert.doesNotThrow(() => applyGuess(a, 0, '345'));
  assert.equal(applySkip(playing()).turn, 1);
});
test('non-JSON create/join responses become unavailable; authenticated 404 clears tokens', async () => {
  let removed = '';
  const fetcher = async () => new Response('<html>404</html>', { status: 404 });
  const c = new RoomsClient(undefined, fetcher as typeof fetch, {
    getItem: () => null,
    setItem() {},
    removeItem(k) {
      removed = k;
    },
  });
  await assert.rejects(
    c.create(createGame()),
    (e) => e instanceof RoomError && e.error === 'unavailable',
  );
  await assert.rejects(
    c.join('ABC234'),
    (e) => e instanceof RoomError && e.error === 'unavailable',
  );
  await assert.rejects(
    c.poll('ABC234', 'token', 0),
    (e) => e instanceof RoomError && e.status === 404,
  );
  assert.equal(removed, 'room:https://appai.info/ABC234');
});
test('v4 error codes survive transport', async () => {
  for (const [status, error] of [
    [401, 'login_required'],
    [409, 'room_not_ready'],
    [403, 'not_host'],
  ] as const) {
    const c = new RoomsClient(
      undefined,
      (async () => new Response(JSON.stringify({ error }), { status })) as typeof fetch,
    );
    await assert.rejects(
      c.start('ABC234', 'token'),
      (e) => e instanceof RoomError && e.error === error,
    );
  }
});
test('blocked storage retains settings and secrets in memory; stale session cleanup', () => {
  const s = resilientStorage(() => {
    throw Error('blocked');
  });
  s.setItem('key', 'value');
  assert.equal(s.getItem('key'), 'value');
  s.removeItem('key');
  assert.equal(s.getItem('key'), null);
  const entries = new Map([
    ['guess-duel:relay:old', JSON.stringify({ updatedAt: 1 })],
    ['guess-duel:online:new', JSON.stringify({ updatedAt: 3 * 86400000 })],
    ['guess-duel-scores', '{}'],
  ]);
  const raw = {
    get length() {
      return entries.size;
    },
    key: (i: number) => [...entries.keys()][i],
    getItem: (k: string) => entries.get(k) ?? null,
    removeItem: (k: string) => entries.delete(k),
  };
  cleanupSessions(() => raw as unknown as Storage, 3 * 86400000);
  assert.equal(entries.has('guess-duel:relay:old'), false);
  assert.equal(entries.has('guess-duel:online:new'), true);
  assert.equal(entries.has('guess-duel-scores'), true);
});
test('missing or broken audio never interrupts input', () => {
  const audio = new Audio();
  assert.doesNotThrow(() => {
    audio.unlock();
    audio.play('key');
  });
  const previous = globalThis.AudioContext;
  (globalThis as any).AudioContext = class {
    constructor() {
      throw Error('blocked');
    }
  };
  try {
    assert.doesNotThrow(() => {
      audio.unlock();
      audio.play('submit');
    });
  } finally {
    globalThis.AudioContext = previous;
  }
});
test('keyboard is scoped to entry screens and leaves focused controls alone', () => {
  for (const screen of ['home', 'handover', 'share', 'reply'])
    assert.equal(keyboardAction(screen, 'Backspace', false), null);
  assert.equal(keyboardAction('play', 'Enter', true), null);
  assert.deepEqual(keyboardAction('secret', '1', false), { type: 'digit', value: '1' });
  assert.deepEqual(keyboardAction('play', 'Enter', false), { type: 'submit' });
});
test('relay guest rematch keeps their name on the creator seat', () => {
  assert.deepEqual(rematchNames(['Parent', 'Kid'], true, 1), ['Kid', 'Parent']);
  assert.deepEqual(rematchNames(['Parent', 'Kid'], true, 0), ['Parent', 'Kid']);
});
test('40 four-digit guesses and both reveals fit a 400-character full relay URL', () => {
  let s = createGame({ n: 4, names: ['爸爸', '小朋友'] });
  for (const seat of [0, 1] as const) s = applyCommit(s, seat, 'a'.repeat(64));
  for (let i = 0; i < 40; i++)
    s = applyReply(applyGuess(s, s.turn, '0123'), (1 - s.turn) as 0 | 1, i >= 38 ? '4A0B' : '0A0B');
  for (const seat of [0, 1] as const) s = applyReveal(s, seat, '0123', 'b'.repeat(32));
  const url = 'https://appai.info/games/guess-duel/' + encode(s);
  assert.ok(url.length <= 400, String(url.length));
  assert.deepEqual(decode(encode(s)), s);
});

test('online waits for joined room and both commitments before exposing a keypad', async () => {
  const { onlineScreen } = await import('../src/net/online.ts');
  const room = { status: 'waiting', state: createGame() } as any;
  assert.equal(onlineScreen(room, 0, false), 'waiting');
  room.status = 'playing';
  assert.equal(onlineScreen(room, 0, false), 'secret');
  room.state = applyCommit(room.state, 0, 'a'.repeat(64));
  assert.equal(onlineScreen(room, 0, true), 'waiting');
  room.state = applyCommit(room.state, 1, 'b'.repeat(64));
  assert.equal(onlineScreen(room, 0, true), 'play');
});

test('409 rebase derives a skip and next real move sends its updated state', async () => {
  const { OnlineSession } = await import('../src/net/online.ts');
  const initial = applyGuess(playing(), 0, '012');
  const base = {
    code: 'ABC234',
    state: initial,
    version: 4,
    turn: 1,
    seats: [],
    moves: [],
    status: 'playing',
    expiresAt: '2030-01-01',
  } as any;
  const latest = {
    ...base,
    version: 5,
    turn: 0,
    moves: [{ version: 5, seat: 0, skipped: true, move: {} }],
  };
  let count = 0;
  let body: any;
  const client = new RoomsClient(undefined, (async (_url, init) => {
    body = JSON.parse(init!.body as string);
    if (count++ === 0)
      return new Response(JSON.stringify({ error: 'version_conflict', room: latest }), {
        status: 409,
      });
    return new Response(JSON.stringify({ room: { ...latest, version: 6, state: body.state } }));
  }) as typeof fetch);
  // Start with a stale valid turn; the conflict includes a complete two-skip sequence.
  const ready = { ...base, state: playing(), turn: 0 };
  const skip1 = { version: 5, seat: 0, skipped: true, move: {} };
  const skip2 = { version: 6, seat: 0, skipped: true, move: {} };
  latest.version = 6;
  latest.moves = [skip1, skip2];
  const session = new OnlineSession(
    client,
    'ABC234',
    'token',
    0,
    ready,
    () => {},
    () => {},
  );
  await session.send({ t: 'guess', g: '345' });
  assert.equal(body.version, 6);
  assert.equal(body.state.seq, ready.state.seq + 3);
  assert.deepEqual(body.state.history[0], [{ g: '345' }]);
  assert.equal(session.room.state.turn, 1);
});

test('peer cannot pre-fill a guest commitment; reload requires matching local secret', async () => {
  const { canResumeSeat } = await import('../src/net/online.ts');
  const { commit } = await import('../src/logic/commit.ts');
  const local = { secret: '012', salt: 'a'.repeat(32) };
  const state = applyCommit(createGame(), 1, await commit(local.secret, local.salt));
  assert.equal(await canResumeSeat(state, 1), false);
  assert.equal(await canResumeSeat(state, 1, { ...local, secret: '345' }), false);
  assert.equal(await canResumeSeat(state, 1, local), true);
  assert.equal(await canResumeSeat(createGame(), 1), true);
});
