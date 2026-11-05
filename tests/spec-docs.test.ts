import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const topics = ['pages', 'style', 'i18n', 'tools', 'apps', 'api'];
test('generated full spec stays in sync', () => {
  const generated = execFileSync(process.execPath, ['--input-type=module', '-e', "import { buildAgentInstructions } from './scripts/build-agent-instructions.mjs'; process.stdout.write(buildAgentInstructions());"], { encoding: 'utf8' });
  assert.equal(read('AGENT_INSTRUCTIONS.md'), generated);
});
test('overview is short and points to required standalone topics', () => {
  const overview = read('docs/spec/overview.md');
  assert.ok(overview.trimEnd().split('\n').length <= 200);
  assert.match(overview, /MUST READ/);
  for (const topic of topics) {
    assert.ok(overview.includes('https://appai.info/spec/' + topic));
    const header = read('docs/spec/' + topic + '.md').split('\n').slice(0, 4).join('\n');
    assert.match(header, /Covers /);
    assert.match(header, /https:\/\/appai.info/);
    assert.match(header, /Authorization: Bearer appai_sk_YOUR_KEY/);
    assert.match(header, /Overview.*https:\/\/appai.info\/spec/);
  }
});
test('all legacy level-two headings remain in source topics', () => {
  const headings = ["What You Can Build (read this first)", "How to Work with the User", "Creating a Page", "Compliance Pages", "Managing Pages (CRUD)", "Icons", "Section Reference", "Multi-Language Details", "Multi-Page Site Details", "Document Guide", "Authentication", "Pick the rung first (30 seconds, before anything else)", "Publish in one minute"];
  const docs = ['overview', ...topics].map(topic => read('docs/spec/' + topic + '.md')).join('\n');
  for (const heading of headings) assert.ok(docs.includes('## ' + heading + '\n'), heading);
});
test('topic route whitelists files and preserves static examples route', () => {
  const route = read('src/app/spec/[topic]/route.ts');
  assert.ok(route.includes('if (!topics.includes(topic))'));
  assert.match(route, /status: 404/);
  assert.match(route, /text\/plain; charset=utf-8/);
  assert.match(route, /public, max-age=3600/);
  const whitelist = route.match(/const topics\s*=\s*\[([^\]]*)\]/)?.[1];
  assert.ok(whitelist, 'topic whitelist is declared');
  assert.deepEqual([...whitelist.matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]), topics);
  assert.ok(read('src/app/spec/examples/[name]/route.ts').includes('GET'));
});
