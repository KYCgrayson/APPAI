import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, reduceMove, legalMoves, validateGame } from '../src/logic.js';
import { chooseToken } from '../src/ai.js';
export function random(seed=74) { return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}; }
test('AI prefers capture over entering, finishing and progress',()=>{
  let g=newGame(4,{tokens:4});g.players[0]=[23,51,-1,40];g.players[1][0]=16;
  g=reduceMove(g,0,{type:'roll',value:6});assert.equal(chooseToken(g),0);
});
test('AI prefers getting home, then entering the yard',()=>{
  let g=newGame(3,{tokens:4});g.players[0]=[51,-1,20,0];
  g=reduceMove(g,0,{type:'roll',value:6});assert.equal(chooseToken(g),0);
  g.players[0][0]=40;assert.equal(chooseToken(g),1);
});
test('AI prefers escaping danger before simple progress',()=>{
  let g=newGame(4);g.players[0]=[10,40];g.players[1][0]=47; // opponent is at square 8
  g=reduceMove(g,0,{type:'roll',value:5});assert.equal(chooseToken(g),0);
});
test('AI returns null when there is no choice and uses the furthest token on a safe tie',()=>{
  assert.equal(chooseToken(newGame()),null);
  let g=newGame();g.players[0]=[1,30];g=reduceMove(g,0,{type:'roll',value:2});assert.equal(chooseToken(g),1);
});
test('32 complete four-computer games terminate, quick and full, with valid moves',()=>{
  for(let seed=1;seed<=32;seed++) {
    const rng=random(seed);let g=newGame(4,{tokens:seed%2?2:4,threeSixes:seed%3!==0,captureBonus:seed%4!==0});let actions=0;
    while(g.phase!=='finished' && actions++<20000) {
      const move=g.phase==='roll'?{type:'roll',value:1+Math.floor(rng()*6)}:{type:'pick',token:chooseToken(g)};
      if(move.type==='pick')assert.ok(legalMoves(g).includes(move.token));
      g=reduceMove(g,g.turn,move);
    }
    assert.equal(g.phase,'finished',`seed ${seed} did not end`);validateGame(g);
  }
});
test('heuristic has ample margin below the 300ms action budget',()=>{
  let g=newGame(4,{tokens:4});g.players=g.players.map(()=>[10,20,30,40]);g=reduceMove(g,0,{type:'roll',value:4});
  const start=performance.now();for(let i=0;i<1000;i++)chooseToken(g);
  assert.ok((performance.now()-start)/1000<30);
});
