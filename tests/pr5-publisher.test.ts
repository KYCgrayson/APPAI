import test from "node:test";
import assert from "node:assert/strict";
import { publishSite } from "../docs/examples/publish-person-site.mjs";
const fixture = { slug:"person-fixture",locales:{en:{sections:[{type:"profile-header",data:{name:"Fixture"}},{type:"project-cards",data:{items:[{name:"Removed",page:{slug:"removed-child",linkLabel:"Read"}},{name:"Kept",page:{slug:"kept-child",linkLabel:"Read"}}]}}]}} };
test("P15 publisher preflight skips removed children and cards, publishes remaining pages and prints omissions",async()=>{
  const writes: {slug:string;content:{sections:{type:string;data:{items:{name:string}[]}}[]}}[]=[]; const logs:string[]=[];
  const skipped=await publishSite(fixture,".",{upload:async()=>{throw new Error("No fixture uploads");},log:(line:string)=>logs.push(line),api:async(path:string,body?:typeof writes[number])=>{
    if (!body) return path.endsWith("/children") ? {children:[{slug:"removed-child",removedByOwner:{state:"deleted"}}]} : [{slug:fixture.slug,removedByOwner:null}];
    writes.push(body);return {};
  }});
  assert.deepEqual(skipped,["removed-child"]);assert.deepEqual(writes.map(p=>p.slug),["person-fixture","kept-child"]);
  assert.deepEqual(writes[0].content.sections.find(s=>s.type==="project-cards")?.data.items.map(i=>i.name),["Kept"]);
  assert.match(logs.at(-1)!,/removed-child/);
});
test("P15 a scripted agent continues after a removal race, removes the card, never retries the removed page or DELETEs",async()=>{
  const attempts:string[]=[];const writes: {slug:string;content:unknown}[]=[];
  await publishSite(fixture,".",{log:()=>{},api:async(path:string,body?:typeof writes[number])=>{
    if(!body)return path.endsWith("/children") ? {children:[]} : [];
    attempts.push(body.slug);
    if(body.slug==="removed-child"){const error=Object.assign(new Error("Owner removed"),{code:"removed_by_owner"});throw error;}
    writes.push(structuredClone(body));return {};
  }});
  assert.equal(attempts.filter(s=>s==="removed-child").length,1);assert.ok(attempts.includes("kept-child"));
  assert.doesNotMatch(JSON.stringify(writes.at(-1)?.content),/Removed/);
});
