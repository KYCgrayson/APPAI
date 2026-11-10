import { applyMove, applySkip, validateGame } from './logic.js';

export class RoomError extends Error {
  constructor(status, error, room = null) {
    super(error);
    Object.assign(this, { status, error, room });
  }
}
export function normalizeCode(raw) {
  const code = String(raw).replace(/[\s-]/g, '').toUpperCase();
  if (!/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(code)) throw new RoomError(400, 'invalid_code');
  return code;
}
export function apiBase(location) {
  return ['appai.info', 'www.appai.info'].includes(location.hostname) ? location.origin : 'https://appai.info';
}
export function signInUrl(search = '') {
  const url = new URL('/login', 'https://appai.info');
  url.searchParams.set('callbackUrl', '/games/five-in-a-row/' + search);
  return url.href;
}
const skipped = (entry) => Object.hasOwn(entry, 'skipped') && entry.skipped !== false;

/** Replay the compact snapshot, reconstruct trailing skips (which cannot write
 * state), and check every retained API entry against the full game history.
 * With exactly two seats the full join is version 2; every later version is a
 * game event. This also restores >20 consecutive skips after a long absence.
 */
export function validateRoom(value, previous = null) {
  try {
    if (!value || value.game !== 'five-in-a-row' || normalizeCode(value.code) !== value.code ||
        !Number.isSafeInteger(value.version) || value.version < 1 || value.version > 2002 ||
        !['waiting', 'playing', 'finished'].includes(value.status) ||
        !Array.isArray(value.seats) || value.seats.length !== 2 ||
        value.seats.some((s, i) => s.seat !== i || typeof s.joined !== 'boolean' || typeof s.online !== 'boolean' ||
          (s.joined && (!Number.isFinite(s.idleSeconds) || s.idleSeconds < 0))) ||
        !Array.isArray(value.moves) || value.moves.length > 20) throw Error();
    let game = validateGame(value.state);
    if (game.revision !== (game.moves.length ? game.moves.length + 2 : 0)) throw Error();
    const snapshotRevision = Math.max(2, game.revision);
    if (game.moves.length && snapshotRevision > value.version) throw Error();
    for (let v = snapshotRevision + 1; v <= value.version; v++) game = applySkip(game);
    if (game.turn !== value.turn || (value.status === 'finished') !== (game.winner !== null) ||
        (value.status === 'waiting' && (value.version !== 1 || game.moves.length))) throw Error();
    let version = 0;
    for (const entry of value.moves) {
      if (!Number.isSafeInteger(entry.version) || entry.version <= version || entry.version > value.version) throw Error();
      version = entry.version;
      const event = game.moves[entry.version - 3];
      if (!event || ![0, 1].includes(entry.seat)) throw Error();
      if (skipped(entry)) {
        const passedSeat = entry.skipped === true ? 1 - entry.seat : entry.skipped;
        if (event[0] !== -1 || event[1] !== passedSeat || entry.seat === passedSeat) throw Error();
      } else if (event[0] !== entry.move?.index || event[1] !== entry.seat || event[0] < 0) throw Error();
    }
    if (value.version > 2 && value.moves.at(-1)?.version !== value.version) throw Error();
    if (previous) {
      if (value.code !== previous.code || value.version < previous.version || game.size !== previous.state.size ||
          JSON.stringify(game.moves.slice(0, previous.state.moves.length)) !== JSON.stringify(previous.state.moves)) throw Error();
    }
    // Preserve the original snapshot separately: reconstructed skips must never
    // be mistaken for a snapshot already written to the server.
    return { ...value, state: { ...game, revision: value.version } };
  } catch { throw new RoomError(400, 'invalid_state'); }
}

export class RoomsClient {
  constructor({ base = 'https://appai.info', fetcher = (...args) => fetch(...args), storage,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now = Date.now } = {}) {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol)) throw Error('invalid_origin');
    Object.assign(this, { base: url.origin, fetcher, storage, sleep, now });
  }
  tokenKey(code) { return 'five-in-a-row:v1:room:' + this.base + '/' + normalizeCode(code); }
  credential(code) {
    try {
      const data = JSON.parse(this.storage?.getItem(this.tokenKey(code)) ?? 'null');
      return data && typeof data.token === 'string' && data.token && [0, 1].includes(data.seat) ? data : null;
    } catch { return null; }
  }
  forget(code) { try { this.storage?.removeItem(this.tokenKey(code)); } catch {} }
  remember(code, data) {
    if (!data.token || ![0, 1].includes(data.seat)) throw new RoomError(400, 'invalid_state');
    try { this.storage?.setItem(this.tokenKey(code), JSON.stringify({ token: data.token, seat: data.seat })); } catch {}
  }
  async request(path, body, token, retry = true) {
    let response;
    try {
      response = await this.fetcher(this.base + '/api/rooms' + path, {
        method: body === undefined ? 'GET' : 'POST',
        credentials: path === '' ? 'include' : 'omit',
        headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { throw new RoomError(503, 'unavailable'); }
    if (response.status === 429 && retry) {
      const raw = response.headers.get('Retry-After') ?? '1', seconds = Number(raw);
      const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(raw) - this.now();
      await this.sleep(Number.isFinite(delay) ? Math.max(0, delay) : 1000);
      return this.request(path, body, token, false);
    }
    if (response.status === 404 && token) this.forget(path.split('/')[1].split('?')[0]);
    let data;
    try { data = await response.json(); } catch { throw new RoomError(response.status === 404 ? 404 : 503, response.status === 404 ? 'room_not_found' : 'unavailable'); }
    if (!response.ok) throw new RoomError(response.status, data.error || 'unavailable', data.room);
    return data;
  }
  async create(state) {
    const data = await this.request('', { game: 'five-in-a-row', seats: 2, state: validateGame(state), turn: 0 });
    this.remember(data.code, data);
    return { ...data, room: validateRoom(data.room) };
  }
  async join(code) {
    code = normalizeCode(code);
    const data = await this.request('/' + code + '/join', {});
    this.remember(code, data);
    return { ...data, code, room: validateRoom(data.room) };
  }
  poll(code, token, since = -1) { return this.request('/' + normalizeCode(code) + '?since=' + since, undefined, token); }
  start(code, token) { return this.request('/' + normalizeCode(code) + '/start', {}, token); }
  move(code, token, body) { return this.request('/' + normalizeCode(code) + '/moves', body, token); }
}

export const pollDelay = (hidden) => hidden ? 15000 : 1200;
export function canSkip(room, seat) {
  return room.status === 'playing' && room.turn !== seat && room.seats.some((s) => s.seat === room.turn && s.idleSeconds >= 120);
}
export class OnlineSession {
  constructor(client, code, credential, room, changed = () => {}, failed = () => {},
    { hidden = () => typeof document !== 'undefined' && document.hidden, schedule = setTimeout, cancel = clearTimeout } = {}) {
    Object.assign(this, { client, code, ...credential, room, changed, failed, hidden, schedule, cancel });
    this.busy = false;
    this.stopped = false;
  }
  update(raw) {
    if (this.stopped || raw.version < this.room.version) return;
    this.room = validateRoom(raw, this.room);
    this.changed(this.room);
  }
  async poll() {
    if (this.busy || this.stopped) return;
    this.polling = (async () => {
      this.busy = true;
      try {
        const data = await this.client.poll(this.code, this.token, this.room.version);
        if (this.stopped) return;
        if (data.changed) this.update(data.room);
        else if (data.version === this.room.version && Array.isArray(data.seats)) {
          this.room = { ...this.room, seats: data.seats };
          this.changed(this.room);
        }
      } finally { this.busy = false; }
    })();
    try { await this.polling; } finally { this.polling = null; }
  }
  async tick(epoch) {
    if (epoch !== this.loop) return;
    try { await this.poll(); } catch (e) { if (!this.stopped) this.failed(e); }
    if (!this.stopped && epoch === this.loop) this.timer = this.schedule(() => void this.tick(epoch), pollDelay(this.hidden()));
  }
  start() { this.stopped = false; this.cancel(this.timer); this.loop = (this.loop ?? 0) + 1; void this.tick(this.loop); }
  refresh() { if (!this.stopped) this.start(); }
  stop() { this.stopped = true; this.loop = (this.loop ?? 0) + 1; this.cancel(this.timer); }
  async send(index, skip = false) {
    if (this.polling) await this.polling;
    if (this.busy || this.stopped) throw new RoomError(409, 'busy');
    this.busy = true;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const room = this.room;
        let body = { version: room.version, skip: true };
        if (skip) {
          if (!canSkip(room, this.seat)) throw new RoomError(409, 'not_your_turn');
        } else {
          if (room.status !== 'playing') throw new RoomError(409, 'room_not_ready');
          const state = { ...applyMove(room.state, this.seat, { index }), revision: room.version + 1 };
          body = { version: room.version, move: { index }, state, nextTurn: state.turn, end: state.winner !== null };
        }
        try {
          const data = await this.client.move(this.code, this.token, body);
          this.update(data.room);
          return;
        } catch (e) {
          if (['version_conflict', 'not_your_turn'].includes(e.error)) {
            const raw = e.room ?? (await this.client.poll(this.code, this.token, -1)).room;
            this.update(raw);
            if (e.error === 'version_conflict' && attempt === 0) continue;
          }
          throw e;
        }
      }
    } finally { this.busy = false; }
  }
}
