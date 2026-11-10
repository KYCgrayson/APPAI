import type { Room } from './rooms.ts';

export type ClockBounds = { lower: number; upper: number };

/** Date names a whole server second at some instant during the request. */
export function serverClockBounds(
  date: string | null,
  sentAt: number,
  receivedAt: number,
  previous?: ClockBounds,
): ClockBounds | undefined {
  const serverTime = date === null ? NaN : Date.parse(date);
  if (!Number.isFinite(serverTime)) return previous;
  const sample = { lower: serverTime - receivedAt, upper: serverTime + 1000 - sentAt };
  if (!previous) return sample;
  const intersection = {
    lower: Math.max(previous.lower, sample.lower),
    upper: Math.min(previous.upper, sample.upper),
  };
  // Disjoint bounds indicate a clock change; start calibration again.
  return intersection.lower < intersection.upper ? intersection : sample;
}

/** Midpoint of one Date sample, including its truncation and request duration. */
export function serverClockOffset(date: string | null, sentAt: number, receivedAt: number) {
  const bounds = serverClockBounds(date, sentAt, receivedAt);
  return bounds && (bounds.lower + bounds.upper) / 2;
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
  private now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  get expired() {
    return this.seconds === 0;
  }

  remaining(expiresAt: string, serverNow: number) {
    const now = this.now();
    // Keep all expiry milliseconds and follow the calibrated local deadline.
    const deadline = Date.parse(expiresAt) - (serverNow - now);
    const remaining = Number.isFinite(deadline)
      ? Math.max(0, Math.ceil((deadline - now) / 1000))
      : 0;
    this.seconds = this.expiresAt === expiresAt ? Math.min(this.seconds, remaining) : remaining;
    this.expiresAt = expiresAt;
    return this.seconds;
  }
}

export function waitingRoomState(room: Pick<Room, 'status' | 'expiresAt'>, serverNow: number) {
  if (room.status !== 'waiting') return 'started';
  return remainingSeconds(room.expiresAt, serverNow) === 0 ? 'closed' : 'waiting';
}

export type RoomAction = 'creating' | 'joining' | undefined;
