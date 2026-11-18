// Rejection sampling gives six equally likely results, with no modulo bias.
export function rollDie(random = globalThis.crypto) {
  if (!random?.getRandomValues) throw Error('random_unavailable');
  const word = new Uint32Array(1);
  do { random.getRandomValues(word); } while (word[0] >= 4294967292);
  return word[0] % 6 + 1;
}
export function computerMove(game, random = globalThis.crypto) {
  if (game.status !== 'playing' || game.players[game.turn] !== 'computer') throw Error('computer_turn');
  return { roll: rollDie(random) };
}
export const computerDelay = reduced => reduced ? 300 : 650;
