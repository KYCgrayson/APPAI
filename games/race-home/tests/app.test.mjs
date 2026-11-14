import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeServer, memoryStorage } from './fake-server.mjs';
import { RoomsClient } from '../src/rooms.js';
import { SAVE_KEY } from '../src/controller.js';

test('dependency-free UI smoke: home → roll → choose → persist → reload → translate → new game',async t=>{
  // A tiny host surface, not a DOM implementation. It verifies the actual event
  // wiring and rendered strings without jsdom, a browser, or dependencies.
  const old=new Map(),replace=(name,value)=>{old.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});};
  t.after(()=>{for(const [name,descriptor]of old)descriptor?Object.defineProperty(globalThis,name,descriptor):delete globalThis[name];});
  const tasks=new Map();let next=0,die=6,href='http://localhost:5182/?lang=en';
  replace('setTimeout',(fn,ms)=>{tasks.set(++next,{fn,ms});return next;});replace('clearTimeout',id=>tasks.delete(id));
  replace('localStorage',memoryStorage());replace('navigator',{languages:['en']});replace('location',{get href(){return href;}});
  replace('history',{replaceState:(_a,_b,url)=>href=String(url)});replace('crypto',{getRandomValues:a=>{a[0]=die-1;return a;}});
  replace('window',{addEventListener(){},scrollTo(){}});
  const listeners={},app={innerHTML:'',addEventListener:(name,fn)=>listeners[name]=fn,querySelectorAll:()=>[]},live={textContent:''};
  replace('document',{querySelector:id=>id==='#app'?app:live,documentElement:{dataset:{}},activeElement:{},getElementById:()=>null,addEventListener(){},hidden:false});
  await import('../src/app.js?first');
  const click=async(action,token)=>listeners.click({detail:1,target:{closest:()=>({disabled:false,dataset:{action,token}})}});
  const change=async(id,value,checked)=>listeners.change({target:{id,value,checked}});
  assert.match(app.innerHTML,/data-action="start"/);assert.match(app.innerHTML,/href="\/games"/);
  await click('start');assert.match(app.innerHTML,/aria-label="Race board/);assert.match(live.textContent,/Player 1/);
  const rolling=click('roll');assert.match(app.innerHTML,/die rolling/);
  const animation=[...tasks].find(([,job])=>job.ms===650);assert.ok(animation);tasks.delete(animation[0]);animation[1].fn();await rolling;
  assert.equal(JSON.parse(localStorage.getItem(SAVE_KEY)).game.phase,'choose');assert.match(app.innerHTML,/Choose a token/);
  await click('pick','1');assert.deepEqual(JSON.parse(localStorage.getItem(SAVE_KEY)).game.players[0],[-1,0]);
  await click('home');assert.match(app.innerHTML,/data-action="resume"/);
  await click('resume');assert.match(app.innerHTML,/data-action="roll"/);
  await import('../src/app.js?reload');assert.match(app.innerHTML,/aria-label="Race board/);assert.equal(JSON.parse(localStorage.getItem(SAVE_KEY)).game.players[0][1],0);
  await change('theme','dark');assert.equal(document.documentElement.dataset.theme,'dark');
  await change('language','hi');assert.match(document.title,/[\u0900-\u097f]/);assert.equal(document.documentElement.lang,'hi');assert.match(href,/lang=hi/);assert.doesNotMatch(app.innerHTML,/Choose a token|Back to home|Roll the die/);
  await click('new');assert.deepEqual(JSON.parse(localStorage.getItem(SAVE_KEY)).game.players[0],[-1,-1]);
  await click('home');await change('seat-0','computer');assert.equal(JSON.parse(localStorage.getItem(SAVE_KEY)).preferences.seats[0],'human');
  const server=new FakeServer();replace('fetch',server.fetch);
  await click('rooms');await change('count','3');await click('create');
  assert.match(app.innerHTML,/ABC234/);assert.match(href,/room=ABC234/);
  const remote=new RoomsClient({fetcher:server.fetch});await remote.join('ABC234');await remote.join('ABC234');
  // Advance one presence poll; the host UI should leave the lobby automatically.
  for(let i=0;i<8;i++)await Promise.resolve();
  const poll=[...tasks].find(([,job])=>job.ms===1200);assert.ok(poll);tasks.delete(poll[0]);await poll[1].fn();
  assert.match(app.innerHTML,/aria-label="खेल का बोर्ड/);
  assert.match(live.textContent,/खिलाड़ी 1/);
  // Returning to a saved local game must not turn the room into local play.
  await click('home');await click('local');await click('resume');
  assert.doesNotMatch(href,/room=/);assert.equal(JSON.parse(localStorage.getItem(SAVE_KEY)).game.players.length,2);
});
