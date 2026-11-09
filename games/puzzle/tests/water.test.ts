import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,apply,isWin,solve,solution,actions,type State} from '../src/puzzles/water/logic.ts';
import {levelIds} from '../src/puzzles/types.ts';
for(const [i,level]of levelIds.entries())test(`water ${level}: BFS optimum and immutable public replay`,()=>{
 assert.equal(solve(level),[6,7,11][i]);let s=initial(level),total=s.jugs.reduce((a,b)=>a+b,0);
 for(const a of solution(level)){const copy=structuredClone(s);Object.freeze(s.jugs);Object.freeze(s.caps);Object.freeze(s);const r=apply(s,a);assert.ok(r.ok);assert.deepEqual(s,copy);if(r.ok){assert.equal(r.state.steps,s.steps+1);s=r.state;assert.ok(s.jugs.every((v,j)=>v>=0&&v<=s.caps[j]));if(!s.taps)assert.equal(s.jugs.reduce((a,b)=>a+b,0),total);}}
 assert.equal(isWin(s),true);assert.equal(s.steps,[6,7,11][i]);assert.deepEqual(apply(s,{type:'select',jug:0}),{ok:false,reason:'frozen'});
});
for(const level of ['medium','hard'] as const)test(`water ${level} has no tap or drain`,()=>{
 const s=initial(level);assert.deepEqual(apply(s,{type:'fill',jug:1}),{ok:false,reason:'noTap'});assert.deepEqual(apply(s,{type:'empty',jug:0}),{ok:false,reason:'noDrain'});assert.equal(s.steps,0);
});
test('water errors do not count steps and select is reversible without a step',()=>{
 const s=initial('easy');for(const [a,reason]of [[{type:'pour',from:0,to:0},'same'],[{type:'pour',from:0,to:1},'emptyJug'],[{type:'empty',jug:0},'emptyJug'],[{type:'fill',jug:3},'unknown']] as const){const copy=structuredClone(s);assert.deepEqual(apply(s,a),{ok:false,reason});assert.deepEqual(s,copy);}
 const full={...s,jugs:[3,5]};assert.deepEqual(apply(full,{type:'fill',jug:0}),{ok:false,reason:'full'});assert.deepEqual(apply(full,{type:'pour',from:0,to:1}),{ok:false,reason:'targetFull'});assert.equal(full.steps,0);
 const selected=apply(s,{type:'select',jug:1});assert.ok(selected.ok);if(selected.ok){assert.equal(selected.state.steps,0);assert.equal(selected.state.selected,1);const off=apply(selected.state,{type:'select',jug:1});assert.ok(off.ok);if(off.ok)assert.equal(off.state.selected,null);}
});
test('every reachable easy goal has 4 L in the 5 L jug; medium requires exactly 4,4,0',()=>{
 const queue=[initial('easy')],seen=new Set(['0,0']);let goals=0;
 for(let q=0;q<queue.length;q++){const s=queue[q];if(isWin(s)){goals++;assert.equal(s.jugs[1],4);continue;}for(const a of actions(s)){const r=apply(s,a);if(r.ok){const key=r.state.jugs.join(',');if(!seen.has(key)){seen.add(key);queue.push(r.state);}}}}
 assert.ok(goals>0);assert.equal(isWin({...initial('medium'),jugs:[4,1,3]}),false);
 assert.equal(isWin({...initial('medium'),jugs:[4,4,0]}),true);
});
