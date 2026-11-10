import { adjacent, shipCells } from './logic.js';

const pick = (items, rng) => items.length ? items[Math.floor(rng() * items.length)] : null;
export function chooseShot(knowledge, level = 'normal', rng = Math.random) {
  const { size, shots, lengths, touch } = knowledge;
  const used = new Set(shots.map(s => s.cell));
  const available = Array.from({ length: size * size }, (_, i) => i).filter(c => !used.has(c));
  if (level === 'easy' || available.length === 0) return pick(available, rng);
  const sunk = new Set(shots.flatMap(s => s.sunkCells));
  const hits = shots.filter(s => s.result !== 'miss' && !sunk.has(s.cell)).map(s => s.cell);
  if (level === 'normal') {
    const neighbors = available.filter(c => hits.some(h =>
      Math.abs(c % size - h % size) + Math.abs(Math.floor(c / size) - Math.floor(h / size)) === 1));
    return pick(neighbors.length ? neighbors : available, rng);
  }
  const remaining = lengths.slice();
  for (const s of shots.filter(s => s.result === 'sunk')) {
    const index = remaining.indexOf(s.size);
    if (index !== -1) remaining.splice(index, 1);
  }
  const blocked = new Set(shots.filter(s => s.result === 'miss').map(s => s.cell));
  for (const cell of sunk) {
    blocked.add(cell);
    if (!touch) for (let c = 0; c < size * size; c++) if (adjacent(c, cell, size)) blocked.add(c);
  }
  const scores = Array(size * size).fill(0);
  let bestHitCount = 0;
  const candidates = [];
  for (const length of remaining) for (let start = 0; start < size * size; start++) for (const vertical of [false, true]) {
    const cells = shipCells(size, length, start, vertical);
    if (!cells || cells.some(c => blocked.has(c))) continue;
    // With separated ships, an unresolved hit beside a candidate must belong to it.
    if (!touch && hits.some(h => !cells.includes(h) && cells.some(c => adjacent(c, h, size)))) continue;
    const hitCount = hits.filter(h => cells.includes(h)).length;
    bestHitCount = Math.max(bestHitCount, hitCount);
    candidates.push({ cells, hitCount });
  }
  for (const { cells, hitCount } of candidates) {
    if (hits.length && hitCount !== bestHitCount) continue;
    for (const c of cells) if (!used.has(c)) scores[c]++;
  }
  const best = Math.max(...available.map(c => scores[c]));
  return pick(available.filter(c => scores[c] === best), rng);
}
