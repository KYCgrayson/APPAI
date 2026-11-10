import { button, esc } from './html.ts';
import type { strings } from './i18n.ts';
import { other, type Game, type Seat } from '../logic/game.ts';
import type { Room } from '../net/rooms.ts';
import type { RoomAction } from '../net/lifecycle.ts';
type Text = typeof strings.en | (typeof strings)['zh-TW'];
export function rulesScreen(t: typeof strings.en | (typeof strings)['zh-TW'], english: boolean) {
  return `<section class="panel rules-card">
  <h1>${esc(t.rules)}</h1>
  <ol>${t.instructions.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
  <div class="example">
  <span class="chip">7</span>
  <span class="chip">2</span>
  <span class="chip">4</span>
  <strong>1A2B</strong>
  </div>
  <p>${esc(t.example)}</p>${button(english ? 'Back' : '返回', 'closeRules')}</section>`;
}
export function handoverScreen(name: string, symbol: string, pass: string, ready: string) {
  return `<section class="handover-card">
  <div class="giant">${esc(symbol)}</div>
  <h1>${esc(pass)}</h1>
  <h2>${esc(name)}</h2>${button(ready.replace('{name}', name), 'handover', 'primary')}</section>`;
}
export function waitingSecretScreen(room: Room, seat: Seat, template: string, saving?: string) {
  if (room.seats.filter((s) => s.joined).length !== 2) return null;
  const text =
    !room.state.commits[seat] && room.state.commits[other(seat)] && saving
      ? saving
      : template.replace('{name}', room.state.names[other(seat)]);
  return `<section class="panel share-card"><p role="status">${esc(text)}</p></section>`;
}

export function roomProgress(t: Text, connecting: RoomAction) {
  return `<p class="room-progress" role="status">${connecting === 'creating' ? t.creatingRoom : connecting === 'joining' ? t.joiningRoom : ''}</p>`;
}

export function closedRoomScreen(t: Text, connecting: RoomAction) {
  return `<section class="panel share-card" aria-busy="${Boolean(connecting)}">
  <h1>${t.roomClosed}</h1>${button(t.recreateRoom, 'createRoom', 'primary', Boolean(connecting))}${roomProgress(t, connecting)}</section>`;
}

export function onlineLobbyScreen(
  t: Text,
  english: boolean,
  code: string[],
  connecting: RoomAction = undefined,
) {
  const disabled = Boolean(connecting);
  return `<section class="panel" aria-busy="${disabled}">
  <h1>${t.online}</h1>
  <p>${english ? 'Create a room or enter a six-character room code.' : '建立房間或輸入六位房號。'}</p>${button(t.create, 'createRoom', 'primary', disabled)}${roomProgress(t, connecting)}<div class="room-boxes">${Array.from({ length: 6 }, (_, i) => `<input data-room-digit="${i}" maxlength="1" aria-label="${english ? 'Room code' : '房號'} ${i + 1}" autocapitalize="characters"${disabled ? ' disabled' : ''} value="${esc(code[i] ?? '')}">`).join('')}</div>${button(t.join, 'joinRoom', '', disabled)}</section>`;
}

/** History always belongs to the guesser, regardless of which device supplied the reply. */
export function historiesScreen(game: Game, seat: Seat, showOpponent: boolean, t: Text) {
  const selected = showOpponent ? other(seat) : seat;
  const labels = [t.history, t.opponentHistory.replace('{name}', game.names[other(seat)])];
  return `<div class="history-switch" role="group" aria-label="${esc(t.history)}">${[
    seat,
    other(seat),
  ]
    .map(
      (s, i) =>
        `<button data-action="${i === 0 ? 'ownHistory' : 'opponentHistory'}" aria-pressed="${s === selected}"><span class="history-label">${esc(labels[i])}</span> <span>(${game.history[s].length})</span></button>`,
    )
    .join('')}</div><section class="histories">${[seat, other(seat)]
    .map(
      (
        s,
      ) => `<div data-history-seat="${s}" class="history ${s === selected ? 'history-selected' : ''}">
  <h2>${s === 0 ? '◆' : '●'} ${esc(game.names[s])} <small>${game.history[s].length}</small></h2>
  <ol>${
    [...game.history[s]]
      .reverse()
      .map(
        (e) => `<li>
  <span class="guess-chips">${[...e.g].map((d) => `<span class="mini-chip">${esc(d)}</span>`).join('')}</span>
  <strong class="reply">${e.r ? `${e.r.a}A${e.r.b}B` : '…'}</strong>
  </li>`,
      )
      .join('') || `<li class="empty">${esc(t.noGuesses)}</li>`
  }</ol></div>`,
    )
    .join('')}</section>`;
}
