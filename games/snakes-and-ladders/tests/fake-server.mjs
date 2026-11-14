// In-memory transport fake: deliberately does NOT check game rules, just like
// the rooms API. Tests must demonstrate that clients perform that validation.
export const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values };
};
const clone = value => structuredClone(value);
export class FakeServer {
  constructor() { this.rooms = new Map(); this.count = 0; this.calls = []; this.signedIn = true; this.nextReply = null; }
  response(status, data, headers) { return new Response(JSON.stringify(data), { status, headers }); }
  public(record) { const { tokens, ...room } = record; return clone(room); }
  fetch = async (url, init = {}) => {
    this.calls.push({ url, ...init });
    if (this.nextReply) { const reply = this.nextReply; this.nextReply = null; return reply; }
    const path = new URL(url).pathname.split('/').slice(3), code = path[0];
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (!code) {
      if (!this.signedIn) return this.response(401, { error: 'login_required' });
      const code = ['ABC234', 'DEF567', 'GHJ789'][this.count++];
      const room = { code, game: body.game, version: 0, state: clone(body.state), turn: body.turn, status: 'waiting', moves: [], expiresAt: new Date(Date.now() + 120000).toISOString(), tokens: ['token-0'], seats: Array.from({ length: body.seats }, (_, seat) => ({ seat, joined: seat === 0, online: seat === 0, idleSeconds: 0 })) };
      this.rooms.set(code, room);
      return this.response(201, { code, seat: 0, token: 'token-0', room: this.public(room) });
    }
    const room = this.rooms.get(code);
    if (!room) return this.response(404, { error: 'room_not_found' });
    if (path[1] === 'join') {
      const seat = room.seats.findIndex(s => !s.joined);
      if (seat < 0 || room.status !== 'waiting') return this.response(409, { error: 'room_full' });
      room.tokens[seat] = 'token-' + seat; room.seats[seat] = { seat, joined: true, online: true, idleSeconds: 0 }; room.version++;
      if (room.seats.every(s => s.joined)) room.status = 'playing';
      return this.response(200, { seat, token: room.tokens[seat], room: this.public(room) });
    }
    const token = init.headers?.Authorization?.replace('Bearer ', ''), seat = room.tokens.indexOf(token);
    if (seat < 0) return this.response(404, { error: 'room_not_found' });
    if (init.method === 'GET') {
      room.seats[seat].online = true; room.seats[seat].idleSeconds = 0;
      const since = +new URL(url).searchParams.get('since');
      return this.response(200, since === room.version ? { changed: false, version: room.version, seats: room.seats } : { changed: true, seat, room: this.public(room) });
    }
    if (path[1] === 'start') {
      if (seat !== 0) return this.response(403, { error: 'not_host' });
      if (room.status !== 'waiting') return this.response(409, { error: 'already_started' });
      if (room.tokens.length < 2) return this.response(409, { error: 'room_not_ready' });
      room.seats = room.seats.filter(s => s.joined); room.version++; room.status = 'playing';
      return this.response(200, { room: this.public(room) });
    }
    if (room.status === 'finished') return this.response(409, { error: 'room_finished' });
    if (room.status !== 'playing') return this.response(409, { error: 'room_not_ready' });
    if (body.version !== room.version) return this.response(409, { error: 'version_conflict', room: this.public(room) });
    if (body.skip) {
      if (seat === room.turn || room.seats[room.turn].idleSeconds < 120) return this.response(409, { error: 'not_your_turn', room: this.public(room) });
      if (body.state !== undefined || body.nextTurn !== undefined || body.end !== undefined) return this.response(400, { error: 'invalid_request' });
      room.moves.push({ version: ++room.version, seat, move: null, skipped: room.turn }); room.turn = (room.turn + 1) % room.seats.length;
    } else {
      if (seat !== room.turn) return this.response(409, { error: 'not_your_turn', room: this.public(room) });
      room.moves.push({ version: ++room.version, seat, move: body.move }); room.state = clone(body.state); room.turn = body.nextTurn;
      if (body.end) room.status = 'finished';
    }
    room.moves = room.moves.slice(-20);
    return this.response(200, { room: this.public(room) });
  };
}
