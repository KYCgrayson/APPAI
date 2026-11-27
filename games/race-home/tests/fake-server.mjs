// In-memory implementation of the documented transport contract. Deliberately
// does not validate game rules: that is the clients' responsibility.
export class FakeServer {
  constructor() { this.rooms=new Map();this.calls=[];this.faults=[];this.now=0;this.counter=0; }
  response(status,data,headers={}) { return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}}); }
  public(room) {
    return {code:room.code,game:room.game,version:room.version,state:structuredClone(room.state),turn:room.turn,
      seats:room.tokens.map((token,seat)=>({seat,joined:Boolean(token),online:Boolean(token)&&this.now-room.seen[seat]<30000,idleSeconds:Math.floor((this.now-room.seen[seat])/1000)})),
      moves:structuredClone(room.moves),status:room.status,expiresAt:new Date(this.now+900000).toISOString()};
  }
  fail(status,error,headers={}) { this.faults.push(()=>this.response(status,{error},headers)); }
  fetch = async (url,options={}) => {
    const u=new URL(url), body=options.body?JSON.parse(options.body):undefined;
    this.calls.push({url,options,body});
    if(this.faults.length)return this.faults.shift()();
    const [,code,op]=u.pathname.replace('/api/rooms','').split('/');
    if(u.pathname==='/api/rooms') {
      const id=['ABC234','DEF567','GHJ678'][this.counter++]||'KLM789';
      const room={code:id,game:body.game,state:body.state,version:1,turn:body.turn,status:'waiting',tokens:['t0',...Array(body.seats-1).fill('')],seen:Array(body.seats).fill(this.now),moves:[]};
      this.rooms.set(id,room);return this.response(201,{code:id,seat:0,token:'t0',room:this.public(room)});
    }
    const room=this.rooms.get(code);
    if(!room)return this.response(404,{error:'room_not_found'});
    if(op==='join') {
      const seat=room.tokens.indexOf('');if(seat<0)return this.response(409,{error:'room_full'});
      room.tokens[seat]='t'+seat;room.seen[seat]=this.now;room.version++;
      if(!room.tokens.includes(''))room.status='playing';
      return this.response(200,{seat,token:room.tokens[seat],room:this.public(room)});
    }
    const token=options.headers?.Authorization?.replace('Bearer ',''),seat=room.tokens.indexOf(token);
    if(seat<0)return this.response(404,{error:'room_not_found'});
    const fail=error=>this.response(409,{error,room:this.public(room)});
    if(op==='start') {
      if(seat!==0)return this.response(403,{error:'not_host'});
      if(room.status!=='waiting')return fail('already_started');
      const joined=room.tokens.filter(Boolean);if(joined.length<2)return fail('room_not_ready');
      room.tokens=joined;room.seen.length=joined.length;room.version++;room.status='playing';
    } else if(op==='moves') {
      if(room.status!=='playing')return fail(room.status==='finished'?'room_finished':'room_not_ready');
      if(body.version!==room.version)return fail('version_conflict');
      let skipped;
      if(body.skip) {
        if('state'in body||'nextTurn'in body||'end'in body)return this.response(400,{error:'invalid_request'});
        if(room.turn===seat||this.now-room.seen[room.turn]<120000)return fail('not_your_turn');
        skipped=room.turn;room.turn=(room.turn+1)%room.tokens.length;
      } else {
        if(room.turn!==seat)return fail('not_your_turn');
        if(body.state)room.state=structuredClone(body.state);
        if(body.nextTurn!==undefined)room.turn=body.nextTurn;
        if(body.end)room.status='finished';
      }
      room.version++;room.moves.push({version:room.version,seat,move:body.move??null,...(skipped!==undefined?{skipped}:{})});room.moves=room.moves.slice(-20);
    }
    room.seen[seat]=this.now;
    if(!op) {
      return this.response(200,Number(u.searchParams.get('since'))===room.version?{changed:false,version:room.version,seats:this.public(room).seats}:{changed:true,seat,room:this.public(room)});
    }
    return this.response(200,{room:this.public(room)});
  };
}
export function memoryStorage() { const entries=new Map();return{entries,getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)}; }
