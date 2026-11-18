import { newGame, validateGame, reduceMove, applySkip } from './logic.js';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export class RoomError extends Error {
  constructor(status, error, room) { super(error); this.status = status; this.error = error; this.room = room; }
}
export function normalizeCode(input) {
  const code = String(input).replace(/[\s-]/g, '').toUpperCase();
  if (!/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(code)) throw new RoomError(400, 'invalid_code');
  return code;
}
export const pollDelay = hidden => hidden ? 15000 : 1200;
// A checkpoint includes its previous state and action so even a returning client
// can run the latest transition through the same rules engine.
export function checkpoint(game, at = 0, previous = null, action = null, actor = null) {
  return { v: 1, game, at, previous, action, actor };
}
function readCheckpoint(c) {
  if (!c || c.v !== 1 || !Number.isInteger(c.at) || c.at < 0) throw Error('checkpoint');
  const game = validateGame(c.game);
  if (c.at === 0) {
    if (!same(game, newGame(game.players.length, game.settings)) || c.previous !== null || c.action !== null) throw Error('initial');
  } else if (!same(reduceMove(validateGame(c.previous), c.actor, c.action), game)) throw Error('transition');
  return game;
}
export function restoreRoom(room) {
  if (!room || room.game !== 'race-home' || !Array.isArray(room.seats) || room.seats.length < 2 || room.seats.length > 4 ||
      !Number.isInteger(room.version) || room.version < 1 || !['waiting', 'playing', 'finished'].includes(room.status) ||
      !Array.isArray(room.moves) || room.state.at > room.version || !Number.isInteger(room.turn) || room.turn < 0 || room.turn >= room.seats.length) throw Error('room');
  let game = readCheckpoint(room.state);
  const latestWrite = room.moves.find(m => m.version === room.state.at);
  if (latestWrite && (latestWrite.skipped !== undefined || latestWrite.seat !== room.state.actor || !same(latestWrite.move, room.state.action))) throw Error('history');
  let previousVersion = 0;
  for (const item of room.moves) {
    if (!Number.isInteger(item.version) || item.version <= previousVersion || item.version > room.version ||
        !Number.isInteger(item.seat) || item.seat < 0 || item.seat >= room.seats.length) throw Error('history');
    previousVersion = item.version;
  }
  if (game.players.length !== room.seats.length) {
    // Start can remove unfilled seats without rewriting state. No play yet.
    if (room.state.at !== 0) throw Error('seats');
    game = newGame(room.seats.length, game.settings);
  }
  const tail = room.moves.filter(m => m.version > room.state.at).sort((a, b) => a.version - b.version);
  // Only skips leave the last written checkpoint unchanged. The API retains 20.
  for (const item of tail) {
    if (item.skipped === undefined || !Number.isInteger(item.skipped) || item.seat === item.skipped) throw Error('history');
    if (tail[0].version > room.state.at + 1 && item === tail[0]) {
      game.turn = item.skipped; game.phase = 'roll'; game.die = null; game.sixes = 0;
    }
    if (item.skipped !== game.turn) throw Error('skip');
    game = applySkip(game);
  }
  if (game.turn !== room.turn || (room.status === 'finished') !== (game.phase === 'finished')) throw Error('turn');
  return game;
}
export function processRoom(before, game, after) {
  if (after.version < before.version) return game;
  // Validate checkpoints too, but never let a snapshot overwrite known history.
  const restored = restoreRoom(after);
  const moves = after.moves.filter(m => m.version > before.version).sort((a, b) => a.version - b.version);
  if (moves.length && moves[0].version > before.version + 1) return restored;
  let next = game;
  if (next.players.length !== after.seats.length) {
    if (before.state.at !== 0) throw Error('seats');
    next = newGame(after.seats.length, game.settings);
  }
  for (const item of moves) {
    if (item.skipped !== undefined) {
      if (item.skipped !== next.turn || item.seat === next.turn) throw Error('skip');
      next = applySkip(next);
    } else next = reduceMove(next, item.seat, item.move);
  }
  if (!same(next, restored)) throw Error('invalid_state');
  return next;
}
export class RoomsClient {
  constructor({ base = 'https://appai.info', fetcher = (...args) => fetch(...args), storage, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol)) throw Error('origin');
    this.base = url.origin; this.fetcher = fetcher; this.storage = storage; this.sleep = sleep;
  }
  tokenKey(code) { return `race-home:v1:room:${this.base}/${normalizeCode(code)}`; }
  saved(code) { try { const d = JSON.parse(this.storage?.getItem(this.tokenKey(code))); return typeof d?.token === 'string' && Number.isInteger(d.seat) ? d : null; } catch { return null; } }
  save(code, data) { try { this.storage?.setItem(this.tokenKey(code), JSON.stringify({ token: data.token, seat: data.seat })); } catch {} }
  async request(path, body, token, retry = true) {
    let response;
    try {
      response = await this.fetcher(this.base + '/api/rooms' + path, {
        method: body === undefined ? 'GET' : 'POST',
        ...(path === '' ? { credentials: 'include' } : {}),
        headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { throw new RoomError(503, 'unavailable'); }
    if (response.status === 429 && retry) {
      const raw = response.headers.get('Retry-After') || '1';
      const seconds = Number(raw), date = Date.parse(raw);
      await this.sleep(Math.max(0, Number.isFinite(seconds) ? seconds * 1000 : Number.isFinite(date) ? date - Date.now() : 1000));
      return this.request(path, body, token, false);
    }
    if (response.status === 404 && token) { try { this.storage?.removeItem(this.tokenKey(path.split('/')[1].split('?')[0])); } catch {} }
    let data;
    try { data = await response.json(); } catch { throw new RoomError(response.status === 404 ? 404 : 503, response.status === 404 ? 'room_not_found' : 'unavailable'); }
    if (data.room) { try { restoreRoom(data.room); } catch { throw new RoomError(400, 'invalid_state'); } }
    if (!response.ok) throw new RoomError(response.status, data.error || 'unavailable', data.room);
    return data;
  }
  async create(game) {
    const data = await this.request('', { game: 'race-home', seats: game.players.length, state: checkpoint(validateGame(game)), turn: 0 });
    data.code = normalizeCode(data.code); this.save(data.code, data); return data;
  }
  async join(input) {
    const code = normalizeCode(input);
    const data = await this.request(`/${code}/join`, {});
    this.save(code, data); return { ...data, code };
  }
  poll(code, token, since = -1) { return this.request(`/${normalizeCode(code)}?since=${since}`, undefined, token); }
  start(code, token) { return this.request(`/${normalizeCode(code)}/start`, {}, token); }
  send(code, token, body) { return this.request(`/${normalizeCode(code)}/moves`, body, token); }
}
export class OnlineSession {
  constructor(client, data, { changed = () => {}, failed = () => {}, hidden = () => globalThis.document?.hidden || false } = {}) {
    this.client = client; this.code = normalizeCode(data.code || data.room.code); this.token = data.token; this.seat = data.seat;
    this.room = data.room; this.game = restoreRoom(data.room); this.changed = changed; this.failed = failed; this.hidden = hidden;
    this.busy = false; this.stopped = true; this.timer = null;
  }
  accept(room) {
    if (room.version < this.room.version) return;
    const game = processRoom(this.room, this.game, room);
    const changed = !same(this.game, game) || this.room.version !== room.version || !same(this.room.seats, room.seats);
    this.game = game; this.room = room;
    if (changed) this.changed(this);
  }
  async poll() {
    if (this.busy || this.polling) return;
    this.polling = true;
    try {
      const data = await this.client.poll(this.code, this.token, this.room.version);
      if (this.busy || this.stopped) return;
      if (data.changed) this.accept(data.room);
      else if (data.version === this.room.version && data.seats) this.accept({ ...this.room, seats: data.seats });
    } finally { this.polling = false; }
  }
  startPolling() { if (!this.stopped) return; this.stopped = false; this.epoch = (this.epoch || 0) + 1; this.tick(this.epoch); }
  stop() { this.stopped = true; this.epoch = (this.epoch || 0) + 1; clearTimeout(this.timer); }
  async tick(epoch = this.epoch) {
    if (this.stopped || epoch !== this.epoch) return;
    try { await this.poll(); } catch (e) { this.failed(e); }
    finally { if (!this.stopped && epoch === this.epoch) this.timer = setTimeout(() => this.tick(epoch), pollDelay(this.hidden())); }
  }
  visibilityChanged() { clearTimeout(this.timer); this.epoch = (this.epoch || 0) + 1; if (!this.stopped) this.tick(this.epoch); }
  async mutate(build) {
    if (this.busy) return;
    this.busy = true;
    try {
      try { const d = await build(); this.accept(d.room); }
      catch (e) {
        if (e.room && ['version_conflict', 'not_your_turn'].includes(e.error)) this.accept(e.room);
        throw e; // Never silently replay a stale token selection or re-roll dice.
      }
    } finally { this.busy = false; }
  }
  async send(action) {
    return this.mutate(() => {
      if (this.room.status !== 'playing') throw new RoomError(409, 'room_not_ready');
      const game = reduceMove(this.game, this.seat, action);
      return this.client.send(this.code, this.token, { version: this.room.version, move: action,
        state: checkpoint(game, this.room.version + 1, this.game, action, this.seat), nextTurn: game.turn, end: game.phase === 'finished' });
    });
  }
  async start() { return this.mutate(() => this.client.start(this.code, this.token)); }
  async skip() {
    return this.mutate(() => {
      const idle = this.room.seats.find(p => p.seat === this.room.turn);
      if (this.room.turn === this.seat || (idle?.idleSeconds || 0) < 120) throw new RoomError(409, 'not_your_turn');
      return this.client.send(this.code, this.token, { version: this.room.version, skip: true });
    });
  }
}
