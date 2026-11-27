import { newGame, reduceMove, legalMoves, ranking, rollDie, SYMBOLS } from './logic.js';
import { chooseToken } from './ai.js';
import { chooseLocale, locales, localeNames, translate } from './i18n.js';
import { RoomsClient, OnlineSession, RoomError, normalizeCode } from './rooms.js';
import { readSave, writeSave, automaticAction, positionKey } from './controller.js';
import { boardSVG } from './board.js';

const app = document.querySelector('#app'), live = document.querySelector('#announce');
let storage;
try { storage = localStorage; } catch { storage = { getItem: () => null, setItem: () => {} }; }
const saved = readSave(storage);
let preferences = saved.preferences, game = saved.game, localGame = saved.game, roomCode = saved.roomCode;
let lang = chooseLocale(new URL(location.href).searchParams.get('lang'), navigator.languages || [navigator.language]);
let screen = game ? 'play' : 'home', mode = 'local', session, busy = false, rolling = false, error = '', signIn = false, timer, generation = 0;
let codeInput = new URL(location.href).searchParams.get('room') || '', roomSignature = '';
let keyboardGameFocus = false;
const client = new RoomsClient({ storage });
const t = (key, params) => translate(lang, key, params);
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const player = seat => `${SYMBOLS[seat]} ${t('player', { n: seat+1 })}`;
const btn = (action, label, attrs = '') => `<button type="button" data-action="${action}" ${attrs}>${label}</button>`;
const select = (id, label, options, value) => `<label class="field" for="${id}"><span>${label}</span><select id="${id}">${options.map(([v,l]) => `<option value="${v}"${String(value)===String(v)?' selected':''}>${l}</option>`).join('')}</select></label>`;
function persist() { if(!session && mode==='local') localGame=game; writeSave(storage, preferences, localGame, roomCode); }
function setTheme() { document.documentElement.dataset.theme = preferences.theme; }
function setLanguage() { document.documentElement.lang = lang; document.title = t('title'); }
function settingsHeader() {
  return `<div class="preferences">${select('language',t('language'),locales.map(l=>[l,localeNames[l]]),lang)}${select('theme',t('theme'),['auto','light','dark'].map(k=>[k,t(k)]),preferences.theme)}</div>`;
}
function rules() { return `<details class="rules"><summary>${t('rules')}</summary>${[1,2,3,4].map(n=>`<p>${t('rule'+n)}</p>`).join('')}</details>`; }
function homeHTML() {
  return `<a class="back" href="/games">${t('games')}</a><header><div class="brand-art" aria-hidden="true"><i>●</i><i>■</i><i>▲</i><i>★</i></div><h1>${t('title')}</h1><p class="subtitle">${t('tagline')}</p></header>
    ${settingsHeader()}<div class="mode-switch" role="group" aria-label="${t('settings')}">${btn('local',t('local'),`aria-pressed="${mode==='local'}"`)}${btn('rooms',t('rooms'),`aria-pressed="${mode==='rooms'}"`)}</div>
    <section class="panel"><div class="setup-grid">${select('count',t('players'),[2,3,4].map(n=>[n,n]),preferences.count)}${select('length',t('length'),[[2,t('quick')],[4,t('full')]],preferences.rules.tokens)}</div>
    ${mode==='local'?`<div class="seat-setup">${Array.from({length:preferences.count},(_,seat)=>`<div class="seat-field p${seat}"><span class="seat-symbol" aria-hidden="true">${SYMBOLS[seat]}</span>${select('seat-'+seat,t('player',{n:seat+1}),[['human',t('human')],['computer',t('computer')]],preferences.seats[seat])}</div>`).join('')}</div>`:`<p>${t('roomHelp')}</p>`}
    <details class="settings"><summary>${t('settings')}</summary>${['threeSixes','captureBonus','autoMove'].map(k=>`<label class="check"><input id="${k}" type="checkbox"${preferences.rules[k]?' checked':''}>${t(k)}</label>`).join('')}<label class="check"><input id="sound" type="checkbox"${preferences.sound?' checked':''}>${t('sound')}</label></details>
    ${mode==='local'?`<div class="actions">${btn('start',t('start'),'class="primary"')}${localGame?btn('resume',t('resume')):''}</div>`:`<div class="actions">${btn('create',t('create'),'class="primary"')}</div><form id="join-form"><label class="field" for="code"><span>${t('roomCode')}</span><input id="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="16" value="${esc(codeInput)}" placeholder="ABC234"></label><button type="submit">${t('join')}</button></form>${roomCode?btn('resume-room',t('resume')):''}`}</section>${rules()}`;
}
function notice() {
  if (!game?.last) return '';
  const e = game.last, who = player(e.seat);
  if (e.type==='rolled') return t('rolled',{player:who,n:e.value});
  if (e.type==='forfeit'||e.type==='noMove'||e.type==='skipped') return t(e.type==='skipped'?'skipped':e.type,{player:who});
  return `${e.captured?t('captured',{player:who,n:e.captured}):t('moved',{player:who})} ${e.bonus?t('extra'):''}`;
}
function position(p) { return t(positionKey(p),{n:p<52?p+1:p-51}); }
function roster() {
  return `<div class="roster">${game.players.map((tokens,seat)=>`<details class="player-card p${seat}${seat===game.turn?' current':''}"><summary><span>${esc(player(seat))}${session?.seat===seat?` · ${t('you')}`:''}</span><strong>${t('tokensHome',{n:tokens.filter(p=>p===57).length,total:tokens.length})}</strong></summary><ul>${tokens.map((p,i)=>`<li>${t('token',{n:i+1})}: ${position(p)}</li>`).join('')}</ul></details>`).join('')}</div>`;
}
function canAct() { return !busy && (!session || session.room.status==='playing' && session.seat===game.turn) && (session || preferences.seats[game.turn]==='human'); }
function dieHTML(enabled) {
  const value = game.die || 0;
  const patterns = { 0:[],1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9] };
  return `<button id="roll" type="button" data-action="roll" class="die${rolling?' rolling':''}" aria-label="${t('roll')}${value?' · '+value:''}"${enabled?'':' disabled'}><span class="pips" aria-hidden="true">${Array.from({length:9},(_,i)=>`<i${patterns[value].includes(i+1)?' class="pip"':''}></i>`).join('')}</span>${!value?'<span aria-hidden="true">?</span>':''}</button>`;
}
function roomBar() {
  if (!session) return '';
  const idle = session.room.seats.find(p=>p.seat===session.room.turn);
  return `<div class="room-bar"><strong>${t('roomTitle',{code:esc(session.code)})}</strong><span>${t('you')}: ${esc(player(session.seat))}</span>${session.room.status==='playing' && game.turn!==session.seat && idle?.idleSeconds>=120?btn('skip',t('skip')):''}</div>`;
}
function waitingHTML() {
  return `${settingsHeader()}${roomBar()}<section class="panel"><h1>${t('waiting')}</h1><ul class="presence">${session.room.seats.map(s=>`<li><span>${esc(player(s.seat))}</span><span>${t(s.joined?(s.online?'online':'offline'):'waiting')}</span></li>`).join('')}</ul>${session.seat===0?btn('start-room',t('startRoom'),`class="primary"${session.room.seats.filter(s=>s.joined).length<2?' disabled':''}`):''}<p>${t('roomHelp')}</p></section>${btn('home',t('home'))}${rules()}`;
}
function playHTML() {
  const available = legalMoves(game), active = canAct();
  const status = session ? (busy?t('connecting'):game.turn!==session.seat?t('notTurn'):'') : preferences.seats[game.turn]==='computer'?t('thinking'):'';
  return `${settingsHeader()}${roomBar()}<header class="turn-header p${game.turn}"><h1>${t('turn',{player:esc(player(game.turn))})}</h1><p>${notice() || t('roll')}</p></header><div class="play-layout"><div class="board" role="img" aria-label="${t('boardLabel')}">${boardSVG(game)}</div><section class="play-controls panel"><div class="roll-area">${dieHTML(active&&game.phase==='roll')}<div><strong>${game.phase==='choose'?t('choose'):t('roll')}</strong><p>${status}</p></div></div><p class="choice-help">${t('choiceHelp')}</p><div class="token-choices">${game.players[game.turn].map((p,i)=>btn('pick',`<span class="token-symbol">${SYMBOLS[game.turn]}</span><strong>${t('token',{n:i+1})}</strong><small>${position(p)}</small>`,`id="token-${i}" data-token="${i}" class="token-choice p${game.turn}${available.includes(i)?' legal':''}"${active&&available.includes(i)?'':' disabled'}`)).join('')}</div>${roster()}</section></div><div class="actions">${!session?btn('new',t('newGame')):''}${btn('home',t('home'))}</div>${rules()}`;
}
function endHTML() {
  return `${settingsHeader()}${roomBar()}<section class="panel end"><div class="winner-art p${game.winner}" aria-hidden="true">${SYMBOLS[game.winner]}</div><h1>${t('winner',{player:esc(player(game.winner))})}</h1><h2>${t('ranking')}</h2><ol class="ranking">${ranking(game).map(p=>`<li class="p${p.seat}"><span>${esc(player(p.seat))}</span><strong>${t('tokensHome',{n:p.home,total:game.settings.tokens})}</strong></li>`).join('')}</ol><div class="actions">${btn(session?'home':'new',t('again'),'class="primary"')}${btn('home',t('home'))}</div></section><div class="board end-board" role="img" aria-label="${t('boardLabel')}">${boardSVG(game)}</div>`;
}
function render() {
  clearTimeout(timer); setLanguage(); setTheme();
  const active = document.activeElement;
  const focused = active?.id;
  const selection = focused==='code'?[active.selectionStart,active.selectionEnd]:null;
  // Keep keyboard play moving across disabled dice and automatic turns. Settings
  // and controls outside the play area keep their own focus.
  const insideGame = active===document.body || Boolean(active?.closest?.('.play-layout'));
  if (!insideGame || screen!=='play' || game.phase==='finished') keyboardGameFocus=false;
  app.innerHTML = `<div class="shell">${screen==='home'?homeHTML():screen==='waiting'?waitingHTML():game.phase==='finished'?endHTML():playHTML()}<div id="error" class="error" role="status"${error?'':' hidden'}>${error?esc(error):''}${signIn?` <a href="https://appai.info/api/auth/signin">${t('signInLink')}</a> · <a href="https://appai.info/games/race-home/?lang=${lang}">${t('createHere')}</a>`:''}</div></div>`;
  app.querySelectorAll('button').forEach(b=>{ if(busy) b.disabled=true; });
  if (focused) { const node = document.getElementById(focused); if(node && !node.disabled) { node.focus({preventScroll:true}); if(selection) node.setSelectionRange(...selection); } }
  if (keyboardGameFocus && canAct()) {
    const id=game.phase==='choose'?'token-'+legalMoves(game)[0]:'roll';
    document.getElementById(id)?.focus({preventScroll:true});
    keyboardGameFocus=false;
  }
  if (screen!=='home' && game) {
    const announcement = `${notice()} ${game.phase==='finished'?t('winner',{player:player(game.winner)}):t('turn',{player:player(game.turn)})}${game.phase==='choose'?' '+t('choose'):''}`;
    if(live.textContent!==announcement) live.textContent=announcement;
  }
  schedule();
}
function schedule() {
  if (screen!=='play' || busy || rolling || game.phase==='finished') return;
  let action = automaticAction(game,preferences,Boolean(session));
  if(session && canAct() && game.phase==='choose' && game.settings.autoMove && legalMoves(game).length===1) action='pick';
  if (!action) return;
  const at = generation;
  timer = setTimeout(()=>{ if(at!==generation || screen!=='play') return; void perform(action==='roll'?{type:'roll',value:rollDie()}:{type:'pick',token:chooseToken(game)}); },750);
}
let audio;
function sound() {
  if(!preferences.sound) return;
  try { audio ||= new (window.AudioContext||window.webkitAudioContext)(); void audio.resume(); const osc=audio.createOscillator(), gain=audio.createGain(); osc.connect(gain); gain.connect(audio.destination); osc.frequency.value=game.last?.captured?660:420; gain.gain.setValueAtTime(.05,audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.13); osc.start(); osc.stop(audio.currentTime+.15); } catch {}
}
const delay = ms=>new Promise(r=>setTimeout(r,ms));
async function perform(action, keyboard=false) {
  if(busy || screen!=='play' || game.phase==='finished') return;
  if(keyboard) keyboardGameFocus=true;
  busy=true; error=''; const at=generation;
  if(action.type==='roll') { rolling=true; render(); await delay(650); if(at!==generation) return; }
  try {
    if(session) { await session.send(action); game=session.game; }
    else game=reduceMove(game,game.turn,action);
    sound(); persist();
    // A no-move/forfeit notice stays visible before any automatic next action.
    if(['noMove','forfeit'].includes(game.last.type)) { rolling=false; render(); await delay(850); }
  } catch(e) { showError(e); }
  finally {
    rolling=false; busy=false;
    if(at===generation) {
      render();
    }
  }
}
function showError(e, creating=false) {
  signIn=creating && (e.status===401||e.status===403||e.status===503);
  const map={room_not_found:'missing',invalid_code:'invalid',invalid_state:'invalid',version_conflict:'conflict',not_your_turn:'notTurn',room_full:'fullRoom',room_not_ready:'waitRoom',rate_limited:'rate'};
  error=t(signIn?'signIn':map[e.error]||'unavailable');
  if(e.status===404) { session?.stop(); session=undefined; roomCode=undefined; screen='home'; persist(); }
}
function sessionChanged(updated) {
  if(session!==updated) return;
  game=updated.game; persist();
  const signature=JSON.stringify([game,updated.room.status,updated.room.seats.map(p=>[p.joined,p.online,p.idleSeconds>=120])]);
  if(signature===roomSignature) return;
  roomSignature=signature;
  if(screen!=='home') screen=updated.room.status==='waiting'?'waiting':'play';
  render();
}
async function enterRoom(code) {
  if(busy) return;
  busy=true; error=''; signIn=false; render();
  try {
    let data;
    if(code) {
      code=normalizeCode(code); const old=client.saved(code);
      if(old) { const d=await client.poll(code,old.token,-1); data={...old,code,room:d.room}; }
      else data=await client.join(code);
    } else data=await client.create(newGame(preferences.count,preferences.rules));
    session?.stop();
    const next=new OnlineSession(client,data,{changed:sessionChanged,failed:e=>{if(session===next && !next.stopped) {showError(e);render();}}});
    session=next;
    game=session.game; roomCode=session.code; screen=session.room.status==='waiting'?'waiting':'play'; mode='rooms'; roomSignature='';
    const url=new URL(location.href); url.searchParams.set('room',roomCode); history.replaceState(null,'',url); persist(); session.startPolling(); window.scrollTo({top:0});
  } catch(e) { showError(e,!code); }
  finally { busy=false; render(); }
}
function localStart() {
  generation++; clearTimeout(timer); session?.stop(); session=undefined; mode='local'; roomCode=undefined; busy=false; rolling=false; error=''; signIn=false;
  const url=new URL(location.href); url.searchParams.delete('room'); history.replaceState(null,'',url);
  game=newGame(preferences.count,preferences.rules); screen='play'; persist(); render(); window.scrollTo({top:0});
}
app.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]'); if(!b || b.disabled) return;
  const action=b.dataset.action;
  if(action==='roll') { await perform({type:'roll',value:rollDie()},e.detail===0); return; }
  if(action==='pick') { await perform({type:'pick',token:Number(b.dataset.token)},e.detail===0); return; }
  if(action==='local'||action==='rooms') { mode=action; error=''; signIn=false; }
  if(action==='start'||action==='new') { localStart(); return; }
  if(action==='resume') {
    session?.stop(); session=undefined; game=localGame; mode='local'; screen='play';
    if(!preferences.seats.slice(0,game.players.length).includes('human')) preferences.seats[0]='human';
    const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);persist();window.scrollTo({top:0});
  }
  if(action==='home') { generation++; clearTimeout(timer); session?.stop(); screen='home'; error=''; signIn=false; window.scrollTo({top:0}); }
  if(action==='create') { await enterRoom(); return; }
  if(action==='resume-room') { await enterRoom(roomCode); return; }
  if(action==='start-room'||action==='skip') {
    busy=true; error=''; render();
    try { if(action==='start-room') await session.start(); else await session.skip(); game=session.game; persist(); }
    catch(err) { showError(err); } finally { busy=false; render(); } return;
  }
  render();
});
app.addEventListener('submit',e=>{ if(e.target.id==='join-form') { e.preventDefault(); void enterRoom(codeInput); } });
app.addEventListener('input',e=>{ if(e.target.id==='code') codeInput=e.target.value; });
app.addEventListener('change',e=>{
  const {id,value,checked}=e.target;
  // Text-field blur must not replace a pending click/submit target. Only known
  // setup controls need a redraw; keep code/autofill changes in memory.
  if(id==='code') { codeInput=value; return; }
  if(!['language','theme','count','length','seat-0','seat-1','seat-2','seat-3','sound','threeSixes','captureBonus','autoMove'].includes(id)) return;
  if(id==='language') { lang=value; const url=new URL(location.href); url.searchParams.set('lang',lang); history.replaceState(null,'',url); }
  if(id==='theme') preferences.theme=value;
  if(id==='count') preferences.count=Number(value);
  if(id==='length') preferences.rules.tokens=Number(value);
  if(id.startsWith('seat-')) preferences.seats[Number(id.split('-')[1])]=value;
  if(id==='sound') preferences.sound=checked;
  if(['threeSixes','captureBonus','autoMove'].includes(id)) preferences.rules[id]=checked;
  if(!preferences.seats.slice(0,preferences.count).includes('human')) preferences.seats[0]='human';
  persist(); render();
});
document.addEventListener('visibilitychange',()=>{session?.visibilityChanged();});
window.addEventListener('pagehide',()=>{persist();session?.stop();});
window.addEventListener('pageshow',()=>{if(session&&screen!=='home')session.startPolling();});
render();
if(codeInput) { mode='rooms'; void enterRoom(codeInput); }
