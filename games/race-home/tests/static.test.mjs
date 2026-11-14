import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';

const root=new URL('../',import.meta.url);
test('static entry point, imports and shipped size satisfy deployment contract',async()=>{
  const html=await readFile(new URL('index.html',root),'utf8');
  assert.match(html,/<meta charset="utf-8">/);assert.match(html,/type="module" src="\.\/src\/app\.js"/);
  for(const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))assert.ok((await stat(new URL(match[1],root))).isFile());
  let size=Buffer.byteLength(html);
  for(const filename of await readdir(new URL('src/',root))) {
    const file=new URL('src/'+filename,root),source=await readFile(file,'utf8');size+=Buffer.byteLength(source);
    for(const match of source.matchAll(/(?:import .*? from|import)\s*['"](\.[^'"]+)['"]/g))assert.ok((await stat(new URL(match[1],file))).isFile());
    assert.doesNotMatch(source,/@import|https?:\/\/[^'"\s]*\.(?:woff|png|jpg|svg|mp3)/);
  }
  assert.ok(size<150000,`${size} shipped bytes`);
});
