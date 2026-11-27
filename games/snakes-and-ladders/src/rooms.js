import { createGame, validateGame, reduceMove, resizeInitial, skipTurn } from './logic.js';
export class RoomError extends Error {
  constructor(status, error, room) { super(error); this.status = status; this.error = error; this.room = room; }
}
export function normalizeCode(raw) {
  const code = String(raw).replace(/[\s-]/g, '').toUpperCase();
  if (!/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(code)) throw new RoomError(400, 'invalid_code');
  return code;
}
export function apiBase(location) {
  return ['appai.info', 'www.appai.info'].includes(location.hostname) ? location.origin : 'https://appai.info';
}
export const pollDelay = hidden => hidden ? 15000 : 1200;
export class RoomsClient {
  constructor({ base = 'https://appai.info', fetcher = (...args) => fetch(...args), storage, sleep = ms => new Promise(r => setTimeout(r, ms)), now = () => Date.now() } = {}) {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol)) throw Error('origin');
    Object.assign(this, { base: url.origin, fetcher, storage, sleep, now });
  }
  tokenKey(code) { return `snakes-and-ladders:v1:room:${this.base}/${normalizeCode(code)}`; }
  read(code) { try { return JSON.parse(this.storage?.getItem(this.tokenKey(code)) ?? 'null'); } catch { return null; } }
  save(code, value) { try { this.storage?.setItem(this.tokenKey(code), JSON.stringify(value)); } catch { this.onStorageError?.(); } }
  async request(path, body, token, retry = true) {
    let response;
    try {
      response = await this.fetcher(this.base + '/api/rooms' + path, {
        method: body === undefined ? 'GET' : 'POST',
        ...(path === '' ? { credentials: 'include' } : {}),
        headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { throw new RoomError(503, 'unavailable'); }
    if (response.status === 429 && retry) {
      const raw = response.headers.get('Retry-After') ?? '1', seconds = Number(raw);
      const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(raw) - this.now();
      await this.sleep(Number.isFinite(delay) ? Math.max(0, delay) : 1000);
      return this.request(path, body, token, false);
    }
    if (response.status === 404 && token) { try { this.storage?.removeItem(this.tokenKey(path.split('/')[1].split('?')[0])); } catch {} }
    let data;
    try { data = await response.json(); } catch { throw new RoomError(response.status === 404 ? 404 : 503, response.status === 404 ? 'room_not_found' : 'unavailable'); }
    if (!response.ok) throw new RoomError(response.status, data.error ?? 'unavailable', data.room);
    return data;
  }
  async create(state) {
    state = validateGame(state);
    const data = await this.request('', { game: 'snakes-and-ladders', seats: state.players.length, state, turn: 0 });
    this.save(data.code, { token: data.token, seat: data.seat }); return data;
  }
  async join(raw) {
    const code = normalizeCode(raw), data = await this.request('/' + code + '/join', {});
    this.save(code, { token: data.token, seat: data.seat }); return { ...data, code };
  }
  poll(code, token, version) { return this.request('/' + normalizeCode(code) + '?since=' + version, undefined, token); }
  start(code, token) { return this.request('/' + normalizeCode(code) + '/start', {}, token); }
  move(code, token, body) { return this.request('/' + normalizeCode(code) + '/moves', body, token); }
}
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function canSkip(room, seat) {
  return room.status === 'playing' && room.turn !== seat && (room.seats.find(p => p.seat === room.turn)?.idleSeconds ?? 0) >= 120;
}
// A checkpoint is written after every verified update. Snapshot writes are checked
// against replayed moves; an unverified peer snapshot never replaces local rules.
export class OnlineSession {
  constructor(client, { code, token, seat, room, checkpoint }, changed = () => {}, failed = () => {}, clock = {}) {
    Object.assign(this, { client, code: normalizeCode(code), token, seat, changed, failed, busy: false, polling: false, epoch: 0, stopped: true });
    this.hidden = clock.hidden ?? (() => typeof document !== 'undefined' && document.hidden);
    this.setTimer = clock.setTimer ?? setTimeout; this.clearTimer = clock.clearTimer ?? clearTimeout;
    if (checkpoint) {
      this.state = validateGame(checkpoint.state); this.version = checkpoint.version; this.snapshot = validateGame(checkpoint.snapshot);
      if (!Number.isInteger(this.version) || this.version < 0) throw new RoomError(400, 'invalid_state');
      this.room = { ...room, status: checkpoint.status ?? 'playing', version: this.version };
      this.adopt(room);
    } else {
      const state = validateGame(room.state);
      if (state.turns || state.positions.some(Boolean) || room.moves.length) throw new RoomError(400, 'history_gap');
      this.state = state; this.snapshot = state; this.version = room.version; this.room = { ...room, status: 'waiting' };
      this.adopt(room);
    }
  }
  checkpoint() { return { state: this.state, version: this.version, snapshot: this.snapshot, status: this.room.status }; }
  persist() { this.client.save(this.code, { token: this.token, seat: this.seat, checkpoint: this.checkpoint() }); }
  adopt(room) {
    if (room.version < this.version) return false;
    try {
      if (room.game !== 'snakes-and-ladders' || room.code !== this.code || !Number.isInteger(room.version) || !['waiting', 'playing', 'finished'].includes(room.status) || !Array.isArray(room.seats) || room.seats.length < 2 || room.seats.length > 4 || !Array.isArray(room.moves) || room.moves.length > 20) throw Error('room');
      let state = this.state, snapshot = this.snapshot, version = this.version;
      if (room.status !== 'waiting' && room.seats.length !== state.players.length) state = resizeInitial(state, room.seats.length);
      const pending = [...room.moves].filter(m => m.version > version).sort((a, b) => a.version - b.version);
      if (pending.length && pending[0].version !== version + 1 && (state.turns || room.moves.length === 20)) throw new RoomError(400, 'history_gap');
      for (const item of pending) {
        if (!Number.isInteger(item.version) || item.version > room.version || (version !== this.version && item.version !== version + 1)) throw Error('version');
        if (item.skipped !== undefined) {
          if (item.skipped !== state.turn || !Number.isInteger(item.seat) || item.seat < 0 || item.seat >= state.players.length || item.seat === state.turn) throw Error('skip');
          state = skipTurn(state);
        } else { state = reduceMove(state, item.seat, item.move); snapshot = state; }
        version = item.version;
      }
      if (room.version > version && this.room.status !== 'waiting') throw new RoomError(400, 'history_gap');
      if (!equal(validateGame(room.state), snapshot) || (room.status !== 'waiting' && room.turn !== state.turn) || (room.status === 'finished') !== (state.status === 'finished')) throw Error('snapshot');
      this.state = state; this.snapshot = snapshot; this.version = room.version; this.room = room;
      this.persist(); return true;
    } catch (e) { if (e instanceof RoomError) throw e; throw new RoomError(400, 'invalid_state'); }
  }
  update(room) {
    const view = () => JSON.stringify([this.state, this.room.status, this.room.seats.map(p => [p.seat, p.joined, p.online]), canSkip(this.room, this.seat)]);
    const before = view();
    if (this.adopt(room) && before !== view()) this.changed(this);
  }
  async poll() {
    if (this.busy || this.polling) return;
    this.polling = true;
    try {
      const data = await this.client.poll(this.code, this.token, this.version);
      if (this.stopped || this.busy || data.version < this.version) return;
      if (data.changed) this.update(data.room);
      else if (data.version === this.version && data.seats) this.update({ ...this.room, seats: data.seats });
    } finally { this.polling = false; }
  }
  startPolling() { this.stopped = false; this.epoch++; void this.tick(); }
  stop() { this.stopped = true; this.epoch++; this.clearTimer(this.timer); }
  visibilityChanged() { this.epoch++; this.clearTimer(this.timer); if (!this.stopped) this.timer = this.setTimer(() => void this.tick(), this.hidden() ? 15000 : 0); }
  async tick() {
    const epoch = this.epoch;
    try { await this.poll(); } catch (e) { if (!this.stopped) this.failed(e); }
    finally { if (!this.stopped && epoch === this.epoch) this.timer = this.setTimer(() => void this.tick(), pollDelay(this.hidden())); }
  }
  async action(kind, move) {
    if (this.busy) return;
    this.busy = true;
    try {
      let data;
      if (kind === 'start') data = await this.client.start(this.code, this.token);
      else if (kind === 'skip') {
        if (!canSkip(this.room, this.seat)) throw new RoomError(409, 'not_your_turn');
        data = await this.client.move(this.code, this.token, { version: this.version, skip: true });
      } else {
        const state = reduceMove(this.state, this.seat, move);
        data = await this.client.move(this.code, this.token, { version: this.version, move, state, nextTurn: state.turn, end: state.status === 'finished' });
      }
      this.update(data.room);
    } catch (e) {
      if (['version_conflict', 'not_your_turn', 'already_started'].includes(e.error)) {
        const room = e.room ?? (await this.client.poll(this.code, this.token, -1)).room;
        if (room) this.update(room);
      }
      throw e;
    } finally { this.busy = false; }
  }
}
export function initialOnline(settings) { return createGame({ ...settings, players: Array(settings.players.length).fill('human') }); }
