// Freestyle Gomoku. Seat 0 is black (1), seat 1 is white (2).
export const SIZES = [9, 13, 15];
export const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

export function newGame(size = 15) {
  if (!SIZES.includes(size)) throw Error('invalid_size');
  return { size, board: '0'.repeat(size * size), moves: [], turn: 0, winner: null, line: [], revision: 0 };
}

export function winningLine(board, size, index) {
  const stone = board[index];
  if (!stone || stone === '0') return [];
  const r = Math.floor(index / size), c = index % size;
  for (const [dr, dc] of DIRECTIONS) {
    const before = [], after = [];
    for (const [sign, list] of [[-1, before], [1, after]]) {
      for (let k = 1; k < size; k++) {
        const nr = r + sign * k * dr, nc = c + sign * k * dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size || board[nr * size + nc] !== stone) break;
        list.push(nr * size + nc);
      }
    }
    const line = [...before.reverse(), index, ...after];
    if (line.length >= 5) return line;
  }
  return [];
}

export function applyMove(game, seat, move) {
  if (game.winner !== null) throw Error('game_over');
  if (seat !== game.turn) throw Error('not_your_turn');
  const i = move?.index;
  if (!Number.isInteger(i) || i < 0 || i >= game.board.length) throw Error('invalid_move');
  if (game.board[i] !== '0') throw Error('occupied');
  const board = game.board.slice(0, i) + (seat + 1) + game.board.slice(i + 1);
  const line = winningLine(board, game.size, i);
  return { ...game, board, moves: [...game.moves, [i, seat]], turn: 1 - seat,
    winner: line.length ? seat : !board.includes('0') ? 'draw' : null, line };
}

// A skipped turn is recorded too, so a later snapshot can be replayed exactly.
export function applySkip(game, seat = game.turn) {
  if (game.winner !== null || seat !== game.turn) throw Error('invalid_skip');
  return { ...game, turn: 1 - seat, moves: [...game.moves, [-1, seat]] };
}

export function replay(size, moves) {
  if (!Array.isArray(moves) || moves.length > 2000) throw Error('invalid_state');
  return moves.reduce((g, m) => {
    if (!Array.isArray(m) || m.length !== 2 || ![0, 1].includes(m[1])) throw Error('invalid_state');
    return m[0] === -1 ? applySkip(g, m[1]) : applyMove(g, m[1], { index: m[0] });
  }, newGame(size));
}

export function validateGame(value) {
  if (!value || !Number.isSafeInteger(value.revision) || value.revision < 0) throw Error('invalid_state');
  const game = replay(value.size, value.moves);
  if (value.board !== game.board || value.turn !== game.turn || value.winner !== game.winner ||
      JSON.stringify(value.line) !== JSON.stringify(game.line)) throw Error('invalid_state');
  return { ...game, revision: value.revision };
}

export function undo(game, mode, humanSeat = 0) {
  if (mode === 'room' || !game.moves.length) return game;
  let length = game.moves.length - 1;
  if (mode === 'computer') {
    // Remove the human's last placement and any computer reply; never undo its opening alone.
    length = game.moves.findLastIndex((m) => m[1] === humanSeat && m[0] >= 0);
    if (length < 0) return game;
  }
  return replay(game.size, game.moves.slice(0, length));
}

export function lastMove(game) {
  return game.moves.findLast((m) => m[0] >= 0)?.[0] ?? -1;
}
