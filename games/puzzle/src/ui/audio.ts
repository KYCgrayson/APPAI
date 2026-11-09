export class Audio {
 private context?: AudioContext;
 private noiseBuffers = new Map<number, AudioBuffer>();
 private musicGain?: GainNode;
 private effectsGain?: GainNode;
 private timer = 0;
 private next = 0;
 private beat = 0;
 private flourishUntil = 0;
 muted = false;
 music = true;
 constructor() {
  try { this.muted=localStorage.getItem('river-sfx')==='off'; this.music=localStorage.getItem('river-music')!=='off'; } catch {}
  document.addEventListener('visibilitychange',()=>this.update());
 }
 unlock() {
  if(this.context?.state==='running')return;
  if(!this.context) {
   const ctx=this.context=new AudioContext(); this.musicGain=ctx.createGain();this.effectsGain=ctx.createGain();
   this.musicGain.gain.value=0;this.effectsGain.gain.value=0;
   this.musicGain.connect(ctx.destination);this.effectsGain.connect(ctx.destination);
   this.next=ctx.currentTime+.08;this.timer=window.setInterval(()=>this.schedule(),100);
  }
  if(this.context.state==='suspended'&&!document.hidden) void this.context.resume().catch(()=>{}); this.update();
 }
 toggleMusic(){this.music=!this.music;this.save();}
 toggleSound(){this.muted=!this.muted;this.save();}
 private save(){try{localStorage.setItem('river-music',this.music?'on':'off');localStorage.setItem('river-sfx',this.muted?'off':'on');}catch{}this.update();}
 private update(){const ctx=this.context;if(!ctx)return;const t=ctx.currentTime;
  this.musicGain!.gain.setTargetAtTime(this.music && !document.hidden ? .12 : 0,t,.08);
  this.effectsGain!.gain.setTargetAtTime(!this.muted && !document.hidden ? .65 : 0,t,.025);
  if(document.hidden){window.clearInterval(this.timer);this.timer=0;window.setTimeout(()=>{if(document.hidden)void ctx.suspend();},250);}
  else {void ctx.resume().catch(()=>{});if(!this.timer){this.next=t+.1;this.timer=window.setInterval(()=>this.schedule(),100);}}
 }
 private tone(freq:number,t:number,duration:number,volume:number,dest:GainNode,type:OscillatorType='sine'){
  const ctx=this.context!,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=freq;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.025);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(g).connect(dest);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};
 }
 private schedule(){const ctx=this.context;if(!ctx||document.hidden)return;
  if(this.next<ctx.currentTime)this.next=ctx.currentTime+.05;
  while(this.next<ctx.currentTime+.3){const b=this.beat++,bar=Math.floor(b/4)%16,cycle=Math.floor(b/64),root=[48,53,55,50][Math.floor(bar/4)],t=this.next;
   if(this.music&&t>this.flourishUntil){
    if(b%4===0)for(const n of [root,root+7,root+12])this.tone(440*2**((n-69)/12),t,2.7,.09,this.musicGain!,'sine');
    if(b%2===0)this.tone(440*2**((root-12-69)/12),t,.55,.2,this.musicGain!,'triangle');
    const pattern=[0,4,7,9,12,7,4,2];const n=root+12+pattern[(b*3+bar+cycle*5)%8];
    if((b+bar)%5!==0)this.tone(440*2**((n-69)/12),t,.8,.15,this.musicGain!);
   }this.next+=60/84;
  }
 }
 private noise(t:number,duration:number,frequency:number){const ctx=this.context!,buffer=this.noiseBuffers.get(duration) ?? ctx.createBuffer(1,ctx.sampleRate*duration,ctx.sampleRate);
  if(!this.noiseBuffers.has(duration)){const data=buffer.getChannelData(0);let seed=173;
  for(let i=0;i<data.length;i++){seed=(seed*16807)%2147483647;data[i]=(seed/1073741824-1)*(1-i/data.length);}
  this.noiseBuffers.set(duration,buffer);}
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=frequency;gain.gain.setValueAtTime(.13,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(filter).connect(gain).connect(this.effectsGain!);source.start(t);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
 }
 play(kind:'select'|'leave'|'sail'|'land'|'fail'|'win') {const ctx=this.context;if(!ctx)return;const t=ctx.currentTime;
  if(kind==='win'){this.flourishUntil=t+2;if(this.music)for(let i=0;i<8;i++)this.tone(523*2**([0,4,7,12,7,4,9,12][i]/12),t+i*.16,1,.15,this.musicGain!);}
  if(this.muted)return;
  const notes={select:[430,220],leave:[330,190],sail:[140,210],land:[110],fail:[330,277,220],win:[523,659,784,1046,1318]}[kind];
  notes.forEach((f,i)=>this.tone(f,t+i*.11,kind==='win'?.7:.22,.09,this.effectsGain!,kind==='select'||kind==='land'?'triangle':'sine'));
  if(kind==='sail'){this.noise(t,.6,1100);this.noise(t+.3,.35,700);}else if(kind==='select'||kind==='leave'||kind==='land')this.noise(t,.09,650);
 }
}
