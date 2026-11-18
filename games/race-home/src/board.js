import { square, starts, SYMBOLS } from './logic.js';
export const TRACK = [
  [1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],
  [8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],
  [13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14],
  [6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],
];
export const LANES = [Array.from({ length: 5 }, (_, i) => [i+1,7]), Array.from({ length: 5 }, (_, i) => [7,i+1]), Array.from({ length: 5 }, (_, i) => [13-i,7]), Array.from({ length: 5 }, (_, i) => [7,13-i])];
const yard = [[3,3],[11,3],[11,11],[3,11]];
function shape(seat, x, y, r) {
  if (seat === 0) return `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  if (seat === 1) return `<rect x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}" rx="2"/>`;
  if (seat === 2) return `<path d="M${x},${y-r*1.2} L${x+r*1.1},${y+r} L${x-r*1.1},${y+r}Z"/>`;
  return `<path d="${Array.from({ length: 10 }, (_, i) => { const a = i*Math.PI/5-Math.PI/2, size = i%2 ? r*.52 : r*1.2; return `${i?'L':'M'}${x+Math.cos(a)*size},${y+Math.sin(a)*size}`; }).join(' ')}Z"/>`;
}
export function boardSVG(g) {
  const activeStarts = starts(g);
  const logical = seat => activeStarts[seat] / 13;
  let art = '<svg viewBox="0 0 600 600" aria-hidden="true" focusable="false">';
  for (let seat = 0; seat < g.players.length; seat++) {
    const [x,y] = yard[logical(seat)];
    art += `<g class="p${seat}"><rect class="yard" x="${(x-2.5)*40}" y="${(y-2.5)*40}" width="200" height="200" rx="24"/><text class="yard-symbol" x="${x*40}" y="${y*40+15}">${SYMBOLS[seat]}</text></g>`;
  }
  TRACK.forEach(([x,y], i) => {
    const start = activeStarts.indexOf(i), star = [8,21,34,47].includes(i);
    art += `<g${start >= 0 ? ` class="p${start}"` : ''}><rect class="cell${start >= 0 ? ' start' : ''}" x="${x*40+1}" y="${y*40+1}" width="38" height="38" rx="5"/>`;
    if (star || [0,13,26,39].includes(i)) art += `<text class="safe-mark" x="${x*40+20}" y="${y*40+28}">${start >= 0 ? SYMBOLS[start] : '☆'}</text>`;
    art += '</g>';
  });
  for (let seat = 0; seat < g.players.length; seat++) {
    for (const [x,y] of LANES[logical(seat)]) art += `<g class="p${seat}"><rect class="lane" x="${x*40+1}" y="${y*40+1}" width="38" height="38" rx="5"/></g>`;
  }
  art += '<rect class="center" x="242" y="242" width="116" height="116" rx="20"/><path class="home-mark" d="M265 293L300 263L335 293M275 286V328H325V286M294 328V307H307V328"/>';
  const groups = new Map();
  g.players.forEach((tokens, seat) => tokens.forEach((p, token) => {
    let x,y;
    if (p < 0) { const center = yard[logical(seat)]; x = center[0]*40 + (token%2 ? 37 : -37); y = center[1]*40 + (token<2 ? -37 : 37); }
    else if (p === 57) { x = 273 + (seat%2)*54; y = 273 + Math.floor(seat/2)*54; }
    else { const coord = p<52 ? TRACK[square(g,seat,p)] : LANES[logical(seat)][p-52]; x=coord[0]*40+20; y=coord[1]*40+20; }
    const key = `${x},${y}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ seat, token, x, y });
  }));
  for (const group of groups.values()) {
    const count = group.length, columns = Math.ceil(Math.sqrt(count));
    group.forEach(({seat,token,x,y}, i) => {
      const r = count === 1 ? 14 : Math.min(11, 18/columns);
      const spacing = r*2;
      if (count > 1) { x += (i%columns-(columns-1)/2)*spacing; y += (Math.floor(i/columns)-(Math.ceil(count/columns)-1)/2)*spacing; }
      art += `<g class="p${seat} piece">${shape(seat,x,y,r)}<text x="${x}" y="${y+4}" style="font-size:${count>4?7:11}px">${token+1}</text></g>`;
    });
  }
  return art+'</svg>';
}
