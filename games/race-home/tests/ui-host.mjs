import { memoryStorage } from './fake-server.mjs';
import { defaultPreferences, writeSave, SAVE_KEY } from '../src/controller.js';

let imports = 0;
// A small dependency-free host for the app's real handlers. Replacing HTML
// disconnects old controls and drops their focus, just as the browser does.
// This models event/focus wiring only; it does not claim to measure CSS layout.
export async function uiHost(t, { game, preferences=defaultPreferences(), lang='en', fetcher }={}) {
  const original=new Map();
  const replace=(name,value)=>{
    original.set(name,Object.getOwnPropertyDescriptor(globalThis,name));
    Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
  };
  t.after(()=>{for(const [name,descriptor] of original) descriptor?Object.defineProperty(globalThis,name,descriptor):delete globalThis[name];});
  const storage=memoryStorage(), tasks=new Map(), listeners={}, body={id:'',closest:()=>null};
  writeSave(storage,preferences,game);
  let next=0, die=1, href=`http://localhost:5182/?lang=${lang}`, html='', nodes=new Map(), buttons=[], renders=0;
  const document={body,activeElement:body,documentElement:{dataset:{}},hidden:false,addEventListener(){},getElementById:id=>nodes.get(id)};
  const app={
    get innerHTML(){return html;},
    set innerHTML(value){
      if(nodes.get(document.activeElement.id)===document.activeElement || buttons.includes(document.activeElement)) document.activeElement=body;
      html=value; nodes=new Map(); buttons=[]; renders++;
      const playStart=html.indexOf('class="play-layout"'), playEnd=html.indexOf('<div class="actions">',playStart);
      for(const match of html.matchAll(/<(button|select|input)\b([^>]*)>/g)) {
        const attrs=match[2], attr=name=>attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
        const inGame=playStart>=0 && match.index>playStart && (playEnd<0 || match.index<playEnd);
        const node={id:attr('id')||'',disabled:/\bdisabled\b/.test(attrs),dataset:{action:attr('data-action'),token:attr('data-token')},
          closest:selector=>selector==='.play-layout'?(inGame?app:null):node,
          focus(){if(!this.disabled) document.activeElement=this;},setSelectionRange(){}};
        if(node.id) nodes.set(node.id,node);
        if(match[1]==='button') buttons.push(node);
      }
    },
    addEventListener:(name,fn)=>listeners[name]=fn,
    querySelectorAll:()=>buttons,
  };
  const live={textContent:''}; document.querySelector=id=>id==='#app'?app:live;
  replace('document',document); replace('localStorage',storage);
  replace('navigator',{languages:[lang]}); replace('location',{get href(){return href;}});
  replace('history',{replaceState:(_a,_b,url)=>href=String(url)});
  replace('crypto',{getRandomValues:array=>{array[0]=die-1;return array;}});
  replace('window',{addEventListener(){},scrollTo(){}});
  replace('setTimeout',(fn,ms)=>{tasks.set(++next,{fn,ms});return next;}); replace('clearTimeout',id=>tasks.delete(id));
  if(fetcher) replace('fetch',fetcher);
  await import(`../src/app.js?regression-${++imports}`);
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  return {
    app,document,listeners,storage,live,
    get renders(){return renders;}, get buttons(){return buttons;},
    get state(){return JSON.parse(storage.getItem(SAVE_KEY));},
    set die(value){die=value;},
    node:id=>nodes.get(id),
    focus:id=>nodes.get(id).focus(),
    change:(id,value,checked)=>listeners.change({target:{id,value,checked}}),
    click(action,token,keyboard=false){
      const button=buttons.find(b=>b.dataset.action===action && (token===undefined || b.dataset.token===String(token)));
      if(!button) throw Error(`Missing button: ${action}`);
      button.focus();
      return listeners.click({detail:keyboard?0:1,target:button});
    },
    async fire(ms){
      const entry=[...tasks].find(([,job])=>job.ms===ms);
      if(!entry) throw Error(`Missing timer: ${ms}`);
      tasks.delete(entry[0]); entry[1].fn(); await flush();
    },
    flush,
  };
}
