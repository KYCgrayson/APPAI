import { validateGame, createGame } from './logic.js';
export const STORAGE_KEY = 'snakes-and-ladders:v1';
export const defaults = () => ({ board: 'classic', exact: true, again: false, players: ['human', 'computer'], theme: 'auto' });
export function restore(raw) {
  const clean = { v: 1, settings: defaults(), local: null, screen: 'home', roomCode: '' };
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (data?.v !== 1) return clean;
    const settings = createGame(data.settings);
    clean.settings = { board: settings.board, exact: settings.exact, again: settings.again, players: settings.players, theme: ['auto', 'light', 'dark'].includes(data.settings.theme) ? data.settings.theme : 'auto' };
    if (data.local) clean.local = validateGame(data.local);
    clean.screen = data.screen === 'local' && clean.local ? 'local' : 'home';
    clean.roomCode = typeof data.roomCode === 'string' ? data.roomCode : '';
    if (data.screen === 'online' && clean.roomCode) clean.screen = 'online';
  } catch { /* A damaged save opens a usable home screen. */ }
  return clean;
}
export function mayRoll(game, mode, seat, waiting = false, busy = false) {
  return !!game && game.status === 'playing' && !waiting && !busy && (mode === 'local' ? game.players[game.turn] === 'human' : game.turn === seat);
}
export function animationFrames(last) {
  if (!last) return [];
  return [...last.steps.map(square => ({ square, jump: false })), ...last.jumps.map(j => ({ square: j.to, jump: true }))];
}
