// An intentionally rules-agnostic in-memory implementation of the rooms API.
// Like production, it checks seats/CAS/idle time but trusts game payloads.
export class MemoryStorage {
  map = new Map();
  getItem(key) { return this.map.get(key) ?? null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}
export class FakeServer {
  room = null;
  requests = [];
  signedIn = true;
  queued = [];
  tokens = ['black-token', 'white-token'];
  copy(value) { return structuredClone(value); }
  response(body, status = 200, headers = {}) { return Response.json(this.copy(body), { status, headers }); }
  error(error, status, extra = {}) { return this.response({ error, ...extra }, status); }
  fetch = async (url, options = {}) => {
    this.requests.push({ url, ...this.copy(options) });
    if (this.queued.length) {
      const response = this.queued.shift();
      if (response instanceof Error) throw response;
      return response;
    }
    const path = new URL(url).pathname.replace('/api/rooms', '');
    const body = options.body ? JSON.parse(options.body) : null;
    if (!path && options.method === 'POST') {
      if (!this.signedIn) return this.error('login_required', 401);
      this.room = { code: 'ABC234', game: body.game, version: 1, state: body.state, turn: body.turn,
        seats: [0, 1].map((seat) => ({ seat, joined: seat === 0, online: seat === 0, idleSeconds: seat === 0 ? 0 : null })),
        moves: [], status: 'waiting', expiresAt: '2026-11-11T12:00:00.000Z' };
      return this.response({ code: this.room.code, seat: 0, token: this.tokens[0], room: this.room }, 201);
    }
    const [code, action] = path.slice(1).split('/');
    if (!this.room || code !== this.room.code) return this.error('room_not_found', 404);
    if (action === 'join') {
      if (this.room.seats[1].joined) return this.error('room_full', 409);
      Object.assign(this.room.seats[1], { joined: true, online: true, idleSeconds: 0 });
      this.room.status = 'playing'; this.room.version++;
      return this.response({ seat: 1, token: this.tokens[1], room: this.room });
    }
    const seat = this.tokens.indexOf(options.headers?.Authorization?.replace('Bearer ', ''));
    if (seat < 0) return this.error('room_not_found', 404);
    Object.assign(this.room.seats[seat], { idleSeconds: 0, online: true });
    if (!action) {
      const since = Number(new URL(url).searchParams.get('since'));
      return this.response(since < this.room.version ? { changed: true, seat, room: this.room } :
        { changed: false, version: this.room.version, seats: this.room.seats });
    }
    if (action === 'start') {
      if (seat !== 0) return this.error('not_host', 403);
      if (this.room.status !== 'waiting') return this.error('already_started', 409);
      if (!this.room.seats.every((s) => s.joined)) return this.error('room_not_ready', 409);
      this.room.status = 'playing'; this.room.version++;
      return this.response({ room: this.room });
    }
    if (action === 'moves') {
      if (this.room.status === 'finished') return this.error('room_finished', 409);
      if (this.room.status !== 'playing') return this.error('room_not_ready', 409);
      if (body.version !== this.room.version) return this.error('version_conflict', 409, { room: this.room });
      let entry;
      if (body.skip) {
        if (seat === this.room.turn || this.room.seats[this.room.turn].idleSeconds < 120) return this.error('not_your_turn', 409, { room: this.room });
        if (['state', 'nextTurn', 'end'].some((key) => Object.hasOwn(body, key))) return this.error('invalid_request', 400);
        entry = { version: this.room.version + 1, seat, move: null, skipped: this.room.turn };
        this.room.turn = 1 - this.room.turn;
      } else {
        if (seat !== this.room.turn) return this.error('not_your_turn', 409, { room: this.room });
        entry = { version: this.room.version + 1, seat, move: body.move };
        if (body.state) this.room.state = this.copy(body.state);
        if (body.nextTurn !== undefined) this.room.turn = body.nextTurn;
        if (body.end) this.room.status = 'finished';
      }
      this.room.version++; this.room.moves.push(entry); this.room.moves = this.room.moves.slice(-20);
      return this.response({ room: this.room });
    }
    return this.error('invalid_request', 400);
  };
}
