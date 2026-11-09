import test from 'node:test';
import assert from 'node:assert/strict';
import {registry} from '../src/puzzles/registry.ts';
import {starsFor,levelIds} from '../src/puzzles/types.ts';
import {resolveRoute} from '../src/routing.ts';
import {encodeChallenge,decodeChallenge,migrateRun,rank,type Run} from '../src/share/index.ts';
for(const def of Object.values(registry))test(`registry ${def.id}: complete levels, optimum, shared star thresholds and replay`,()=>{
 assert.deepEqual(Object.keys(def.levels),levelIds);for(const id of levelIds){const l=def.levels[id];assert.equal(def.logic.solve(id),l.optimal);assert.ok(l.twoStar>=l.optimal);if(def.id==='bridge')assert.ok(l.limit!>=l.twoStar);
 assert.equal(starsFor(l.optimal,l),3);assert.equal(starsFor(l.twoStar,l),2);assert.equal(starsFor(l.twoStar+1,l),1);
 let s=def.logic.initial(id);for(const a of def.logic.solution(id)){const r=def.logic.apply(s,a);assert.ok(r.ok);if(r.ok)s=r.state;}assert.equal(def.logic.isWin(s),true);assert.equal(def.logic.score(s),l.optimal);
 }
});
const route=(s:string)=>resolveRoute(new URLSearchParams(s),registry);
test('routing: collection, levels, direct games and legacy challenges',()=>{
 assert.equal(route('').screen,'home');assert.equal(route('level=easy').screen,'home');
 for(const game of ['river','bridge','water']){assert.equal(route(`game=${game}`).screen,'levels');const r=route(`game=${game}&level=medium`);assert.equal(r.screen,'game');assert.equal(r.level,'medium');assert.equal(r.game,game);}
 const legacy=route('challenge=easy&c=7&t=1');assert.equal(legacy.game,'river');assert.equal(legacy.screen,'levels');assert.equal(legacy.challenge?.score,7);
 const challenge=route('game=bridge&challenge=medium&c=29&t=90&n=Amy');assert.equal(challenge.screen,'levels');assert.equal(challenge.challenge?.score,29);assert.equal(challenge.challenge?.name,'Amy');
 assert.equal(route('game=bridge&challenge=medium&c=28&t=1').challenge,null);
 for(const s of ['game=nope','game=__proto__','game=constructor','game=bridge&game=water'])assert.equal(route(s).screen,'home');
 assert.equal(route('game=water&level=__proto__').screen,'levels');
});
test('challenge links always carry a puzzle and validate each optimum',()=>{
 for(const d of Object.values(registry))for(const level of levelIds){const p=new URLSearchParams(encodeChallenge({game:d.id,level,score:d.levels[level].optimal,ms:1000}));assert.equal(p.get('game'),d.id);assert.ok(decodeChallenge(p));p.set('c',String(d.levels[level].optimal-1));assert.equal(decodeChallenge(p),null);p.set('c','1000');assert.equal(decodeChallenge(p),null);}
 assert.equal(new URLSearchParams(encodeChallenge({level:'easy',crossings:7,ms:1000})).get('game'),'river');
});
test('canonical runs and legacy crossings migration, rank filters by game and level',()=>{
 const old={level:'easy',crossings:7,ms:42000,at:20};const migrated=migrateRun(old);assert.deepEqual(migrated,{game:'river',level:'easy',score:7,ms:42000,at:20});assert.deepEqual(old,{level:'easy',crossings:7,ms:42000,at:20});
 assert.equal(migrateRun(old,'bridge'),null);assert.equal(migrateRun({...old,game:'nope'}),null);
 const fresh:Run={game:'bridge',level:'easy',score:17,ms:42000,at:20},same={...fresh,ms:50000};
 const list:Run[]=[migrated!,same,{...fresh,level:'medium',score:29},{...fresh,game:'water',score:6}];const ranked=rank(list,fresh);assert.deepEqual(ranked.runs,[fresh,same]);assert.equal(ranked.place,1);assert.equal(list.length,4);assert.deepEqual(migrateRun(fresh),fresh);
});

test('bridge challenges and stored runs enforce each lantern limit, inclusively',()=>{
 for(const level of levelIds){
  const limit=registry.bridge.levels[level].limit!;
  const params=new URLSearchParams(encodeChallenge({game:'bridge',level,score:limit,ms:1000}));
  const run={game:'bridge' as const,level,score:limit,ms:1000,at:1};
  assert.ok(decodeChallenge(params));assert.ok(migrateRun(run));
  params.set('c',String(limit+1));assert.equal(decodeChallenge(params),null);assert.equal(migrateRun({...run,score:limit+1}),null);
 }
 assert.ok(decodeChallenge(new URLSearchParams('game=water&challenge=easy&c=999&t=1')));
});

test('challenge params coexist with the active level so reload resumes the challenge game',()=>{
 const r=route('game=bridge&level=easy&challenge=easy&c=19&t=90&n=Amy');
 assert.equal(r.screen,'game');assert.equal(r.level,'easy');assert.equal(r.challenge?.score,19);
 assert.equal(route('game=bridge&challenge=easy&c=19&t=90').screen,'levels');
});
