import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, restore, startLocal, canPlace, previewAt, placePreview, undoLocal } from '../src/controller.js';
import { applyMove } from '../src/logic.js';

test('home → preview → confirm → full game → end → replay', () => {
  let s = initialState(); s.settings.mode = 'local'; s.settings.size = 9;
  assert.equal(s.screen, 'home'); s = startLocal(s);
  for (const i of [0, 72, 1, 74, 2, 76, 3, 78, 4]) {
    const before = s.game.board;
    s = previewAt(s, i); assert.equal(s.game.board, before); assert.equal(s.preview, i);
    s = placePreview(s); assert.equal(s.preview, null);
  }
  assert.equal(s.screen, 'end'); assert.equal(s.game.winner, 0); assert.equal(canPlace(s), false);
  assert.equal(restore(JSON.stringify(s)).screen, 'end');
  s = startLocal(s); assert.equal(s.screen, 'play'); assert.equal(s.game.moves.length, 0);
});
test('reload validates the game and clears stale previews', () => {
  let s = startLocal(initialState()); s = placePreview(previewAt(s, 112));
  s.preview = 10;
  const loaded = restore(JSON.stringify(s));
  assert.deepEqual(loaded.game, s.game); assert.equal(loaded.preview, null); assert.equal(loaded.screen, 'play');
  assert.equal(restore('{oops').screen, 'home');
  assert.equal(restore(JSON.stringify({ ...s, game: { ...s.game, board: '' } })).game, null);
});
test('changing home settings cannot change a resumed game’s mode or size', () => {
  let s = startLocal(initialState());
  s.settings.mode = 'room'; s.settings.size = 9;
  s = restore(JSON.stringify(s));
  assert.equal(s.active.mode, 'computer'); assert.equal(s.active.size, 15); assert.equal(s.game.size, 15);
});
test('computer turns cannot be previewed, undo restores the human turn', () => {
  let s = startLocal(initialState());
  s = placePreview(previewAt(s, 112)); assert.equal(canPlace(s), false);
  assert.equal(previewAt(s, 111), s);
  s.game = applyMove(s.game, 1, { index: 113 });
  assert.equal(canPlace(s), true);
  s = undoLocal(s); assert.equal(s.game.moves.length, 0); assert.equal(s.game.turn, 0);
});
test('room placement checks seat and room undo is disabled', () => {
  let s = initialState(); s.settings.mode = 'room'; s = startLocal(s);
  assert.equal(canPlace(s, 0), true); assert.equal(canPlace(s, 1), false);
  assert.equal(previewAt(s, 112, 1), s);
  s = previewAt(s, 112, 0); s = placePreview(s);
  assert.equal(undoLocal(s).game, s.game);
});
test('invalid saved settings are normalized and occupied previews are ignored', () => {
  const s = restore(JSON.stringify({ settings: { mode: 'bad', size: 99, theme: 'bad' } }));
  assert.equal(s.settings.mode, 'computer'); assert.equal(s.settings.size, 15); assert.equal(s.settings.theme, 'auto');
  let local = initialState(); local.settings.mode = 'local'; local = startLocal(local);
  local = placePreview(previewAt(local, 0));
  assert.equal(previewAt(local, 0), local); assert.equal(previewAt(local, -1), local); assert.equal(previewAt(local, 225), local);
});
