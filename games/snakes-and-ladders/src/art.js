import { BOARDS, coordinates, squareAt } from './logic.js';
export const symbols = ['●', '▲', '■', '◆'];
export function center(square, end) { const p = coordinates(square, end); return { x: p.x * 100 + 50, y: p.y * 100 + 50 }; }
function connectionPoint(square, end) {
  const p = center(square, end);
  // The short board reserves the right side of each cell for connections,
  // leaving the number badge at the top left completely clear.
  return { ...p, x: p.x + (end === 50 ? 25 : 0) };
}
export function tokenPoint(square, seat, end) {
  const p = square ? center(square, end) : { x: 35 + seat * 68, y: end / 10 * 100 + 45 };
  return { x: p.x + (square ? (seat % 2 ? 19 : -19) : 0), y: p.y + (square ? (seat < 2 ? -3 : 31) : 0) };
}
function token(seat, square, end) {
  const { x, y } = tokenPoint(square, seat, end);
  const shape = [
    '<circle r="21"/>', '<path d="M0 -24 24 20 -24 20Z"/>',
    '<rect x="-21" y="-21" width="42" height="42" rx="4"/>', '<path d="M0 -26 25 0 0 26 -25 0Z"/>',
  ][seat];
  return `<g id="token-${seat}" class="token p${seat}" transform="translate(${x} ${y})">${shape}<text y="7" text-anchor="middle">${seat + 1}</text></g>`;
}
function ladder(from, to, end) {
  const a = connectionPoint(+from, end), b = connectionPoint(to, end), dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy), nx = -dy / length * 14, ny = dx / length * 14;
  let wood = `<path d="M${a.x + nx} ${a.y + ny}L${b.x + nx} ${b.y + ny} M${a.x - nx} ${a.y - ny}L${b.x - nx} ${b.y - ny}"/>`;
  const rungs = Math.max(3, Math.floor(length / 45));
  for (let i = 1; i < rungs; i++) {
    const x = a.x + dx * i / rungs, y = a.y + dy * i / rungs;
    wood += `<path d="M${x + nx} ${y + ny}L${x - nx} ${y - ny}"/>`;
  }
  return `<g class="ladder">${wood}</g>`;
}
function snake(from, to, end, i) {
  const a = connectionPoint(+from, end), b = connectionPoint(to, end), bend = (i % 2 ? -1 : 1) * (end === 50 ? 40 : 65);
  const path = `M${b.x} ${b.y}C${b.x + bend} ${b.y - 55} ${a.x - bend} ${a.y + 65} ${a.x} ${a.y}`;
  return `<g class="snake snake-${i % 2}"><path class="snake-edge" d="${path}"/><path class="snake-body" d="${path}"/><ellipse class="snake-head" cx="${a.x}" cy="${a.y}" rx="23" ry="19"/><g class="face"><circle cx="${a.x - 9}" cy="${a.y - 5}" r="3"/><circle cx="${a.x + 9}" cy="${a.y - 5}" r="3"/><path d="M${a.x - 6} ${a.y + 5}q6 8 12 0" fill="none" stroke="currentColor" stroke-width="3"/></g></g>`;
}
export function boardSvg(game, label) {
  const board = BOARDS[game.board], end = board.end, height = end / 10 * 100;
  let cells = '', numbers = '';
  for (let y = 0; y < end / 10; y++) for (let x = 0; x < 10; x++) {
    const n = squareAt(x, y, end);
    cells += `<rect class="cell cell-${(x + y) % 2}" x="${x * 100}" y="${y * 100}" width="100" height="100"/>`;
    numbers += `<g class="number"><rect x="${x * 100 + 3}" y="${y * 100 + 2}" width="${n === 100 ? 66 : 47}" height="37" rx="6"/><text x="${x * 100 + 6}" y="${y * 100 + 31}">${n}</text></g>`;
  }
  const wood = Object.entries(board.ladders).map(([from, to]) => ladder(from, to, end)).join('');
  const snakes = Object.entries(board.snakes).map(([from, to], i) => snake(from, to, end, i)).join('');
  return `<svg id="board-svg" viewBox="0 0 1000 ${height + 80}" role="img" aria-label="${label}">${cells}${wood}${snakes}${numbers}<g class="start-line"><path d="M8 ${height + 5}H992"/></g>${game.positions.map((p, i) => token(i, p, end)).join('')}</svg>`;
}
export function heroArt() {
  return `<svg class="hero-art" viewBox="0 0 300 175" aria-hidden="true"><rect class="hero-tile one" x="26" y="60" width="96" height="96" rx="22" transform="rotate(-12 74 108)"/><rect class="hero-tile two" x="166" y="18" width="100" height="100" rx="22" transform="rotate(10 216 68)"/><g class="ladder" transform="rotate(25 145 85)"><path d="M130 32V145M158 32V145M130 47H158M130 70H158M130 93H158M130 116H158M130 139H158"/></g><g class="snake"><path class="snake-edge" d="M60 139C150 169 168 83 215 61"/><path class="snake-body" d="M60 139C150 169 168 83 215 61"/><ellipse class="snake-head" cx="220" cy="56" rx="23" ry="19"/><g class="face"><circle cx="213" cy="51" r="3"/><circle cx="229" cy="51" r="3"/><path d="M216 61q6 7 12 0" fill="none" stroke="currentColor" stroke-width="3"/></g></g></svg>`;
}
