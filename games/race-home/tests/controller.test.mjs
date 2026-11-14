import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPreferences, readSave, writeSave, SAVE_KEY, automaticAction, positionKey } from '../src/controller.js';
import { newGame, reduceMove } from '../src/logic.js';
import { TRACK, LANES, boardSVG } from '../src/board.js';
const memory=()=>{const map=new Map();return{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
test('persist settings, partial die choice and room reference under versioned key',()=>{
  const store=memory(),p=defaultPreferences();p.theme='dark';p.sound=true;
  const g=reduceMove(newGame(),0,{type:'roll',value:6});
  assert.equal(writeSave(store,p,g,'ABC234'),true);assert.ok(store.getItem(SAVE_KEY));
  const restored=readSave(store);assert.deepEqual(restored.preferences,p);assert.deepEqual(restored.game,g);assert.equal(restored.roomCode,'ABC234');
});
test('corrupt or unavailable storage recovers safe settings',()=>{
  const store=memory();store.setItem(SAVE_KEY,'{');assert.deepEqual(readSave(store).preferences,defaultPreferences());
  store.setItem(SAVE_KEY,JSON.stringify({v:0}));assert.equal(readSave(store).game,undefined);
  const p=defaultPreferences();delete p.rules;writeSave(store,p);assert.deepEqual(readSave(store).preferences,defaultPreferences());
  p.rules={tokens:2};writeSave(store,p);assert.deepEqual(readSave(store).preferences,defaultPreferences());
  const broken={getItem(){throw Error();},setItem(){throw Error();}};assert.equal(writeSave(broken,defaultPreferences()),false);assert.equal(readSave(broken).preferences.count,2);
});
test('at least one human is required in saved setup',()=>{
  const p=defaultPreferences();p.seats.fill('computer');const store=memory();writeSave(store,p);assert.equal(readSave(store).preferences.seats[0],'human');
});
test('only one legal choice still waits by default, with explicit auto-move opt-in',()=>{
  const p=defaultPreferences();let g=newGame();g.players[0]=[0,57];g=reduceMove(g,0,{type:'roll',value:1});
  assert.equal(automaticAction(g,p),null);g.settings.autoMove=true;assert.equal(automaticAction(g,p),'pick');
  assert.equal(automaticAction(g,p,true),null);p.seats[0]='computer';assert.equal(automaticAction(g,p),'pick');
});
test('board geometry contains 52 unique cross-track squares and four five-square lanes',()=>{
  assert.equal(TRACK.length,52);assert.equal(new Set(TRACK.map(p=>p.join())).size,52);assert.ok(TRACK.every(([x,y])=>x>=0&&x<15&&y>=0&&y<15));
  assert.ok(LANES.every(l=>l.length===5));assert.equal(new Set(LANES.flat().map(p=>p.join())).size,20);
  assert.ok(!LANES.flat().some(p=>TRACK.some(t=>t.join()===p.join())));
  for(const count of [2,3,4])assert.match(boardSVG(newGame(count)),/^<svg.*<\/svg>$/);
});
test('token locations map to localized UI keys',()=>{
  assert.deepEqual([-1,0,51,52,56,57].map(positionKey),['yard','step','step','lane','lane','homePosition']);
});
