import test from "node:test";
import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { actionHooks, registerActionsFixture } from "./helpers/pr5-actions-fixture.mjs";
const hooks=[registerHostedRenderLoader(),registerActionsFixture()];
test.after(()=>hooks.reverse().forEach(h=>h.deregister()));
const {PageActions}=await import("../src/app/dashboard/pages/actions.tsx");
type Node = ReactElement<Record<string,unknown>>;
function elements(node:unknown):Node[]{if(Array.isArray(node))return node.flatMap(elements);if(!node||typeof node!=="object"||!("props" in node))return [];const el=node as Node;return [el,...elements(el.props.children)];}
const render=()=>{actionHooks.refIndex=actionHooks.stateIndex=0;return PageActions({children:"Fixture rows"});};

test("P11 actual client confirmation requires DELETE for a root or 11 pages and submits expected scope; restore explains publication state",async t=>{
  for(const [action,pages,root] of [["delete",1,true],["delete",11,false],["unpublish",2,false],["restore",1,false]] as const){
    actionHooks.refs.length=actionHooks.states.length=0;actionHooks.refreshes=0;
    const sent:Record<string,unknown>[]=[];
    const mock=t.mock.method(globalThis,"fetch",async(_url: string | URL | Request,init?: RequestInit)=>{const body=JSON.parse(init!.body as string);sent.push(body);return Response.json(body.dryRun?{pages,rows:pages*3,children:root?1:0,includesRoot:root,titles:["Fixture"],skipped:[]}:{cacheRefreshed:false});});
    try{
      const form=elements(render()).find(e=>e.type==="form")!;
      await (form.props.onClick as (e:unknown)=>Promise<void>)({target:{closest:()=>({dataset:{pageAction:action,target:"fixture-id"}})}});
      let tree=elements(render());assert.ok(tree.some(e=>e.props.role==="dialog"));
      let confirm=tree.find(e=>e.type==="button"&&Array.isArray(e.props.children)&&e.props.children[0]==="Confirm ")!;
      if(action==="delete"){
        assert.equal(confirm.props.disabled,true);
        const input=tree.find(e=>e.type==="input")!;
        (input.props.onChange as(e:unknown)=>void)({target:{value:"DELETE"}});
        tree=elements(render());confirm=tree.find(e=>e.type==="button"&&Array.isArray(e.props.children)&&e.props.children[0]==="Confirm ")!;
      }
      assert.equal(confirm.props.disabled,false);
      if(action==="restore")assert.ok(tree.some(e=>e.type==="p"&&String(e.props.children).includes("previous published or draft")));
      await (confirm.props.onClick as()=>Promise<void>)();
      assert.deepEqual(sent,[{action,targets:["fixture-id"],dryRun:true},{action,targets:["fixture-id"],expected:{pages,rows:pages*3}}]);
      assert.equal(actionHooks.refreshes,1);assert.ok(elements(render()).some(e=>e.props.role==="status"&&String(e.props.children).includes("up to 1 hour")));
    }finally{mock.mock.restore();}
  }
});
