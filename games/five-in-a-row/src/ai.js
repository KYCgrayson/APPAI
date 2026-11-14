import { DIRECTIONS, winningLine } from './logic.js';

export function candidates(game) {
  const { board, size } = game;
  if (!board.includes('1') && !board.includes('2')) return [Math.floor(size / 2) * (size + 1)];
  const near = new Set();
  for (let i = 0; i < board.length; i++) {
    if (board[i] === '0') continue;
    const r = Math.floor(i / size), c = i % size;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr * size + nc] === '0') near.add(nr * size + nc);
    }
  }
  return [...near];
}

function withStone(board, i, seat) {
  return board.slice(0, i) + (seat + 1) + board.slice(i + 1);
}

// Inspect four nine-point lines. Distinct axes count independently for forks.
export function threat(board, size, index, seat) {
  const b = withStone(board, index, seat), stone = String(seat + 1);
  if (winningLine(b, size, index).length) return 1e8;
  let openFour = 0, four = 0, three = 0, two = 0;
  for (const [dr, dc] of DIRECTIONS) {
    let line = '';
    const r = Math.floor(index / size), c = index % size;
    for (let k = -4; k <= 4; k++) {
      const nr = r + dr * k, nc = c + dc * k;
      line += nr < 0 || nr >= size || nc < 0 || nc >= size ? '#' : b[nr * size + nc] === '0' ? '.' : b[nr * size + nc] === stone ? 'X' : '#';
    }
    if (line.includes('.XXXX.')) openFour++;
    let hasFour = false;
    for (let start = 0; start <= 4; start++) {
      const window = line.slice(start, start + 5);
      if (!window.includes('#') && window.split('X').length - 1 === 4) hasFour = true;
    }
    if (hasFour) four++;
    if (['.XXX.', '.XX.X.', '.X.XX.'].some((p) => line.includes(p))) three++;
    if (['.XX.', '.X.X.'].some((p) => line.includes(p))) two++;
  }
  if (openFour) return 2e6 + openFour * 1e4;
  if (four >= 2) return 1.8e6;
  if (four && three) return 1.2e6;
  if (three >= 2) return 8e5;
  return four * 1e5 + three * 1e4 + two * 500;
}

export function chooseMove(game, difficulty = 'hard', random = Math.random) {
  if (game.winner !== null) return null;
  const cells = candidates(game), seat = game.turn;
  const ranked = cells.map((index) => {
    const attack = threat(game.board, game.size, index, seat);
    const defend = threat(game.board, game.size, index, 1 - seat);
    const center = (game.size - 1) / 2;
    const distance = Math.abs(Math.floor(index / game.size) - center) + Math.abs(index % game.size - center);
    return { index, attack, defend, score: Math.max(attack, defend * 0.94) + Math.min(attack, defend) * 0.15 - distance };
  });
  const wins = ranked.filter((m) => m.attack >= 1e8);
  if (wins.length) return wins[0].index;
  const blocks = ranked.filter((m) => m.defend >= 1e8);
  if (blocks.length) return blocks.sort((a, b) => b.attack - a.attack)[0].index;
  ranked.sort((a, b) => b.score - a.score);
  const pick = (list) => list[Math.min(list.length - 1, Math.floor(Math.max(0, random()) * list.length))].index;
  if (difficulty === 'easy') return pick(ranked);
  if (difficulty === 'normal' && random() < 0.23) return pick(ranked.slice(0, Math.min(8, ranked.length)));
  // For quiet positions, probe the best six moves for the opponent's strongest reply.
  // Immediate wins and forcing threats above are always handled before this search.
  if (difficulty === 'hard' && ranked[0].score < 7e5) {
    const shortlist = ranked.slice(0, 6);
    for (const option of shortlist) {
      const board = withStone(game.board, option.index, seat);
      let reply = 0;
      for (const i of cells) if (i !== option.index) reply = Math.max(reply, threat(board, game.size, i, 1 - seat));
      option.score -= reply * 0.7;
    }
    shortlist.sort((a, b) => b.score - a.score);
    return shortlist[0].index;
  }
  return ranked[0]?.index ?? null;
}
