import type { Room } from './rooms.ts';

/** Date is truncated to whole seconds; use its midpoint and the request midpoint.
 * Prefer the minimum-RTT sample to limit error from server processing time. */
export function serverClockOffset(date: string | null, sentAt: number, receivedAt: number) {
  const serverTime = date === null ? NaN : Date.parse(date);
  return Number.isFinite(serverTime) ? serverTime + 500 - (sentAt + receivedAt) / 2 : undefined;
}

export function remainingSeconds(expiresAt: string, serverNow: number) {
  const remaining = Date.parse(expiresAt) - serverNow;
  return Number.isFinite(remaining) ? Math.max(0, Math.ceil(remaining / 1000)) : 0;
}

export function formatRemaining(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export class RoomCountdown {
  private expiresAt?: string;
  private seconds = 0;
  private sampledAt = 0;
  private observedAt = 0;
  private roundTrip = Infinity;
  private corrected = false;
  private now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  get expired() {
    return this.seconds === 0;
  }

  remaining(expiresAt: string, serverNow: number, roundTrip = Infinity) {
    // Match the Date header's precision so fractional expiry cannot add a second.
    // The full-precision expiry remains authoritative for closing the room.
    const expiry = Math.floor(Date.parse(expiresAt) / 1000) * 1000;
    const remaining = Number.isFinite(expiry)
      ? Math.max(0, Math.ceil((expiry - serverNow) / 1000))
      : 0;
    const now = this.now();
    if (this.expiresAt !== expiresAt) {
      this.seconds = remaining;
      this.sampledAt = now;
      this.corrected = false;
    } else {
      const elapsed = Math.max(0, Math.floor((now - this.sampledAt) / 1000));
      // Frequent reads cannot skip a displayed second; a hidden tab still catches up.
      const ticks = now - this.observedAt < 2000 ? Math.min(1, elapsed) : elapsed;
      if (roundTrip < this.roundTrip && !this.corrected && remaining > this.seconds) {
        // A better estimate may recover one second once, without a long catch-up pause.
        this.seconds++;
        this.corrected = true;
      } else this.seconds = Math.max(0, this.seconds - ticks);
      // Keep ticking from elapsed time: waiting for a corrected target would freeze it.
      // Preserve the fractional tick phase, including elapsed time in a hidden tab.
      this.sampledAt += ticks * 1000;
    }
    this.expiresAt = expiresAt;
    this.observedAt = now;
    this.roundTrip = roundTrip;
    return this.seconds;
  }
}

export function waitingRoomState(room: Pick<Room, 'status' | 'expiresAt'>, serverNow: number) {
  if (room.status !== 'waiting') return 'started';
  return remainingSeconds(room.expiresAt, serverNow) === 0 ? 'closed' : 'waiting';
}

export type RoomAction = 'creating' | 'joining' | undefined;
