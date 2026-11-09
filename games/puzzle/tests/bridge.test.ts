import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,apply,walk,toggle,isWin,levels,solve,solution,ids,type State} from '../src/puzzles/bridge/logic.ts';
import {levelIds,type LevelId} from '../src/puzzles/types.ts';
const deepFreeze=(s:State)=>{Object.freeze(s.side);Object.freeze(s.selected);return Object.freeze(s);};
function trip(s:State,selected:string[]){const r=walk({...s,selected});assert.equal(r.ok,true);if(!r.ok)throw Error(r.reason);return r.state;}
for(const [i,level]of levelIds.entries()){
 test(`bridge ${level}: Dijkstra optimum and replay without timeout`,()=>{
  const optimal=[17,29,28][i];assert.equal(solve(level),optimal);assert.equal(levels[level].optimal,optimal);
  let s=initial(level);for(const a of solution(level)){const before=structuredClone(s),r=apply(deepFreeze(s),a);assert.equal(r.ok,true);assert.deepEqual(s,before);if(r.ok){assert.equal(r.state.failure,undefined);s=r.state;}}
  assert.equal(isWin(s),true);assert.equal(s.minutes,optimal);assert.equal(apply(s,{type:'toggle',id:'1'}).ok,false);assert.deepEqual(walk(s),{ok:false,reason:'frozen'});
 });
 test(`bridge ${level}: fastest escort takes ${[19,32,34][i]} minutes`,()=>{
  // These raw route costs intentionally ignore the lantern limit: medium's naive plan still fits it.
  const times=levels[level].times;let s=initial(level);
  times.slice(1).forEach((n,j)=>{s=trip(s,['1',String(n)]);if(j<times.length-2)s=trip(s,['1']);});
  assert.equal(s.minutes,[19,32,34][i]);assert.equal(isWin(s),true);
 });
}
test('bridge rejects empty, remote, unknown and capacity without mutation',()=>{
 const s=deepFreeze(initial('easy')),copy=structuredClone(s);assert.deepEqual(walk(s),{ok:false,reason:'empty'});assert.deepEqual(toggle(s,'nope'),{ok:false,reason:'unknown'});
 let r=toggle(s,'1');assert.ok(r.ok);if(!r.ok)return;const selected=r.state;r=toggle(selected,'2');assert.ok(r.ok);if(!r.ok)return;
 assert.deepEqual(toggle(r.state,'5'),{ok:false,reason:'capacity'});const across=trip(r.state,['1','2']);assert.deepEqual(toggle(across,'5'),{ok:false,reason:'remote'});assert.deepEqual(s,copy);
 const deselect=toggle(selected,'1');assert.ok(deselect.ok);if(deselect.ok)assert.deepEqual(deselect.state.selected,[]);
});
test('bridge exact limit is allowed, timeout freezes all input and keeps undo state intact',()=>{
 let s=initial('easy');s={...s,minutes:21,selected:['1']};const atLimit=walk(s);assert.ok(atLimit.ok);if(!atLimit.ok)return;
 assert.equal(atLimit.state.minutes,22);assert.equal(atLimit.state.failure,undefined);
 const before={...atLimit.state,selected:['1']};const failed=walk(deepFreeze(before));assert.ok(failed.ok);if(!failed.ok)return;
 assert.deepEqual(failed.state.failure,{reason:'timeout'});assert.equal(isWin(failed.state),false);assert.deepEqual(walk(failed.state),{ok:false,reason:'frozen'});assert.deepEqual(toggle(failed.state,'1'),{ok:false,reason:'frozen'});assert.equal(before.failure,undefined);
});
