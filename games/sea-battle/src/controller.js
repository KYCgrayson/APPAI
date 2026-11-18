import * as L from './logic.js';
import { chooseShot } from './ai.js';

export const STORAGE_KEY = 'sea-battle:v1';
export const defaultSettings = () => ({ mode: 'ai', level: 'normal', size: 10, touch: false, again: false, theme: 'auto' });
export function initialState(settings = {}) {
  return { settings: cleanSettings(settings), game: null, screen: 'home', placing: 0, selected: 0,
    mode: cleanSettings(settings).mode, level: cleanSettings(settings).level, vertical: false, aim: null, tab: 'target', feedback: null, error: null, nextScreen: null, log: [] };
}
export function cleanSettings(settings) {
  return { mode: settings.mode === 'human' ? 'human' : 'ai',
    level: ['easy', 'normal', 'hard'].includes(settings.level) ? settings.level : 'normal',
    size: settings.size === 8 ? 8 : 10, touch: settings.touch === true, again: settings.again === true,
    theme: ['auto', 'light', 'dark'].includes(settings.theme) ? settings.theme : 'auto' };
}
function handoff(state, nextScreen) {
  return { ...state, screen: 'handoff', nextScreen, aim: null, feedback: null, error: null, tab: 'target' };
}
export function newSession(settings, rng = Math.random) {
  const state = initialState(settings), game = L.createGame(settings);
  game.fleets[0] = L.fleetSizes(game.size).map(() => null);
  game.fleets[1] = state.mode === 'human' ? L.fleetSizes(game.size).map(() => null) : L.randomFleet(game.size, game.touch, rng);
  const next = { ...state, game, screen: 'place' };
  return state.mode === 'human' ? handoff(next, 'place') : next;
}
export function viewer(state) {
  return state.screen === 'place' || (state.screen === 'handoff' && state.nextScreen === 'place') ? state.placing
    : state.mode === 'ai' ? 0 : state.feedback ? state.feedback.player : state.game.turn;
}
export function placementIssue(state) {
  if (state.aim === null) return 'chooseCell';
  const lengths = L.fleetSizes(state.game.size);
  return L.placementError(state.game.size, state.game.fleets[state.placing].filter((s, i) => s && i !== state.selected),
    lengths[state.selected], state.aim, state.vertical, state.game.touch);
}
function shoot(state, player, cell) {
  const game = L.fire(state.game, player, cell);
  const shot = game.shots[player].at(-1);
  return { ...state, game, log: [...state.log, { player, cell }], aim: null, error: null,
    feedback: { player, shot }, screen: game.winner !== null ? 'result' : 'battle', tab: 'target' };
}
export function transition(state, action, rng = Math.random) {
  const g = state.game;
  switch (action.type) {
    case 'new': return newSession(state.settings, rng);
    case 'home': return { ...state, screen: 'home', aim: null, error: null };
    case 'settings': return { ...state, settings: cleanSettings({ ...state.settings, ...action.value }) };
    case 'resume': {
      if (!g) return state;
      const next = g.winner !== null ? 'result' : g.status === 'placing' ? 'place' : 'battle';
      return state.mode === 'human' && next !== 'result' ? handoff(state, next) : { ...state, screen: next, aim: null, feedback: null };
    }
    case 'reveal': return state.screen === 'handoff' ? { ...state, screen: state.nextScreen, nextScreen: null } : state;
    case 'ship': return state.screen === 'place' && Number.isInteger(action.index) && action.index >= 0 && action.index < L.fleetSizes(g.size).length
      ? { ...state, selected: action.index, aim: null, error: null } : state;
    case 'rotate': return state.screen === 'place' ? { ...state, vertical: !state.vertical, error: null } : state;
    case 'aim': {
      if (!Number.isInteger(action.cell) || !g || action.cell < 0 || action.cell >= g.size * g.size) return state;
      if (state.screen === 'place') return { ...state, aim: action.cell, error: null };
      if (state.screen !== 'battle' || state.feedback || (state.mode === 'ai' && g.turn === 1) ||
          g.shots[g.turn].some(s => s.cell === action.cell)) return state;
      return { ...state, aim: action.cell, error: null };
    }
    case 'place': {
      if (state.screen !== 'place') return state;
      const error = placementIssue(state);
      if (error) return { ...state, error };
      const fleets = g.fleets.map(f => f.slice());
      fleets[state.placing][state.selected] = L.shipCells(g.size, L.fleetSizes(g.size)[state.selected], state.aim, state.vertical);
      const missing = fleets[state.placing].findIndex(s => !s);
      return { ...state, game: { ...g, fleets }, selected: missing < 0 ? state.selected : missing, aim: null, error: null };
    }
    case 'random':
    case 'clear': {
      if (state.screen !== 'place') return state;
      const fleets = g.fleets.slice();
      fleets[state.placing] = action.type === 'random' ? L.randomFleet(g.size, g.touch, rng) : L.fleetSizes(g.size).map(() => null);
      return { ...state, game: { ...g, fleets }, aim: null, selected: 0, error: null };
    }
    case 'ready': {
      if (state.screen !== 'place' || !L.validFleet(g.size, g.fleets[state.placing], g.touch)) return state;
      if (state.mode === 'human' && state.placing === 0) return handoff({ ...state, placing: 1, selected: 0 }, 'place');
      const next = { ...state, game: L.startGame(g), screen: 'battle', aim: null, feedback: null, tab: 'target', error: null };
      return state.mode === 'human' ? handoff(next, 'battle') : next;
    }
    case 'fire': return state.screen === 'battle' && !state.feedback && state.aim !== null &&
      !(state.mode === 'ai' && g.turn === 1) ? shoot(state, g.turn, state.aim) : state;
    case 'next': {
      if (state.screen !== 'battle' || !state.feedback) return state;
      if (state.mode === 'human' && g.turn !== state.feedback.player) return handoff(state, 'battle');
      return { ...state, feedback: null, aim: null, tab: 'target' };
    }
    case 'ai': return state.screen === 'battle' && !state.feedback && state.mode === 'ai' && g.turn === 1
      ? shoot(state, 1, chooseShot(L.shotKnowledge(g, 1), state.level, rng)) : state;
    case 'tab': return { ...state, tab: action.tab === 'own' ? 'own' : 'target', aim: null };
    default: return state;
  }
}
export function serialize(state, locale = null) {
  return JSON.stringify({ version: 1, state, locale });
}
export function restore(raw) {
  try {
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !saved.state) return null;
    const s = saved.state, fresh = initialState(s.settings);
    if (!s.game) return fresh;
    const g = s.game;
    if (![8, 10].includes(g.size) || typeof g.touch !== 'boolean' || typeof g.again !== 'boolean' ||
        !Array.isArray(g.fleets) || g.fleets.length !== 2 || ![0, 1].includes(s.placing)) return null;
    if (g.status === 'placing') {
      for (const fleet of g.fleets) {
        if (!Array.isArray(fleet) || fleet.length !== L.fleetSizes(g.size).length) return null;
        const placed = [];
        for (let i = 0; i < fleet.length; i++) {
          const ship = fleet[i];
          if (ship === null) continue;
          const cells = Array.isArray(ship) && ship.slice().sort((a, b) => a - b);
          if (!cells || cells.length !== L.fleetSizes(g.size)[i] ||
              L.placementError(g.size, placed, cells.length, cells[0], cells[1] - cells[0] === g.size, g.touch) ||
              JSON.stringify(L.shipCells(g.size, cells.length, cells[0], cells[1] - cells[0] === g.size)) !== JSON.stringify(cells)) return null;
          placed.push(cells);
        }
      }
      if (s.placing === 1 && !L.validFleet(g.size, g.fleets[0], g.touch)) return null;
      fresh.game = { ...L.createGame(g), fleets: g.fleets };
    } else {
      if (!Array.isArray(s.log) || s.log.length > 200) return null;
      let replay = L.startGame({ ...L.createGame(g), fleets: g.fleets });
      for (const move of s.log) replay = L.fire(replay, move.player, move.cell);
      fresh.game = replay;
      fresh.log = s.log;
    }
    // Game options belong to the saved game; home preferences can differ for the next game.
    fresh.mode = s.mode === 'human' ? 'human' : 'ai';
    fresh.level = ['easy', 'normal', 'hard'].includes(s.level) ? s.level : 'normal';
    fresh.placing = s.placing;
    fresh.screen = fresh.game.winner !== null ? 'result' : fresh.game.status === 'placing' ? 'place' : 'battle';
    if (s.screen === 'home') fresh.screen = 'home';
    else if (fresh.mode === 'human' && fresh.screen !== 'result') return handoff(fresh, fresh.screen);
    return fresh;
  } catch { return null; }
}
