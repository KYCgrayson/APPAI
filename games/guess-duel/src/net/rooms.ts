import { validateGame, type Game, type Move, type Seat } from '../logic/game.ts';
import type { StorageLike } from '../ui/storage.ts';
export type Room = {
  code: string;
  game: string;
  version: number;
  state: Game;
  turn: Seat;
  seats: {
    seat: Seat;
    joined: boolean;
    online: boolean;
    idleSeconds: number;
  }[];
  moves: {
    version: number;
    seat: Seat;
    move: Move;
    skipped?: boolean;
  }[];
  lastMove?: unknown;
  status: 'waiting' | 'playing' | 'finished';
  expiresAt: string;
};
export class RoomError extends Error {
  status: number;
  error: string;
  room?: Room;
  constructor(status: number, error: string, room?: Room) {
    super(error);
    this.status = status;
    this.error = error;
    this.room = room;
  }
}
export class RoomsClient {
  base: string;
  private fetcher: typeof fetch;
  private storage?: StorageLike;
  private sleep: (ms: number) => Promise<void>;
  constructor(
    base = 'https://appai.info',
    fetcher: typeof fetch = (...args) => fetch(...args),
    storage?: StorageLike,
    sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {
    this.base = base;
    this.fetcher = (...args) => Reflect.apply(fetcher, undefined, args);
    this.storage = storage;
    this.sleep = sleep;
    const u = new URL(base);
    if (!['http:', 'https:'].includes(u.protocol)) throw Error('Invalid API origin');
    this.base = u.origin;
  }
  private async request(path: string, body?: unknown, token?: string, retry = true): Promise<any> {
    let response: Response;
    try {
      response = await this.fetcher(this.base + '/api/rooms' + path, {
        method: body === undefined ? 'GET' : 'POST',
        ...(path === '' ? { credentials: 'include' as const } : {}),
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new RoomError(503, 'unavailable');
    }
    if (response.status === 429 && retry) {
      const raw = response.headers.get('Retry-After') ?? '1';
      const seconds = Number(raw);
      await this.sleep(
        Number.isFinite(seconds)
          ? Math.max(0, seconds * 1000)
          : Math.max(0, Date.parse(raw) - Date.now()),
      );
      return this.request(path, body, token, false);
    }
    if (response.status === 404 && token) {
      try {
        this.storage?.removeItem(this.tokenKey((path.split('/')[1] ?? '').split('?')[0]));
      } catch {}
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new RoomError(
        token && response.status === 404 ? 404 : 503,
        token && response.status === 404 ? 'room_not_found' : 'unavailable',
      );
    }
    if (data.room) {
      try {
        data.room.state = validateGame(data.room.state);
      } catch {
        throw new RoomError(400, 'invalid_state');
      }
    }
    if (!response.ok) {
      if (response.status === 404 && this.storage) {
        try {
          this.storage.removeItem(this.tokenKey((path.split('/')[1] ?? '').split('?')[0]));
        } catch {}
      }
      throw new RoomError(response.status, data.error, data.room);
    }
    return data;
  }
  async create(state: Game) {
    const d = await this.request('', { game: 'guess-duel', seats: 2, state, turn: 0 });
    this.save(d);
    return d as {
      code: string;
      seat: Seat;
      token: string;
      room: Room;
    };
  }
  async join(code: string) {
    code = normalizeCode(code);
    const d = await this.request('/' + code + '/join', {});
    this.save({ ...d, code });
    return d as {
      seat: Seat;
      token: string;
      room: Room;
    };
  }
  /** Seat tokens are scoped to the API origin that issued them, so a token can
   * never be replayed against a different server. */
  tokenKey(code: string) {
    return 'room:' + this.base + '/' + code;
  }
  private save(d: any) {
    try {
      this.storage?.setItem(this.tokenKey(d.code), JSON.stringify({ token: d.token, seat: d.seat }));
    } catch {}
  }
  poll(code: string, token: string, since: number) {
    return this.request('/' + code + '?since=' + since, undefined, token);
  }
  async sendMove(
    code: string,
    token: string,
    body: {
      version: number;
      move?: Move;
      state?: Game;
      nextTurn?: Seat;
      end?: boolean;
      skip?: boolean;
    },
    rebase?: (room: Room) => typeof body,
  ): Promise<{
    room: Room;
  }> {
    try {
      return await this.request('/' + code + '/moves', body, token);
    } catch (e) {
      if (e instanceof RoomError && e.error === 'version_conflict') {
        const latest = e.room ?? (await this.poll(code, token, -1)).room;
        return this.request(
          '/' + code + '/moves',
          rebase ? rebase(latest) : { ...body, version: latest.version },
          token,
        );
      }
      throw e;
    }
  }
  start(code: string, token: string) {
    return this.request('/' + code + '/start', {}, token);
  }
  skip(code: string, token: string, version: number) {
    return this.sendMove(code, token, { version, skip: true });
  }
}
export function normalizeCode(s: string) {
  const c = s.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(c)) throw Error('Invalid room code');
  return c;
}
export function apiBase(
  location: {
    hostname: string;
    origin: string;
  },
  override?: string | null,
  allowAnyOverride = false,
) {
  // `?api=` exists for local testing only. Production builds accept it only when
  // it names the page's own origin: anything else would let a crafted link send
  // the stored seat tokens to another site.
  if (override) {
    try {
      const u = new URL(override);
      if (
        ['http:', 'https:'].includes(u.protocol) &&
        (allowAnyOverride || u.origin === location.origin)
      )
        return u.origin;
    } catch {}
  }
  return ['appai.info', 'www.appai.info'].includes(location.hostname)
    ? location.origin
    : 'https://appai.info';
}
