import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, reduceMove, legalMoves, square, safeSquare, applySkip, ranking, validateGame, rollDie } from '../src/logic.js';
const roll = (g, value) => reduceMove(g, g.turn, { type:'roll', value });
const pick = (g, token=0) => reduceMove(g, g.turn, { type:'pick', token });

test('2–4 players, quick default, full option, reject bad setup',()=>{
  assert.equal(newGame().players[0].length,2);
  assert.equal(newGame(4,{tokens:4}).players.length,4);
  for(const n of [0,1,5,2.5]) assert.throws(()=>newGame(n));
  assert.throws(()=>newGame(2,{tokens:3}));
  assert.throws(()=>newGame(2,{captureBonus:1}));
});
test('enter only on six; each token remains an explicit choice',()=>{
  let g=roll(newGame(),6);
  assert.equal(g.phase,'choose'); assert.deepEqual(legalMoves(g),[0,1]);
  g=pick(g,1); assert.deepEqual(g.players[0],[-1,0]); assert.equal(g.turn,0);
  const pass=roll(newGame(),5); assert.equal(pass.turn,1); assert.equal(pass.last.type,'noMove');
});
test('six grants another roll and ordinary move passes turn',()=>{
  let g=pick(roll(newGame(),6)); assert.equal(g.phase,'roll'); assert.equal(g.sixes,1);
  g=pick(roll(g,2)); assert.equal(g.turn,1); assert.equal(g.sixes,0); assert.equal(g.players[0][0],2);
});
test('third consecutive six forfeits before movement, previous moves remain',()=>{
  let g=pick(roll(newGame(),6)); g=pick(roll(g,6));
  const before=structuredClone(g.players); g=roll(g,6);
  assert.equal(g.turn,1); assert.equal(g.last.type,'forfeit'); assert.deepEqual(g.players,before); assert.equal(g.sixes,0);
});
test('three-sixes rule is optional; non-six resets the streak',()=>{
  let g=newGame(2,{threeSixes:false});
  for(let i=0;i<3;i++)g=pick(roll(g,6));
  assert.equal(g.turn,0); assert.equal(g.sixes,3); validateGame(g);
  g=roll(g,2); assert.equal(g.sixes,0);
});
function captureGame(options={}) { const g=newGame(2,options); g.players[0][0]=27; g.players[1][0]=3; return g; }
test('capture sends a lone opponent to yard and grants a bonus',()=>{
  const g=pick(roll(captureGame(),2));
  assert.equal(g.players[1][0],-1); assert.equal(g.last.captured,1); assert.equal(g.turn,0);
});
test('capture bonus can be disabled and a six plus capture gives only one extra roll',()=>{
  const g=pick(roll(captureGame({captureBonus:false}),2)); assert.equal(g.turn,1);
  const six=captureGame(); six.players[0][0]=23;
  const next=pick(roll(six,6)); assert.equal(next.turn,0); assert.equal(next.phase,'roll'); assert.equal(next.last.captured,1);
});
test('all four starts and four stars are safe, including inactive starts',()=>{
  for(const target of [0,8,13,21,26,34,39,47]) {
    assert.equal(safeSquare(target),true);
    const g=newGame(4);g.players[0][0]=(target-1+52)%52;g.players[1][0]=(target-13+52)%52;
    const next=pick(roll(g,1));assert.notEqual(next.players[1][0],-1);assert.equal(next.last.captured,0);
  }
});
test('pairs block landing on unsafe squares, passage is allowed, friendly stacking is allowed',()=>{
  const g=captureGame();g.players[1][1]=3;
  assert.equal(roll(g,2).last.type,'noMove');
  assert.deepEqual(legalMoves(roll(g,3)),[0]);
  g.players[0][1]=30; assert.deepEqual(legalMoves(roll(g,3)),[0,1]);
});
test('safe stacks can be shared by all players',()=>{
  const g=newGame(3);g.players[0][0]=7;g.players[1]=[47,47];
  const next=pick(roll(g,1));assert.equal(next.players[0][0],8);assert.deepEqual(next.players[1],[47,47]);
});
test('52 track squares, five private squares, exact home, no overshooting or moving home tokens',()=>{
  const g=newGame();g.players[0]=[51,57];
  assert.equal(pick(roll(g,1)).players[0][0],52);
  assert.equal(pick(roll(g,5)).players[0][0],56);
  assert.equal(pick(roll(g,6)).players[0][0],57);
  g.players[0][0]=56; assert.equal(roll(g,2).last.type,'noMove');
  assert.equal(square(g,0,52),null);assert.equal(square(g,1,0),26);
});
test('home lanes are private and cannot capture',()=>{
  const g=newGame(4);g.players[0][0]=51;g.players[1][0]=52;
  const next=pick(roll(g,1));assert.equal(next.last.captured,0);assert.equal(next.players[1][0],52);
});
test('blocked/no-move automatically passes even when roll is six',()=>{
  const g=newGame();g.players[0]=[55,56];g.sixes=1;
  const next=roll(g,6);assert.equal(next.turn,1);assert.equal(next.phase,'roll');assert.equal(next.sixes,0);
});
test('first all-home player wins and ranking counts tokens home',()=>{
  const g=newGame(4);g.players[0]=[56,57];g.players[1][0]=57;
  const next=pick(roll(g,1));assert.equal(next.winner,0);assert.equal(next.phase,'finished');
  assert.deepEqual(ranking(next).map(p=>p.home),[2,1,0,0]);validateGame(next);
  assert.throws(()=>roll(next,1));
});
test('engine rejects illegal actions and preserves the input',()=>{
  const g=newGame(), copy=structuredClone(g);
  assert.throws(()=>reduceMove(g,1,{type:'roll',value:6}));
  for(const value of [0,7,1.5,'6'])assert.throws(()=>roll(g,value));
  assert.throws(()=>pick(g));assert.throws(()=>reduceMove(g,0,{type:'other'}));
  const choose=roll(g,6);assert.throws(()=>pick(choose,9));assert.throws(()=>roll(choose,6));
  assert.deepEqual(g,copy);
});
test('skip clears a partially chosen die, bonus streak and advances exactly one seat',()=>{
  const g=roll(newGame(3),6),next=applySkip(g);
  assert.equal(next.turn,1);assert.equal(next.phase,'roll');assert.equal(next.die,null);assert.equal(next.sixes,0);validateGame(next);
});
test('saved and remote states reject corrupt positions, phases, events and winners',()=>{
  for(const mutate of [g=>g.players[0][0]=58,g=>g.turn=5,g=>g.phase='x',g=>g.die=9,g=>g.sixes=-1,g=>g.winner=0,g=>g.last={type:'moved',seat:0,captured:'<script>'},g=>g.phase='choose']) {
    const g=newGame();mutate(g);assert.throws(()=>validateGame(g));
  }
});
test('crypto die rejects the biased tail and covers 1–6',()=>{
  const values=[4294967295,4294967292,0,1,2,3,4,5], source={getRandomValues:a=>{a[0]=values.shift();return a;}};
  assert.deepEqual(Array.from({length:6},()=>rollDie(source)),[1,2,3,4,5,6]);assert.equal(values.length,0);
});
