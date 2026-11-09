import { other, type Game, type Seat } from '../logic/game.ts';

/** Manual selection lasts until a new guess/reply, including an automatic reply. */
export function selectOpponentHistory(
  previous: Game | undefined,
  next: Game,
  seat: Seat,
  selected: boolean,
) {
  const before = previous?.id === next.id ? previous.history : [[], []];
  const replied = (entries: Game['history'][Seat]) => entries.filter((entry) => entry.r).length;
  const opponent = other(seat);
  const opponentChanged =
    next.history[opponent].length > before[opponent].length ||
    replied(next.history[opponent]) > replied(before[opponent]);
  const ownReply = replied(next.history[seat]) > replied(before[seat]);
  // A poll can include both events. The reducer's turn identifies the latest one.
  if (opponentChanged && ownReply) return next.turn === seat;
  if (opponentChanged) return true;
  if (ownReply) return false;
  return selected;
}

type EntryScreen = 'secret' | 'play';
/** Drafts belong to an entry, never to a particular render or room version. */
export class EntryDrafts {
  private values = new Map<string, string>();
  get(gameId: string, seat: Seat, screen: EntryScreen) {
    return this.values.get(JSON.stringify([gameId, seat, screen])) ?? '';
  }
  set(gameId: string, seat: Seat, screen: EntryScreen, value: string) {
    this.values.set(JSON.stringify([gameId, seat, screen]), value);
  }
  reset() {
    this.values.clear();
  }
}

/** Pointer input is consumed immediately; its later click must not enter twice. */
export function acceptsKeypadEvent(event: {
  type: string;
  button?: number;
  isPrimary?: boolean;
  detail?: number;
}) {
  return event.type === 'pointerdown'
    ? event.button === 0 && event.isPrimary !== false
    : event.type === 'click' && event.detail === 0;
}

export function keyboardAction(screen: string, key: string, interactive: boolean) {
  if (interactive || !['secret', 'play'].includes(screen)) return null;
  if (/^\d$/.test(key)) return { type: 'digit', value: key };
  if (key === 'Backspace') return { type: 'delete' };
  if (key === 'Enter') return { type: 'submit' };
  return null;
}
export function rematchNames(
  names: [string, string],
  relay: boolean,
  seat: 0 | 1,
): [string, string] {
  return relay && seat === 1 ? [names[1], names[0]] : [...names];
}
export function roomURL(href: string, code: string) {
  const url = new URL(href);
  url.searchParams.set('room', code);
  return url.href;
}
