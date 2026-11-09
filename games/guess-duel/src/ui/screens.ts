import { button, esc } from './html.ts';
import type { strings } from './i18n.ts';
import { other, type Seat } from '../logic/game.ts';
import type { Room } from '../net/rooms.ts';
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
export function waitingSecretScreen(room: Room, seat: Seat, template: string) {
  if (room.seats.filter((s) => s.joined).length !== 2) return null;
  const waitingFor = room.state.commits[other(seat)] ? seat : other(seat);
  const name = room.state.names[waitingFor];
  return `<section class="panel share-card"><p role="status">${esc(template.replace('{name}', name))}</p></section>`;
}
