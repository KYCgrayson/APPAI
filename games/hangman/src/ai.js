// The computer chooses a secret; it never needs a search or network request.
export function chooseWord(words, { category = 'all', difficulty = 'any', previous = '' } = {}, random = Math.random) {
  const pool = words.filter(w => (category === 'all' || w.category === category) && (difficulty === 'any' || w.difficulty === difficulty));
  if (!pool.length) return null;
  const fresh = pool.filter(w => w.word !== previous);
  const options = fresh.length ? fresh : pool;
  const r = random();
  return options[Math.max(0, Math.min(options.length - 1, Math.floor((Number.isFinite(r) ? r : 0) * options.length)))];
}
