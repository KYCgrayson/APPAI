import assert from 'node:assert/strict';
import { applyCommit, createGame, type Seat } from '../../src/logic/game.ts';
import { type Room } from '../../src/net/rooms.ts';

export const setup = () => createGame({ id: 'round4', names: ['Host', 'Guest'] });
export const playing = () =>
  applyCommit(applyCommit(setup(), 0, 'a'.repeat(64)), 1, 'b'.repeat(64));
export const room = (state = setup()): Room => ({
  code: 'ABC234',
  game: 'guess-duel',
  version: state.seq,
  state,
  turn: state.turn,
  seats: [0, 1].map((seat) => ({
    seat: seat as Seat,
    joined: true,
    online: true,
    idleSeconds: 0,
  })),
  moves: [],
  status: 'playing',
  expiresAt: '2030-01-01',
});

/** Echo the actual submitted state and retain all moves, like the rooms transport. */
export function server(initial = room()) {
  let latest = structuredClone(initial);
  const fetcher =
    (seat: Seat): typeof fetch =>
    async (url, init) => {
      const path = new URL(String(url));
      if (path.pathname.endsWith('/join'))
        return Response.json({ seat, token: 'token' + seat, room: latest });
      if (path.pathname.endsWith('/moves')) {
        const body = JSON.parse(init!.body as string);
        assert.equal(body.version, latest.version);
        latest = {
          ...latest,
          state: body.state,
          version: latest.version + 1,
          turn: body.nextTurn,
          moves: [...latest.moves, { version: latest.version + 1, seat, move: body.move }],
        };
        return Response.json({ room: latest });
      }
      return Response.json(
        Number(path.searchParams.get('since')) < latest.version
          ? { changed: true, room: latest }
          : { changed: false, version: latest.version, seats: latest.seats },
      );
    };
  return { fetcher, snapshot: () => structuredClone(latest) };
}
