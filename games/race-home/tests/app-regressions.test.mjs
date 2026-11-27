import test from 'node:test';
import assert from 'node:assert/strict';
import { uiHost } from './ui-host.mjs';
import { FakeServer } from './fake-server.mjs';
import { RoomsClient, OnlineSession } from '../src/rooms.js';
import { newGame, reduceMove } from '../src/logic.js';
import { defaultPreferences } from '../src/controller.js';
import { locales, messages } from '../src/i18n.js';

test('room-code blur preserves the first submit target and joins exactly once',async t=>{
  const server=new FakeServer();
  await new RoomsClient({fetcher:server.fetch}).create(newGame());
  const h=await uiHost(t,{fetcher:server.fetch});
  await h.click('rooms'); h.focus('code');
  h.listeners.input({target:{id:'code',value:'abc234'}});
  const submit=h.buttons.find(b=>!b.dataset.action), renders=h.renders;
  // Pointer-down blurs the edited text field before the button's click/submit.
  h.change('code','abc234');
  assert.equal(h.renders,renders);
  assert.ok(h.buttons.includes(submit),'blur must leave the submit button connected');
  let prevented=false;
  h.listeners.submit({target:{id:'join-form'},preventDefault:()=>prevented=true});
  await h.flush();
  assert.equal(prevented,true);
  assert.equal(server.calls.filter(c=>c.url.endsWith('/join')).length,1);
  assert.match(h.app.innerHTML,/Room ABC234/);
  assert.match(h.app.innerHTML,/class="play-layout"/);
});

test('unrelated text/name changes do not redraw; setup changes still persist',async t=>{
  const h=await uiHost(t), renders=h.renders;
  h.change('name','Player name'); h.change('unknown','text');
  assert.equal(h.renders,renders);
  h.change('count','3'); h.change('length','4'); h.change('seat-2','human'); h.change('sound','',true);
  assert.equal(h.state.preferences.count,3);
  assert.equal(h.state.preferences.rules.tokens,4);
  assert.equal(h.state.preferences.seats[2],'human');
  assert.equal(h.state.preferences.sound,true);
  assert.match(h.app.innerHTML,/id="seat-2"/);
});

test('keyboard no-move roll focuses the next human die after the notice',async t=>{
  const preferences=defaultPreferences(); preferences.seats[1]='human';
  const h=await uiHost(t,{game:newGame(),preferences});
  const roll=h.click('roll',undefined,true);
  await h.fire(650);
  assert.equal(h.state.game.turn,1);
  assert.equal(h.node('roll').disabled,true);
  await h.fire(850); await roll;
  assert.equal(h.document.activeElement,h.node('roll'));
  assert.equal(h.node('roll').disabled,false);
});

for(const canMove of [false,true]) {
  test(`keyboard focus returns after a computer turn (${canMove?'legal move':'no move'})`,async t=>{
    const game=newGame(); if(canMove) game.players[1][0]=0;
    const h=await uiHost(t,{game});
    const roll=h.click('roll',undefined,true);
    await h.fire(650); await h.fire(850); await roll;
    assert.equal(h.document.activeElement,h.document.body);
    await h.fire(750); await h.fire(650);
    if(canMove) {
      assert.equal(h.state.game.phase,'choose');
      await h.fire(750); // Computer moves and passes back to the human.
    } else await h.fire(850); // Computer's no-move notice ends.
    assert.equal(h.state.game.turn,0);
    assert.equal(h.document.activeElement,h.node('roll'));
  });
}

test('keyboard token choice still transfers focus to the next die',async t=>{
  const preferences=defaultPreferences(); preferences.seats[1]='human';
  const game=newGame(); game.players[0][0]=0;
  const h=await uiHost(t,{game:reduceMove(game,0,{type:'roll',value:1}),preferences});
  await h.click('pick',0,true);
  assert.equal(h.state.game.turn,1);
  assert.equal(h.document.activeElement,h.node('roll'));
});

for(const focus of ['theme','language','outside']) {
  test(`returning human turn does not steal focus from ${focus}`,async t=>{
    const h=await uiHost(t,{game:newGame()});
    const roll=h.click('roll',undefined,true);
    await h.fire(650); await h.fire(850); await roll;
    const outside={id:'external',closest:()=>null};
    if(focus==='outside') h.document.activeElement=outside;
    else h.focus(focus);
    await h.fire(750); await h.fire(650); await h.fire(850);
    assert.equal(h.state.game.turn,0);
    assert.equal(h.document.activeElement,focus==='outside'?outside:h.node(focus));
    assert.equal(h.node('roll').disabled,false);
  });
}

test('pointer rolls do not opt into keyboard focus recovery',async t=>{
  const preferences=defaultPreferences(); preferences.seats[1]='human';
  const h=await uiHost(t,{game:newGame(),preferences});
  const roll=h.click('roll');
  await h.fire(650); await h.fire(850); await roll;
  assert.equal(h.document.activeElement,h.document.body);
});

for(const lang of locales) {
  test(`${lang}: local animation/no-move never says connecting; computer says thinking`,async t=>{
    const h=await uiHost(t,{game:newGame(),lang});
    const status=()=>h.app.innerHTML.match(/<div><strong>[^<]*<\/strong><p>(.*?)<\/p><\/div><\/div>/)?.[1];
    const roll=h.click('roll');
    assert.equal(status(),''); // Human die animation.
    await h.fire(650);
    assert.equal(status(),messages[lang].thinking); // No move: computer is next.
    await h.fire(850); await roll;
    assert.equal(status(),messages[lang].thinking);
    await h.fire(750);
    assert.equal(status(),messages[lang].thinking); // Computer die animation.
    await h.fire(650);
    assert.equal(status(),''); // No move: human is next; notice still busy.
    await h.fire(850);
    assert.equal(status(),'');
  });
}

test('room actions retain their connecting status',async t=>{
  const server=new FakeServer();
  const host=new RoomsClient({fetcher:server.fetch}), data=await host.create(newGame());
  const h=await uiHost(t,{fetcher:server.fetch});
  await h.click('rooms'); h.change('code','ABC234');
  h.listeners.submit({target:{id:'join-form'},preventDefault(){}}); await h.flush();
  // The joined seat is second; advance the host and refresh presence.
  const session=new OnlineSession(host,{...data,room:server.public(server.rooms.get(data.code))});
  await session.send({type:'roll',value:1});
  await h.fire(1200);
  assert.equal(h.node('roll').disabled,false);
  const roll=h.click('roll',undefined,true);
  assert.ok(h.app.innerHTML.includes(`<p>${messages.en.connecting}</p>`));
  await h.fire(650); await h.fire(850); await roll;
});
