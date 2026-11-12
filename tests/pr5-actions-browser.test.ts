import test from "node:test";
import assert from "node:assert/strict";
import { browserBundle,existingPlaywright } from "./helpers/pr5-actions-browser.mjs";

test("P11 Playwright: root and 11-page deletion dialogs require typed DELETE",{skip:process.env.PR5_BROWSER_TESTS!=="1"?"Opt in with PR5_BROWSER_TESTS=1 and an existing Playwright/Chromium installation.":false},async()=>{
  const js=await browserBundle();const {chromium}=existingPlaywright();
  const browser=await chromium.launch({headless:true,channel:"chrome"});
  try{
    for(const [count,root] of [[1,true],[11,false]] as const){
      const page=await browser.newPage();
      try{
        await page.setContent('<div id="fixture"></div>');await page.addScriptTag({content:js});
        await page.evaluate(({count,root}:{count:number;root:boolean})=>{
          const target=window as unknown as {mount:(count:number,root:boolean)=>void;scope:unknown};
          window.fetch=async(_url,options)=>{const body=JSON.parse(options!.body as string);return Response.json(body.dryRun?target.scope:{cacheRefreshed:true});};target.mount(count,root);
        },{count,root});
        await page.getByRole("button",{name:"delete",exact:true}).first().click();
        const dialog=page.getByRole("dialog");await dialog.waitFor();
        const confirm=dialog.getByRole("button",{name:"Confirm delete"});assert.equal(await confirm.isDisabled(),true);
        await dialog.getByRole("textbox").fill("DELETE");assert.equal(await confirm.isEnabled(),true);
        await confirm.click();await page.getByRole("status").waitFor();
      }finally{await page.close();}
    }
  }finally{await browser.close();}
});
