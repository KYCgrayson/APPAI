import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCommit,
  applyGuess,
  applyReply,
  applySkip,
  createGame,
  other,
  type Game,
  type Move,
  type Seat,
} from '../src/logic/game.ts';
import { OnlineSession, restoreRoomState } from '../src/net/online.ts';
import { RoomError, RoomsClient, normalizeCode, type Room } from '../src/net/rooms.ts';
import { roomURL } from '../src/ui/input.ts';
import { roomErrorText, strings } from '../src/ui/i18n.ts';
import { waitingSecretScreen } from '../src/ui/screens.ts';
import { readScores, recordScore, scoreIdentity } from '../src/ui/storage.ts';

const playing = () =>
  applyCommit(
    applyCommit(createGame({ id: 'round3', names: ['Host', 'Guest'] }), 0, 'a'.repeat(64)),
    1,
    'b'.repeat(64),
  );
const room = (state = playing()): Room => ({
  code: 'ABC234',
  game: 'guess-duel',
  version: 2,
  state,
  turn: state.turn,
  seats: [0, 1].map((seat) => ({
    seat: seat as Seat,
    joined: true,
    online: true,
    idleSeconds: 120,
  })),
  moves: [
    { version: 1, seat: 0, move: { t: 'commit', h: 'a'.repeat(64) } },
    { version: 2, seat: 1, move: { t: 'commit', h: 'b'.repeat(64) } },
  ],
  status: 'playing',
  expiresAt: '2030-01-01',
});

// Like the API, a skip writes only the move log and room turn, leaving state stale.
function server(initial: Room) {
  let latest = structuredClone(initial);
  const sent: { state?: Game; skip?: boolean; version: number }[] = [];
  const client = new RoomsClient(undefined, (async (_url, init) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body as string);
      sent.push(body);
      assert.equal(body.version, latest.version);
      const seat = Number((init.headers as Record<string, string>).Authorization.at(-1)) as Seat;
      latest = {
        ...latest,
        version: latest.version + 1,
        state: body.skip ? latest.state : body.state,
        turn: body.skip ? other(latest.turn) : body.nextTurn,
        moves: [
          ...latest.moves,
          {
            version: latest.version + 1,
            seat,
            move: body.move ?? ({} as Move),
            ...(body.skip ? { skipped: true } : {}),
          },
        ].slice(-20),
      };
      return Response.json({ room: latest });
    }
    return Response.json({ changed: true, room: latest });
  }) as typeof fetch);
  const session = (seat: Seat, snapshot = latest, changed: (room: Room) => void = () => {}) =>
    new OnlineSession(client, latest.code, 'token' + seat, seat, snapshot, changed, (e) => {
      throw e;
    });
  return { client, session, sent, snapshot: () => structuredClone(latest) };
}

test('rejoin after a skip restores the host turn and the next move persists corrected state', async () => {
  const s = server(room());
  const host = s.session(0);
  await host.send({ t: 'guess', g: '012' });
  const unanswered = host.room.state;
  await host.skip();
  assert.equal(s.snapshot().state.turn, 1, 'server state stays stale after skip');
  const response = await s.client.poll('ABC234', 'token0', -1);
  const rejoined = s.session(0, response.room);
  assert.deepEqual(rejoined.room.state, applySkip(unanswered));
  assert.equal(rejoined.room.state.turn, 0);
  await rejoined.send({ t: 'guess', g: '345' });
  assert.deepEqual(s.sent.at(-1)!.state!.history[0], [{ g: '345' }]);
  assert.equal(s.sent.at(-1)!.state!.seq, unanswered.seq + 2);
  assert.deepEqual(s.session(1).room.state, rejoined.room.state);
});

test('double skip restores both skips even when the final turn matches stale state', async () => {
  const initial = room(applyGuess(playing(), 0, '012'));
  initial.version = 3;
  initial.moves.push({ version: 3, seat: 0, move: { t: 'guess', g: '012' } });
  const s = server(initial);
  await s.session(0).skip();
  await s.session(1).skip();
  const expected = applySkip(applySkip(initial.state));
  assert.equal(expected.turn, initial.state.turn);
  assert.deepEqual(s.session(0).room.state, expected);
  assert.deepEqual(s.session(1).room.state, expected);
  assert.equal(expected.history[0].length, 0);
  const guest = s.session(1);
  await guest.send({ t: 'guess', g: '345' });
  assert.deepEqual(s.sent.at(-1)!.state, applyGuess(expected, 1, '345'));
});

test('a live poll processes double skips once and agrees with a later reload', async () => {
  const initial = room();
  const s = server(initial);
  await s.session(1).skip();
  await s.session(0).skip();
  const expected = applySkip(applySkip(initial.state));
  let live!: OnlineSession;
  await new Promise<void>((resolve, reject) => {
    live = s.session(0, initial, (updated) => {
      live.stop();
      try {
        assert.deepEqual(updated.state, expected);
        assert.deepEqual(updated.state, s.session(1).room.state);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
    live.start();
  });
  await live.send({ t: 'guess', g: '345' });
  assert.equal(s.sent.at(-1)!.state!.seq, expected.seq + 1);
});

test('snapshot restoration replays only skips after the last state write and is immutable', () => {
  const before = playing();
  const corrected = applySkip(before);
  const state = applyReply(applyGuess(corrected, 1, '345'), 0, '0A0B');
  const snapshot = room(state);
  snapshot.version = 6;
  snapshot.turn = 1;
  snapshot.moves.push(
    { version: 3, seat: 1, skipped: true, move: {} as Move },
    { version: 4, seat: 1, move: { t: 'guess', g: '345' } },
    { version: 5, seat: 0, move: { t: 'reply', r: '0A0B' } },
    { version: 6, seat: 1, skipped: true, move: {} as Move },
  );
  const copy = structuredClone(snapshot);
  assert.deepEqual(restoreRoomState(snapshot), applySkip(state));
  assert.deepEqual(snapshot, copy);
  assert.throws(() => restoreRoomState({ ...snapshot, state: { ...state, n: 9 } }));
});

test('a truncated run of skips still restores the authoritative room turn', () => {
  const snapshot = room();
  snapshot.version = 23;
  snapshot.turn = 1;
  snapshot.moves = Array.from({ length: 20 }, (_, i) => ({
    version: i + 4,
    seat: (i % 2) as Seat,
    skipped: true,
    move: {} as Move,
  }));
  assert.equal(restoreRoomState(snapshot).turn, 1);
});

test('created room URLs preserve settings and replace any previous room code', () => {
  const url = new URL(
    roomURL('https://appai.info/games/guess-duel/?locale=zh-TW&theme=dark&room=OLD234', 'ABC234'),
  );
  assert.equal(url.pathname, '/games/guess-duel/');
  assert.equal(url.searchParams.get('room'), 'ABC234');
  assert.equal(url.searchParams.getAll('room').length, 1);
  assert.equal(url.searchParams.get('locale'), 'zh-TW');
  assert.equal(url.searchParams.get('theme'), 'dark');
});

test('full-room waiting screens name the uncommitted player without share or start controls', () => {
  for (const lang of ['zh-TW', 'en'] as const) {
    for (const seat of [0, 1] as const) {
      const state = applyCommit(createGame({ names: ['Host', 'Guest'] }), seat, 'a'.repeat(64));
      const snapshot = room(state);
      const html = waitingSecretScreen(snapshot, seat, strings[lang].waitingSecret)!;
      assert.ok(html.includes(state.names[other(seat)]));
      assert.ok(html.includes('role="status"'));
      assert.ok(!/qr|data-action|input|scan|掃描/.test(html));
      snapshot.seats[1].joined = false;
      assert.equal(waitingSecretScreen(snapshot, seat, strings[lang].waitingSecret), null);
    }
  }
  const snapshot = room(createGame({ names: ['<Guest>', 'Host'] }));
  assert.ok(waitingSecretScreen(snapshot, 1, strings.en.waitingSecret)!.includes('&lt;Guest&gt;'));
});

test('invalid room codes never fetch and room errors have specific localized notices', async () => {
  let calls = 0;
  const client = new RoomsClient(undefined, (async () => {
    calls++;
    return Response.json({});
  }) as typeof fetch);
  for (const code of ['', 'ABC', 'IIIIII', 'ABC2345']) {
    await assert.rejects(
      client.join(code),
      (e) => e instanceof RoomError && e.error === 'invalid_code',
    );
  }
  assert.equal(calls, 0);
  assert.equal(normalizeCode(' ab-c2 34 '), 'ABC234');
  assert.equal(roomErrorText('room_full', 'zh-TW'), '房間已經滿了');
  assert.equal(roomErrorText('invalid_code', 'zh-TW'), '房號是 6 個字母或數字');
  assert.equal(roomErrorText('invalid_state', 'zh-TW'), '這個房間的資料有問題');
  for (const error of ['room_full', 'invalid_code', 'invalid_state'])
    assert.notEqual(roomErrorText(error, 'en'), strings.en.invalid);
});

test('relay scores follow names across guest-created rematches and remain separate from AI', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const host = scoreIdentity(['Parent', 'Kid']);
  const guest = scoreIdentity(['Kid', 'Parent']);
  assert.equal(host.key, guest.key);
  recordScore(storage, host.key, host.seats[0], 'host-wins');
  recordScore(storage, guest.key, guest.seats[1], 'guest-rematch-parent-wins');
  recordScore(storage, guest.key, 'draw', 'draw');
  const scores = readScores(storage)[host.key];
  assert.equal(scores.wins[host.seats[0]], 2);
  assert.equal(scores.wins[host.seats[1]], 0);
  assert.equal(scores.draws, 1);
  assert.notEqual(scoreIdentity(['Parent', 'Kid'], true).key, host.key);
  assert.deepEqual(scoreIdentity(['Same', 'Same']).seats, [0, 1]);
});

test('existing score rows in either name order merge without losing wins or draws', () => {
  const rows = {
    [JSON.stringify(['duel', 'Parent', 'Kid'])]: { wins: [2, 1], draws: 3 },
    [JSON.stringify(['duel', 'Kid', 'Parent'])]: { wins: [4, 5], draws: 6 },
    [JSON.stringify(['ai', 'Parent', 'Computer'])]: { wins: [7, 8], draws: 9 },
  };
  const copy = structuredClone(rows);
  const storage = {
    getItem: () => JSON.stringify(rows),
    setItem() {},
    removeItem() {},
  };
  const scores = readScores(storage);
  assert.deepEqual(scores[scoreIdentity(['Parent', 'Kid']).key], { wins: [5, 7], draws: 9 });
  assert.deepEqual(scores[scoreIdentity(['Parent', 'Computer'], true).key], {
    wins: [7, 8],
    draws: 9,
  });
  assert.deepEqual(rows, copy);
});
