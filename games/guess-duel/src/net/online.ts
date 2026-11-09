import { commit } from '../logic/commit.ts';
import {
  applySkip,
  validateGame,
  reduceMove,
  type Game,
  type Move,
  type Seat,
} from '../logic/game.ts';
import { RoomsClient, type Room } from './rooms.ts';
export function processMoves(
  state: Game,
  moves: Room['moves'],
  since: number,
): {
  state: Game;
  since: number;
} {
  let s = state,
    v = since;
  for (const item of [...moves].sort((a, b) => a.version - b.version)) {
    if (item.version <= v) continue;
    v = item.version;
    try {
      if (item.seat !== 0 && item.seat !== 1) continue;
      s = item.skipped ? applySkip(s) : reduceMove(s, item.seat, item.move);
    } catch {
      /* Invalid peer messages never enter the reducer state. */
    }
  }
  return { state: s, since: v };
}
/** Real moves write state; skips only update the room turn and move log. */
export function restoreRoomState(room: Room): Game {
  const state = validateGame(room.state);
  const lastWrite = Math.max(0, ...room.moves.filter((m) => !m.skipped).map((m) => m.version));
  const restored = processMoves(state, room.moves, lastWrite).state;
  // The API retains only 20 moves. Even a longer run of skips must use its turn.
  if (restored.status === 'playing' && room.moves.some((m) => m.skipped && m.version > lastWrite)) {
    if (room.turn !== 0 && room.turn !== 1) throw Error('Invalid room turn');
    return { ...restored, turn: room.turn };
  }
  return restored;
}
export class OnlineSession {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private busy = false;
  client: RoomsClient;
  code: string;
  token: string;
  seat: Seat;
  room: Room;
  private changed: (room: Room) => void;
  private failed: (e: unknown) => void;
  constructor(
    client: RoomsClient,
    code: string,
    token: string,
    seat: Seat,
    room: Room,
    changed: (room: Room) => void,
    failed: (e: unknown) => void,
  ) {
    this.client = client;
    this.code = code;
    this.token = token;
    this.seat = seat;
    this.room = { ...room, state: restoreRoomState(room) };
    this.changed = changed;
    this.failed = failed;
  }
  start() {
    this.stopped = false;
    void this.tick();
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
  }
  private async tick() {
    try {
      if (!this.busy) {
        const d = await this.client.poll(this.code, this.token, this.room.version);
        if (d.changed) {
          const processed = processMoves(this.room.state, d.room.moves, this.room.version);
          this.room = { ...d.room, state: processed.state };
        } else if (d.seats) this.room = { ...this.room, seats: d.seats };
        this.changed(this.room);
      }
    } catch (e) {
      this.failed(e);
    } finally {
      if (!this.stopped)
        this.timer = setTimeout(
          () => void this.tick(),
          typeof document !== 'undefined' && document.hidden ? 15000 : 1200,
        );
    }
  }
  async send(move: Move) {
    this.busy = true;
    try {
      let sentState: Game | undefined;
      const build = (room: Room) => {
        const base = processMoves(this.room.state, room.moves, this.room.version).state;
        const state = reduceMove(base, this.seat, move);
        sentState = state;
        return {
          version: room.version,
          move,
          state,
          nextTurn:
            (move.t === 'commit' && state.status === 'setup') || move.t === 'reveal'
              ? ((1 - this.seat) as Seat)
              : state.turn,
          end: state.status === 'finished' && state.reveals.every(Boolean),
        };
      };
      const d = await this.client.sendMove(this.code, this.token, build(this.room), build);
      this.room = { ...d.room, state: sentState! };
      this.changed(this.room);
    } finally {
      this.busy = false;
    }
  }
  async skip() {
    const d = await this.client.skip(this.code, this.token, this.room.version);
    this.room = {
      ...d.room,
      state: processMoves(this.room.state, d.room.moves, this.room.version).state,
    };
    this.changed(this.room);
  }
}

export function onlineScreen(room: Room, seat: Seat, hasSecret: boolean) {
  if (room.status !== 'playing') return 'waiting';
  if (!room.state.commits[seat] && !hasSecret) return 'secret';
  if (!room.state.commits.every(Boolean)) return 'waiting';
  return 'play';
}

export async function canResumeSeat(
  state: Game,
  seat: Seat,
  local?: { secret: string; salt: string },
) {
  if (!state.commits[seat]) return true;
  if (!local) return false;
  return (await commit(local.secret, local.salt)) === state.commits[seat];
}
