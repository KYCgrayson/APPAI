import { newGame, validateGame, applyMove, undo } from './logic.js';
export const STORAGE_KEY = 'five-in-a-row:v1';
export const defaultSettings = () => ({ mode: 'computer', size: 15, difficulty: 'normal', humanSeat: 0, theme: 'auto' });
export function cleanSettings(s = {}) {
  const d = defaultSettings();
  for (const [key, choices] of Object.entries({ mode: ['computer', 'local', 'room'], size: [9, 13, 15], difficulty: ['easy', 'normal', 'hard'], humanSeat: [0, 1], theme: ['auto', 'light', 'dark'] })) {
    if (choices.includes(s[key])) d[key] = s[key];
  }
  return d;
}
export function initialState() {
  return { settings: defaultSettings(), active: null, screen: 'home', game: null, preview: null, zoom: false, roomCode: null };
}
export function restore(raw) {
  try {
    const data = JSON.parse(raw);
    const s = { ...initialState(), settings: cleanSettings(data.settings) };
    if (data.game) s.game = validateGame(data.game);
    if (s.game) s.active = cleanSettings(data.active ?? data.settings);
    s.roomCode = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(data.roomCode) ? data.roomCode : null;
    s.screen = s.game && ['play', 'end'].includes(data.screen) ? s.game.winner === null ? 'play' : 'end' : 'home';
    return s;
  } catch { return initialState(); }
}
export function startLocal(s) {
  return { ...s, active: { ...s.settings }, game: newGame(s.settings.size), screen: 'play', preview: null, roomCode: null };
}
export function canPlace(s, seat = null) {
  return s.screen === 'play' && s.game?.winner === null &&
    (s.active.mode !== 'computer' || s.game.turn === s.active.humanSeat) &&
    (s.active.mode !== 'room' || seat === s.game.turn);
}
export function previewAt(s, index, seat = null) {
  if (!canPlace(s, seat) || !Number.isInteger(index) || s.game.board[index] !== '0') return s;
  return { ...s, preview: index };
}
export function placePreview(s) {
  if (s.preview === null) return s;
  const game = applyMove(s.game, s.game.turn, { index: s.preview });
  return { ...s, game, preview: null, screen: game.winner === null ? 'play' : 'end' };
}
export function undoLocal(s) {
  const game = undo(s.game, s.active.mode, s.active.humanSeat);
  return { ...s, game, preview: null, screen: game.winner === null ? 'play' : 'end' };
}
