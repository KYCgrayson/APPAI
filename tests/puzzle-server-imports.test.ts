import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const puzzleRoot = join(root, 'games/puzzle') + sep;
const sourceExtensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
assert.equal(config.error, undefined);
const { options, errors } = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
assert.deepEqual(errors, []);
const cache = ts.createModuleResolutionCache(root, path => path, options);

// Include type-only imports, re-exports, import() types, dynamic imports and require().
const imports = (file: string) => ts.preProcessFile(readFileSync(file, 'utf8'), true, true)
  .importedFiles.map(({ fileName }) => fileName);
const resolve = (specifier: string, file: string) =>
  ts.resolveModuleName(specifier, file, options, ts.sys, cache).resolvedModule?.resolvedFileName;
const isScene = (path: string) => /(^|[/\\])scene([/\\.]|$)/.test(path);

test('all server imports into puzzle code stay independent of rendering and puzzle node_modules', () => {
  // Discover every entry from src/**, including future imports outside boards.ts.
  const entries = new Set<string>();
  for (const file of ts.sys.readDirectory(join(root, 'src'), sourceExtensions)) {
    for (const specifier of imports(file)) {
      const target = resolve(specifier, file);
      if (target?.startsWith(puzzleRoot)) entries.add(target);
    }
  }
  assert.ok(entries.size > 0, 'expected server imports into games/puzzle');

  const visited = new Set<string>();
  function visit(file: string) {
    if (visited.has(file)) return;
    visited.add(file);
    assert.ok(!isScene(relative(root, file)), `server reaches scene module: ${relative(root, file)}`);
    for (const specifier of imports(file)) {
      const edge = `${relative(root, file)} imports ${specifier}`;
      assert.doesNotMatch(specifier, /^(?:@types\/)?three(?:\/|$)/, edge);
      assert.ok(!isScene(specifier), edge);
      if (isBuiltin(specifier)) continue;
      const target = resolve(specifier, file);
      assert.ok(target, `unresolved server puzzle dependency: ${edge}`);
      assert.ok(!target.startsWith(join(puzzleRoot, 'node_modules') + sep),
        `server requires games/puzzle/node_modules: ${edge}`);
      // Follow every local dependency, including helpers outside games/puzzle.
      if (!target.includes(`${sep}node_modules${sep}`) && sourceExtensions.some(ext => target.endsWith(ext))) {
        visit(target);
      }
    }
  }
  for (const entry of entries) visit(entry);
});
