import { DEFAULTS, newGame, validateGame, legalMoves } from './logic.js';
export const SAVE_KEY = 'race-home:v1';
export const defaultPreferences = () => ({ theme: 'auto', sound: false, count: 2, seats: ['human', 'computer', 'computer', 'computer'], rules: { ...DEFAULTS } });
export function readSave(storage) {
  const defaults = defaultPreferences();
  try {
    const data = JSON.parse(storage.getItem(SAVE_KEY));
    if (data?.v !== 1) return { preferences: defaults };
    const p = data.preferences;
    if (!p || !['auto', 'light', 'dark'].includes(p.theme) || typeof p.sound !== 'boolean' || ![2, 3, 4].includes(p.count) ||
        !Array.isArray(p.seats) || p.seats.length !== 4 || !p.seats.every(x => ['human', 'computer'].includes(x)) || !p.seats.slice(0, p.count).includes('human') ||
        !p.rules || Object.keys(p.rules).sort().join() !== Object.keys(DEFAULTS).sort().join()) return { preferences: defaults };
    newGame(p.count, p.rules);
    const game = data.game ? validateGame(data.game) : undefined;
    return { preferences: p, game, roomCode: typeof data.roomCode === 'string' ? data.roomCode : undefined };
  } catch { return { preferences: defaults }; }
}
export function writeSave(storage, preferences, game, roomCode) {
  try { storage.setItem(SAVE_KEY, JSON.stringify({ v: 1, preferences, game, roomCode })); return true; } catch { return false; }
}
export function automaticAction(game, preferences, online = false) {
  if (!game || game.phase === 'finished' || online) return null;
  if (preferences.seats[game.turn] === 'computer') return game.phase === 'roll' ? 'roll' : 'pick';
  return game.phase === 'choose' && game.settings.autoMove && legalMoves(game).length === 1 ? 'pick' : null;
}
export function positionKey(p) { return p < 0 ? 'yard' : p === 57 ? 'homePosition' : p < 52 ? 'step' : 'lane'; }
