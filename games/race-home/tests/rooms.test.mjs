import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomsClient, OnlineSession, RoomError, checkpoint, restoreRoom, processRoom, normalizeCode, pollDelay } from '../src/rooms.js';
import { newGame, reduceMove } from '../src/logic.js';
import { chooseToken } from '../src/ai.js';
import { FakeServer, memoryStorage } from './fake-server.mjs';
const makeClient=(server,options={})=>new RoomsClient({fetcher:server.fetch,storage:memoryStorage(),...options});
async function setup(n=2,slots=n) {
  const server=new FakeServer(),clients=Array.from({length:n},()=>makeClient(server));
  const first=await clients[0].create(newGame(slots)),data=[first];
  for(let i=1;i<n;i++)data.push(await clients[i].join(first.code));
  const sessions=data.map((d,i)=>new OnlineSession(clients[i],d));sessions.forEach(s=>s.stopped=false);
  await Promise.all(sessions.map(s=>s.poll()));return{server,clients,sessions,code:first.code};
}
test('create/join normalize codes, use credentials for create and store tokens per origin and room',async()=>{
  const s=new FakeServer(),storage=memoryStorage(),c=makeClient(s,{storage});const first=await c.create(newGame(3));
  assert.equal(s.calls[0].body.game,'race-home');assert.equal(s.calls[0].body.seats,3);assert.equal(s.calls[0].options.credentials,'include');
  assert.equal(c.saved(first.code).token,first.token);assert.ok(c.tokenKey(first.code).startsWith('race-home:v1:room:https://appai.info/'));
  const second=await makeClient(s).join(' ab-c2 34 ');assert.equal(second.seat,1);
  assert.equal(normalizeCode('ab-c234'),'ABC234');assert.throws(()=>normalizeCode('123456'),RoomError);
  assert.equal(new RoomsClient({base:'https://example.test'}).saved(first.code),null);
  assert.ok(s.calls.every(call=>!call.url.includes('t0')&&!call.url.includes('t1')));
});
test('host starts with joined seats and clients resize the initial board',async()=>{
  const {sessions}=await setup(2,4);await sessions[0].start();await sessions[1].poll();
  assert.equal(sessions[0].game.players.length,2);assert.equal(sessions[1].game.players.length,2);
  await sessions[0].send({type:'roll',value:6});await sessions[1].poll();assert.deepEqual(sessions[0].game,sessions[1].game);
});
test('start needs two players; non-host and full-room errors are handled',async()=>{
  const server=new FakeServer(),c=makeClient(server),d=await c.create(newGame());
  await assert.rejects(c.start(d.code,d.token),e=>e.error==='room_not_ready');
  const d1=await makeClient(server).join(d.code);
  await assert.rejects(c.start(d.code,d1.token),e=>e.error==='not_host');
  await assert.rejects(makeClient(server).join(d.code),e=>e.error==='room_full');
});
test('every received roll and choice is replayed with the pure engine',async()=>{
  const {sessions}=await setup();const [a,b]=sessions;
  await a.send({type:'roll',value:6});await a.send({type:'pick',token:1});await a.send({type:'roll',value:3});await a.send({type:'pick',token:1});
  await b.poll();assert.deepEqual(a.game,b.game);assert.equal(b.game.players[0][1],3);assert.equal(b.game.turn,1);
  assert.equal(b.room.moves.length,4);
});
test('stale action refreshes on version_conflict without rerolling or repeating a choice',async()=>{
  const {clients,sessions}=await setup();const a=sessions[0];
  const other=new OnlineSession(clients[0],{code:a.code,token:a.token,seat:0,room:a.room});
  await a.send({type:'roll',value:6});
  await assert.rejects(other.send({type:'roll',value:2}),e=>e.error==='version_conflict');
  assert.equal(other.game.die,6);assert.equal(other.game.phase,'choose');assert.deepEqual(other.game,a.game);
});
test('not_your_turn carries latest room and invalid actions are blocked locally',async()=>{
  const {clients,sessions}=await setup();const [a,b]=sessions;
  await assert.rejects(b.send({type:'roll',value:6}),/illegal move/);
  await assert.rejects(clients[1].send(b.code,b.token,{version:b.room.version,move:{type:'roll',value:6}}),e=>e.error==='not_your_turn'&&Boolean(e.room));
  await a.send({type:'roll',value:2});await b.poll();assert.equal(b.game.turn,1);
});
test('429 honors Retry-After before a single retry, including HTTP dates',async()=>{
  const server=new FakeServer(),waits=[],c=makeClient(server,{sleep:async ms=>waits.push(ms)});
  server.fail(429,'rate_limited',{'Retry-After':'2'});await c.create(newGame());assert.deepEqual(waits,[2000]);
  server.fail(429,'rate_limited',{'Retry-After':new Date(Date.now()+3000).toUTCString()});await c.create(newGame());assert.ok(waits[1]>1000&&waits[1]<=3000);
  server.fail(429,'rate_limited');server.fail(429,'rate_limited');await assert.rejects(c.create(newGame()),e=>e.error==='rate_limited');
});
test('create auth/network errors are typed, 404 clears the stored seat token',async()=>{
  const server=new FakeServer(),c=makeClient(server);server.fail(401,'login_required');await assert.rejects(c.create(newGame()),e=>e.status===401);
  server.fail(403,'origin_not_allowed');await assert.rejects(c.create(newGame()),e=>e.status===403);
  const offline=new RoomsClient({fetcher:async()=>{throw Error('offline');}});await assert.rejects(offline.create(newGame()),e=>e.error==='unavailable');
  const d=await c.create(newGame());server.rooms.delete(d.code);await assert.rejects(c.poll(d.code,d.token),e=>e.error==='room_not_found');assert.equal(c.saved(d.code),null);
});
test('skip after 120 seconds handles seat zero (numeric skipped: 0) and resets pending dice',async()=>{
  const {server,sessions}=await setup(3);const [a,b,c]=sessions;
  await a.send({type:'roll',value:6});await b.poll();await assert.rejects(b.skip(),e=>e.error==='not_your_turn');
  server.now=120000;await b.poll();await b.skip();await a.poll();await c.poll();
  for(const s of sessions) { assert.equal(s.game.turn,1);assert.equal(s.game.phase,'roll');assert.equal(s.game.die,null);assert.deepEqual(s.game,b.game); }
  assert.equal(b.room.moves.at(-1).skipped,0);
  const returning=new OnlineSession(b.client,{code:b.code,token:b.token,seat:1,room:b.room});assert.deepEqual(returning.game,b.game);
});
test('reload reconstructs trailing skips and a later normal action checkpoint',async()=>{
  const {server,sessions}=await setup();const [a,b]=sessions;server.now=120000;await b.poll();await b.skip();
  await b.send({type:'roll',value:6});await b.send({type:'pick',token:0});await a.poll();
  assert.deepEqual(restoreRoom(b.room),b.game);assert.deepEqual(a.game,b.game);
});
test('returning after more than twenty consecutive skips preserves tokens and clears a pending choice',async()=>{
  const {server,sessions}=await setup(3);const first=sessions[0];
  await first.send({type:'roll',value:6});await first.send({type:'pick',token:0});await first.send({type:'roll',value:6});
  for(let i=0;i<25;i++) {
    server.now+=120001;
    const room=server.rooms.get(first.code),other=sessions[(room.turn+1)%3];
    await other.poll();await other.skip();
  }
  const room=server.public(server.rooms.get(first.code)),restored=restoreRoom(room);
  assert.equal(restored.players[0][0],0);assert.equal(restored.phase,'roll');assert.equal(restored.die,null);assert.equal(restored.turn,room.turn);
});
test('invalid peer action is rejected even when a forged checkpoint looks valid',async()=>{
  const {sessions}=await setup();const a=sessions[0],room=structuredClone(a.room);
  const action={type:'roll',value:6},valid=reduceMove(a.game,0,action);
  room.version++;room.state=checkpoint(valid,room.version,a.game,action,0);
  room.moves=[{version:room.version,seat:0,move:{type:'roll',value:9}}];
  assert.throws(()=>processRoom(a.room,a.game,room),/history|illegal roll/);assert.throws(()=>restoreRoom(room),/history/);assert.equal(a.game.phase,'roll');
  room.state.game.players[0][0]=57;assert.throws(()=>restoreRoom(room));
});
test('late poll cannot roll back a more recent send',async()=>{
  const {server,clients,sessions}=await setup();const a=sessions[0];
  let release;const stale=server.response(200,{changed:true,room:structuredClone(a.room)});
  clients[0].fetcher=async(url,options)=>options.method==='GET'?new Promise(r=>release=()=>r(stale)):server.fetch(url,options);
  const poll=a.poll();await a.send({type:'roll',value:6});release();await poll;
  assert.equal(a.game.phase,'choose');assert.equal(a.game.die,6);
});
test('visible/hidden polling follows required intervals',()=>{
  assert.equal(pollDelay(false),1200);assert.equal(pollDelay(true),15000);
});
test('three-seat room completes an entire game with all clients agreeing and supports a >20-move reconnect gap',async()=>{
  const {server,clients,sessions}=await setup(3);let seed=74,actions=0;
  const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return 1+Math.floor(seed/4294967296*6);};
  const dormant=new OnlineSession(clients[0],{code:sessions[0].code,token:sessions[0].token,seat:0,room:structuredClone(sessions[0].room)});dormant.stopped=false;
  while(sessions[0].game.phase!=='finished'&&actions++<15000) {
    const game=sessions[0].game,active=sessions[game.turn];
    const move=game.phase==='roll'?{type:'roll',value:rng()}:{type:'pick',token:chooseToken(game)};
    await active.send(move);await Promise.all(sessions.filter(s=>s!==active).map(s=>s.poll()));
    for(const s of sessions)assert.deepEqual(s.game,active.game);
    if(actions===60) { await dormant.poll();assert.deepEqual(dormant.game,active.game); }
  }
  assert.equal(sessions[0].game.phase,'finished');assert.equal(sessions[0].room.status,'finished');
  assert.equal(server.rooms.get(sessions[0].code).moves.length,20);
  for(const s of sessions)assert.deepEqual(restoreRoom(s.room),s.game);
});
