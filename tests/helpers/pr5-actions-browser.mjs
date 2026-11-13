import { createRequire } from 'node:module';
import { mkdtemp,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
export async function browserBundle() {
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const directory=await mkdtemp(join(tmpdir(),'appai-pr5-actions-'));
  try {
    const entry=join(directory,'entry.jsx');const loader=join(directory,'loader.cjs');const navigation=join(directory,'navigation.js');
    await writeFile(loader,`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
    await writeFile(navigation,'export function useRouter(){return {refresh(){window.refreshed=true;}};}');
    await writeFile(entry,`import React from 'react';import {createRoot} from 'react-dom/client';import {PageActions,PageActionButtons} from ${JSON.stringify(join(root,'src/app/dashboard/pages/actions.tsx'))};
      window.mount=(count,root)=>{window.scope={pages:count,rows:count*3,children:0,titles:['Fixture'],skipped:[],includesRoot:root};
        createRoot(document.getElementById('fixture')).render(React.createElement(PageActions,null,
          ...Array.from({length:count},(_,i)=>React.createElement('label',{key:i},React.createElement('input',{type:'checkbox',name:'targets',value:'p'+i,defaultChecked:true}),'Page '+i)),
          React.createElement(PageActionButtons,{id:'p0'})));};`);
    const {webpack}=require('next/dist/compiled/webpack/webpack');
    const compiler=webpack({mode:'production',target:'web',entry,devtool:false,output:{path:directory,filename:'bundle.js'},resolve:{extensions:['.js','.jsx','.ts','.tsx'],alias:{'next/navigation':navigation},modules:[join(root,'node_modules')]},module:{rules:[{test:/\.tsx?$/,use:loader}]},optimization:{minimize:false}});
    await new Promise((resolve,reject)=>compiler.run((error,stats)=>compiler.close(closeError=>error||closeError||stats.hasErrors()?reject(error||closeError||new Error(stats.toString({all:false,errors:true}))):resolve())));
    return await readFile(join(directory,'bundle.js'),'utf8');
  } finally {await rm(directory,{recursive:true,force:true});}
}
export function existingPlaywright() {
  // An explicit existing module path is optional; never installs/downloads anything.
  return require(process.env.PR5_PLAYWRIGHT_MODULE || 'playwright');
}
