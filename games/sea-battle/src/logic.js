// Pure paper-and-pencil rules. Cells are row-major integers, starting at zero.
export const fleetSizes = size => size === 8 ? [4, 3, 3, 2] : [5, 4, 3, 3, 2];
export const coordinate = (cell, size) => `${String.fromCharCode(65 + cell % size)}${Math.floor(cell / size) + 1}`;
export function shipCells(size, length, start, vertical = false) {
  if (![8, 10].includes(size) || !Number.isInteger(length) || length < 2 || length > 5 ||
      !Number.isInteger(start) || start < 0 || start >= size * size) return null;
  const row = Math.floor(start / size), col = start % size;
  if ((vertical ? row : col) + length > size) return null;
  return Array.from({ length }, (_, i) => start + i * (vertical ? size : 1));
}
export function adjacent(a, b, size) {
  return Math.abs(a % size - b % size) <= 1 && Math.abs(Math.floor(a / size) - Math.floor(b / size)) <= 1;
}
export function placementError(size, ships, length, start, vertical = false, touch = false) {
  const cells = shipCells(size, length, start, vertical);
  if (!cells) return 'bounds';
  const occupied = ships.flat();
  if (cells.some(c => occupied.includes(c))) return 'overlap';
  if (!touch && cells.some(c => occupied.some(o => adjacent(c, o, size)))) return 'touching';
  return null;
}
export function validFleet(size, ships, touch = false) {
  if (![8, 10].includes(size) || !Array.isArray(ships)) return false;
  const expected = fleetSizes(size).slice().sort().join(',');
  if (ships.map(s => Array.isArray(s) ? s.length : 0).sort().join(',') !== expected) return false;
  const placed = [];
  for (const ship of ships) {
    const cells = ship.slice().sort((a, b) => a - b);
    const vertical = cells[1] - cells[0] === size;
    const straight = shipCells(size, cells.length, cells[0], vertical);
    if (!straight || straight.some((c, i) => cells[i] !== c) ||
        placementError(size, placed, cells.length, cells[0], vertical, touch)) return false;
    placed.push(cells);
  }
  return true;
}
function shuffled(items, rng) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
export function randomFleet(size = 10, touch = false, rng = Math.random) {
  if (![8, 10].includes(size)) throw Error('size');
  const lengths = fleetSizes(size), ships = [];
  function search(index) {
    if (index === lengths.length) return true;
    const candidates = shuffled(Array.from({ length: size * size * 2 }, (_, i) => i), rng);
    for (const candidate of candidates) {
      const start = Math.floor(candidate / 2), vertical = Boolean(candidate % 2);
      if (placementError(size, ships, lengths[index], start, vertical, touch)) continue;
      ships.push(shipCells(size, lengths[index], start, vertical));
      if (search(index + 1)) return true;
      ships.pop();
    }
    return false;
  }
  if (!search(0)) throw Error('placement');
  return ships;
}
export function resolveShot(size, ships, shots, cell) {
  if (!Number.isInteger(cell) || cell < 0 || cell >= size * size) throw Error('bounds');
  if (shots.some(s => s.cell === cell)) throw Error('repeat');
  const ship = ships.find(s => s.includes(cell));
  const hitCells = new Set([...shots.filter(s => s.result !== 'miss').map(s => s.cell), cell]);
  const sunk = ship && ship.every(c => hitCells.has(c));
  return {
    cell, result: !ship ? 'miss' : sunk ? 'sunk' : 'hit',
    size: sunk ? ship.length : null, sunkCells: sunk ? ship.slice() : [],
    win: ships.length > 0 && ships.flat().every(c => hitCells.has(c)),
  };
}
export function createGame({ size = 10, touch = false, again = false } = {}) {
  if (![8, 10].includes(size)) throw Error('size');
  return { size, touch: Boolean(touch), again: Boolean(again), fleets: [[], []], shots: [[], []], turn: 0, winner: null, status: 'placing' };
}
export function startGame(game) {
  if (!game.fleets.every(f => validFleet(game.size, f, game.touch))) throw Error('fleet');
  return { ...game, turn: 0, status: 'playing' };
}
export function fire(game, player, cell) {
  if (game.status !== 'playing' || game.winner !== null) throw Error('finished');
  if (player !== game.turn) throw Error('turn');
  const shot = resolveShot(game.size, game.fleets[1 - player], game.shots[player], cell);
  const shots = game.shots.map((s, p) => p === player ? [...s, shot] : s);
  return { ...game, shots, turn: shot.win || (game.again && shot.result !== 'miss') ? player : 1 - player,
    winner: shot.win ? player : null, status: shot.win ? 'finished' : 'playing' };
}
// AI input deliberately contains no enemy fleet or unshot ship cells.
export function shotKnowledge(game, player) {
  return { size: game.size, touch: game.touch, lengths: fleetSizes(game.size), shots: game.shots[player] };
}
