import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createTranslator } from 'next-intl';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const topics = ['api', 'style', 'pages', 'sections', 'i18n', 'tools', 'apps'];
const docs = new Map(['overview', ...topics].map(topic => [topic, read('docs/spec/' + topic + '.md')]));
const locales = ['en', 'ja', 'ko', 'zh-CN', 'zh-TW', 'de', 'fr', 'es', 'hi'];
const names = ['Hosted Page', 'Wrapped tool', 'Connected tool', 'Universal App'];
const meanings = [
  'A product, business or person to describe — a public page at appai.info/p/{slug}.',
  'A tool already deployed elsewhere (Vercel, Cloudflare Pages, Netlify, GitHub Pages) — AppAI wraps it in a page with SEO, language and theme.',
  'A tool that needs a backend, login or quota — wrapped as above and connected to an owner-maintained connector.',
  'Persistent data and business rules — a reviewed app manifest that runs at appai.info/app/{appId}.',
];
const overview = docs.get('overview')!;
const quickstart = read('src/app/llms.txt/route.ts');
const homepage = read('src/app/[locale]/page.tsx');
const layout = read('src/app/layout.tsx');
const references = readdirSync(new URL('../skills/appai-publish/references/', import.meta.url)).filter(name => name.endsWith('.md'));
const skillPaths = ['skills/appai-publish/SKILL.md', ...references.map(name => 'skills/appai-publish/references/' + name)];
const readmes = readdirSync(new URL('../', import.meta.url)).filter(name => /^README.*\.md$/.test(name));

function positionOf(content: string, needle: string) {
  const position = content.indexOf(needle);
  assert.ok(position >= 0, `missing: ${needle}`);
  return position;
}

function headingSlugs(markdown: string) {
  const seen = new Set<string>();
  let fenced = false;
  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced;
    if (fenced || !/^#{1,6} /.test(line)) continue;
    const base = line.replace(/^#{1,6} /, '').toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, '').replace(/ /g, '-');
    let slug = base;
    let suffix = 0;
    while (seen.has(slug)) slug = base + '-' + ++suffix;
    seen.add(slug);
  }
  return seen;
}

function checkLink(link: string, source: string) {
  const url = new URL(link);
  const topic = url.pathname === '/spec' ? 'overview' : url.pathname.slice('/spec/'.length);
  const target = docs.get(topic);
  assert.ok(target, `${source}: missing page ${link}`);
  if (url.hash) assert.ok(headingSlugs(target).has(url.hash.slice(1)), `${source}: missing anchor ${link}`);
}

function assertOrder(content: string) {
  const positions = names.map(name => positionOf(content, name));
  assert.ok(positions.every((position, i) => position >= 0 && (i === 0 || position > positions[i - 1])), positions.join(', '));
}

function nav(topic: string) {
  const lines = docs.get(topic)!.split('\n');
  const match = lines[2].match(/^Previous: \[([^\]]+)\]\(([^)]+)\) · Next: \[([^\]]+)\]\(([^)]+)\)$/);
  assert.ok(match, `${topic}: navigation must be the second line after the title`);
  return { previous: match[2], next: match[4] };
}

test('generated full spec stays in sync and ends with the derived legacy mapping', () => {
  const generated = execFileSync(process.execPath, ['--input-type=module', '-e', "import { buildAgentInstructions } from './scripts/build-agent-instructions.mjs'; process.stdout.write(buildAgentInstructions());"], { encoding: 'utf8' });
  assert.equal(read('AGENT_INSTRUCTIONS.md'), generated);
  assert.doesNotMatch(overview, /Old section.*new page|\| Old section \|/);
  const appendix = generated.slice(positionOf(generated, '## Legacy anchors\n'));
  assert.match(appendix, /^## Legacy anchors\n\n\| Legacy heading \| New URL \|/);
  assert.ok(appendix.trimEnd().split('\n').slice(2).every(line => line.startsWith('|')));
  for (const anchor of ['icons', 'section-reference', 'profile-header', 'hero', 'link-rel-seo']) {
    assert.ok(appendix.includes(`https://appai.info/spec/sections#${anchor} |`));
  }
  const legacyHeadings = JSON.parse(read('docs/spec/legacy-headings.json')) as string[];
  const mappedHeadings = [...appendix.matchAll(/^\| ([^|]+) \| https:/gm)].map(match => match[1]);
  assert.deepEqual([...mappedHeadings].sort(), [...new Set(legacyHeadings)].sort());
  for (const heading of ['Topic pages', 'Dry-run', 'Preview without saving']) {
    assert.ok(!mappedHeadings.includes(heading), heading + ': new heading is not legacy');
  }
  for (const match of appendix.matchAll(/https:\/\/appai\.info\/spec[^\s|]*/g)) checkLink(match[0], 'legacy map');
});

test('overview is short, has seven topic rows, and ends with the single-file fallback', () => {
  assert.ok(overview.trimEnd().split('\n').length <= 200);
  assert.match(overview, /MUST READ/);
  for (const signal of ['No running software', '*.vercel.app', '*.pages.dev', '*.netlify.app', '*.github.io', 'A server, a secret, login or rate limits', 'own schema', 'business rules (inventory, orders, settlement)', 'private assets', 'full UI + API']) assert.ok(overview.includes(signal), signal);
  assert.match(quickstart, /Universal App \| Persistent data and business rules.*reviewed app manifest/);
  assert.match(overview, /^Start at https:\/\/appai.info\/spec/m);
  const table = overview.split('## Topic pages\n')[1].split('## Document Guide')[0];
  const rows = table.trim().split('\n').filter(line => line.startsWith('|'));
  assert.equal(rows.length, topics.length + 2);
  for (const topic of topics) assert.ok(table.includes('https://appai.info/spec/' + topic));
  assert.ok(overview.trimEnd().endsWith('Complete single-file fallback: https://appai.info/llms-full.txt'));
});

test('topic headers have purpose then Previous/Next with a consistent happy path', () => {
  for (const topic of topics) {
    const lines = docs.get(topic)!.split('\n');
    assert.match(lines[0], /^# AppAI — /);
    assert.ok(lines[1] && !lines[1].startsWith('['), topic + ': purpose');
    assert.match(lines[3], /API base:.*Authorization: Bearer appai_sk_YOUR_KEY/);
    assert.equal(lines[4], '', topic + ': header stays within four lines');
    const links = nav(topic);
    checkLink(links.previous, topic);
    checkLink(links.next, topic);
    assert.doesNotMatch(lines.slice(0, 4).join('\n'), /\[Overview\].*\[Pages\].*\[Style\]/);
  }
  const chain = ['overview', 'api', 'style', 'pages', 'sections'];
  const url = (topic: string) => 'https://appai.info/spec' + (topic === 'overview' ? '' : '/' + topic);
  assert.ok(overview.includes(`Next: [Authorization & API](${url('api')})`));
  for (let i = 1; i < chain.length; i++) {
    assert.equal(nav(chain[i]).previous, url(chain[i - 1]));
    if (i < chain.length - 1) assert.equal(nav(chain[i]).next, url(chain[i + 1]));
  }
  assert.equal(nav('sections').next, 'https://appai.info/spec/api#dry-run');
  assert.ok(docs.get('sections')!.includes('https://appai.info/spec#publish-in-one-minute'));
  const steps = overview.split('## Publish in one minute')[1].split('| Type |')[0];
  let position = -1;
  for (const target of ['/api)', '/style)', '/pages)', '/sections)', '/api#dry-run)']) {
    const nextPosition = positionOf(steps, 'https://appai.info/spec' + target);
    assert.ok(nextPosition > position, target + ': quick start order');
    position = nextPosition;
  }
  assert.match(docs.get('api')!, /^# AppAI — Authorization & API\nThe agent obtains a key with the user's approval via device flow;/);
});

test('all legacy level-two headings remain in docs and moved reference anchors have stubs', () => {
  // Old section → new page intentionally lives only in the generated appendix.
  const headings = ['Pick the rung first (30 seconds, before anything else)', 'Publish in one minute', 'Topic pages', 'Document Guide', 'What You Can Build (read this first)', 'How to Work with the User', 'Creating a Page', 'Compliance Pages', 'Managing Pages (CRUD)', 'Icons', 'Section Reference', 'Hero variants', 'Multi-Language Details', 'Multi-Page Site Details', 'Authentication'];
  const source = [...docs.values()].join('\n');
  for (const heading of headings) assert.ok(source.includes('## ' + heading + '\n'), heading);
  for (const heading of ['Icons', 'Section Reference']) {
    assert.ok(docs.get('pages')!.includes(`## ${heading}\n\nMoved to [${heading}](https://appai.info/spec/sections#`));
  }
  assert.doesNotMatch(docs.get('pages')!, /^### (hero|profile-header|Link rel \(SEO\))$/m);
  assert.match(docs.get('sections')!, /^### Link rel \(SEO\)$/m);
});

test('every spec topic and heading link resolves across docs, skill, llms and homepage', () => {
  const sources = [
    ...[...docs].map(([topic, text]) => [topic, text]),
    ...[...skillPaths, ...readmes].map(path => [path, read(path)]),
    ['layout', layout],
    ['llms.txt', quickstart.replaceAll('${baseUrl}', 'https://appai.info')],
    ['homepage', homepage],
  ];
  for (const [path, text] of sources) {
    // Static example assets are handled by their own route, outside topic links.
    const content = text.replace(/https:\/\/appai\.info\/spec\/examples\/[^\s)"`]+/g, '');
    for (const match of content.matchAll(/https:\/\/appai\.info\/spec(?:\/[\w-]+)?(?:#[\w-]+)?/g)) checkLink(match[0], path);
    assert.doesNotMatch(content, /https:\/\/appai\.info\/spec\/pages#(?:icons|section-reference|profile-header|project-cards|entries|hero|video|features|screenshots|download|pricing|testimonials|faq|gallery|team|schedule|sponsors|stats|contact|cta|links|about|embed|link-rel-seo)\b/);
  }
  const cardArray = homepage.match(/\{\(\[([^{}]*?)\] as const\)\.map\(\(\[kind, topic\]\)/)?.[1];
  assert.ok(cardArray, 'homepage card array');
  const cards = [...cardArray.matchAll(/\["(Hosted|Wrapped|Connected|App)", "([^"]+)"\]/g)];
  assert.deepEqual(cards.map(match => match[1]), ['Hosted', 'Wrapped', 'Connected', 'App']);
  assert.match(homepage, /href=\{`https:\/\/appai\.info\/spec\/\$\{topic\}`\}/);
  for (const [, , topic] of cards) checkLink('https://appai.info/spec/' + topic, 'homepage cards');
});

test('four use-cases have identical identifiers and meanings in every entry point', () => {
  for (const content of [overview, quickstart, read('skills/appai-publish/SKILL.md')]) {
    assertOrder(content.split('\n').filter(line => line.startsWith('|')).join('\n'));
    for (const meaning of meanings) assert.ok(content.includes(meaning), meaning);
  }
  const en = JSON.parse(read('src/messages/en.json')).home;
  for (const locale of locales) {
    const home = JSON.parse(read(`src/messages/${locale}.json`)).home;
    assert.deepEqual(Object.keys(home).sort(), Object.keys(en).sort(), locale + ': home keys');
    assertOrder(JSON.stringify(home));
    for (const [i, kind] of ['Hosted', 'Wrapped', 'Connected', 'App'].entries()) {
      assert.equal(home[`agent${kind}Name`], names[i], locale);
      if (locale === 'en') assert.equal(home[`agent${kind}Desc`], meanings[i]);
    }
    assert.ok(home.forAgentsDesc.startsWith('https://appai.info/spec'), locale);
    assert.ok(home.step1Desc.includes('appai.info/spec'), locale);
    assert.ok(home.step3Desc.includes('appai.info/p/your-app'), locale);
    assert.ok(home.agentAuthorization.length > 0 && home.agentFallback.includes('llms-full.txt'), locale);
    const t = createTranslator({ locale, messages: { home }, namespace: 'home', onError: error => { throw error; } });
    for (const key of Object.keys(home).filter(key => key.startsWith('agent'))) {
      assert.ok(t(key, { slug: '{slug}', appId: '{appId}' }), locale + ': ' + key);
    }
  }
});

test('entry points lead with the overview and agent authorization rather than pasted dashboard keys', () => {
  const home = JSON.parse(read('src/messages/en.json')).home;
  for (const text of [JSON.stringify(home), quickstart, overview, layout]) {
    assert.doesNotMatch(text, /(?:generate|create|copy) (?:an? |your )?API key in (?:your |the )?dashboard/i);
    assert.doesNotMatch(text, /(?:give|paste|send) (?:your )?(?:AI )?(?:agent|Claude|GPT|Codex).*API key/i);
    assert.doesNotMatch(text, /two first-class publishing modes|6 preset templates|Before you start, ask the user for/i);
    assert.ok(positionOf(text, 'appai.info/spec') < positionOf(text, 'llms-full.txt'));
  }
  assert.match(home.agentAuthorization, /Open the link.*Google if asked.*check the code matches.*click Approve.*agent receives the key.*nothing to copy or paste/);
  assert.match(home.step2Desc, /sign in with Google if asked.*check the code matches.*click Approve.*agent receives the key.*nothing to copy or paste/);
  const agentSection = homepage.split('{/* For AI Agents */}')[1].split('{/* Featured Apps */}')[0];
  assert.ok(positionOf(agentSection, 't("readSpec")') < positionOf(agentSection, 't("agentAuthorization")'));
  assert.ok(positionOf(agentSection, 't("agentAuthorization")') < positionOf(agentSection, 't("agentFallback")'));
  assert.ok(positionOf(agentSection, 't("agentFallback")') < positionOf(agentSection, 't("agentSkillTitle")'));
  assert.doesNotMatch(agentSection, />[A-Za-z][^<{]*</, 'all visible copy uses home messages');
});

test('topic route whitelists seven files, preserves examples and includes section tracing', () => {
  const route = read('src/app/spec/[topic]/route.ts');
  assert.ok(route.includes('if (!topics.includes(topic))'));
  assert.match(route, /status: 404/);
  assert.match(route, /text\/plain; charset=utf-8/);
  assert.match(route, /public, max-age=3600/);
  const whitelist = route.match(/const topics\s*=\s*\[([^\]]*)\]/)?.[1];
  assert.ok(whitelist);
  assert.deepEqual([...whitelist.matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]), topics);
  assert.ok(read('src/app/spec/examples/[name]/route.ts').includes('GET'));
  assert.match(read('next.config.ts'), /"\/spec\/\[topic\]": \["\.\/docs\/spec\/\*\*"/);
});


test('entry points require explicit device approval and never promise automatic approval', () => {
  const sources = [...docs.values(), quickstart, homepage, layout, ...skillPaths.map(read), ...readmes.map(read), ...locales.map(locale => read(`src/messages/${locale}.json`))];
  for (const content of sources) {
    assert.doesNotMatch(content, /approved right away|approval is immediate|automatically approv|即座に承認|立即批准|立即核准|즉시 승인|Genehmigung sofort|approbation est immédiate|aprobación es inmediata|तुरंत अनुमति/i);
  }
  for (const locale of locales) {
    const home = JSON.parse(read(`src/messages/${locale}.json`)).home;
    assert.ok(home.step2Desc.includes('Google'), locale);
    assert.ok(home.agentAuthorization.includes('Google'), locale);
  }
  assert.doesNotMatch(JSON.parse(read('src/messages/ja.json')).home.faq1A, /ユーザーが/);
  assert.doesNotMatch(JSON.parse(read('src/messages/ko.json')).home.faq1A, /사용자가/);
  assert.doesNotMatch(JSON.stringify(JSON.parse(read('src/messages/de.json')).home), /Sage /);
  assert.match(JSON.parse(read('src/messages/fr.json')).home.faq9A, /requêtes.*gère.*manière/);
  assert.match(JSON.parse(read('src/messages/es.json')).home.faq9A, /autónoma/);
  assert.doesNotMatch(JSON.stringify(JSON.parse(read('src/messages/zh-CN.json')).home), /[「」]/);
});

test('layout metadata starts at the overview and lists four use-cases', () => {
  assert.match(layout, /"ai-agent-spec": "https:\/\/appai\.info\/spec"/);
  const instructions = layout.match(/"ai-agent-instructions": "([^"\n]+)"/)?.[1];
  assert.ok(instructions);
  assertOrder(instructions);
  assert.ok(positionOf(instructions, 'https://appai.info/spec') < positionOf(instructions, 'llms-full.txt'));
  assert.match(instructions, /complete single-file fallback/);
  assert.match(instructions, /Never submit organizationId, credentials, runtime URLs, SQL, or secrets\./);
  assert.match(homepage, /\{\/\* Agent discovery metadata lives in src\/app\/layout\.tsx\. \*\/\}/);
});

test('every topic ends with compact absolute All-topics navigation', () => {
  const labels = ['Overview', 'Authorization & API', 'Style & logo', 'Pages', 'Sections', 'Multi-language & multi-page', 'Tools', 'Universal App'];
  const expected = 'All topics: ' + ['overview', ...topics].map((topic, i) => `[${labels[i]}](https://appai.info/spec${topic === 'overview' ? '' : '/' + topic})`).join(' · ');
  for (const topic of topics) assert.equal(docs.get(topic)!.trimEnd().split('\n').at(-1), expected, topic);
  assert.match(docs.get('i18n')!, /^# AppAI — Multi-language & multi-page\n/);
  assert.match(docs.get('apps')!, /^# AppAI — Universal App\n/);
});

test('section index links every type to its schema and dry-run ends with publication', () => {
  const table = docs.get('pages')!.split('### 29 Section Types')[1].split('### Auto-Generated Features')[0];
  const rows = [...table.matchAll(/^\| \[`([\w-]+)`\]\((https:\/\/appai\.info\/spec\/(sections|tools)#[\w-]+)\) \|/gm)];
  assert.equal(rows.length, 29);
  for (const [, type, link] of rows) {
    assert.ok(link.endsWith('#' + type));
    checkLink(link, 'section index');
  }
  const api = docs.get('api')!;
  const dryRun = api.split('## Dry-run\n')[1].split('## Upload images')[0];
  assert.match(dryRun, /### Preview without saving/);
  assert.match(dryRun, /POST \/api\/v1\/pages\?dryRun=true` \(identical to `POST \/api\/v1\/pages\/preview`\)/);
  assert.ok(positionOf(dryRun, 'Preview without saving') < positionOf(dryRun, 'Publish with'));
  assert.match(dryRun, /Publish with `POST \/api\/v1\/pages` using the same body.*isPublished: true.*\?upsert=true/);
  assert.match(dryRun, /Open `https:\/\/appai\.info\/p\/\{slug\}`/);
  assert.match(api, /Universal App → return to.*spec\/apps#natural-release-flow/);
  assert.match(docs.get('apps')!, /for the key, then return here for the release steps/);
  assert.equal(nav('i18n').next, 'https://appai.info/spec/api#dry-run');
  for (const content of [...docs.values(), ...skillPaths.map(read)]) {
    assert.doesNotMatch(content, /(?<![(`])https:\/\/[^\s<>`]+\.(?=\s|$)/);
    assert.doesNotMatch(content, /alias: `POST \/api\/v1\/pages/);
  }
});

test('dry-run links forward to publish and retains its legacy anchor', () => {
  assert.ok(headingSlugs(docs.get('api')!).has('dry-run--publish'));
  assert.match(docs.get('api')!.split('## Dry-run\n')[1], /Next: \[Publish\]\(https:\/\/appai.info\/spec#publish-in-one-minute\)/);
  assert.match(read('skills/appai-publish/SKILL.md'), /# AppAI Publish\n\nStart at https:\/\/appai.info\/spec —/);
});

test('device instructions separate agent duties from human approval', () => {
  for (const path of ['docs/spec/api.md', 'docs/spec/overview.md', 'docs/spec/apps.md', 'src/app/llms.txt/route.ts', 'skills/appai-publish/SKILL.md', 'skills/appai-publish/references/universal-apps.md', 'README.md', 'mcp-server/src/index.ts']) {
    const content = read(path);
    assert.match(content, /open it in the user's own browser if you can, and always print it/ , path);
    assert.match(content, /The user signs in with Google if asked, checks that the code matches, and clicks Approve/ , path);
    assert.match(content, /Never approve it yourself/ , path);
    assert.match(content, /nothing to copy or paste/ , path);
  }
  const hi = JSON.parse(read('src/messages/hi.json')).home;
  for (const key of ['step2Desc', 'agentAuthorization']) {
    assert.ok(hi[key].includes('अनुमति दें'));
    assert.ok(!hi[key].includes('स्वीकृत करें'));
  }
});

test('Hosted Page guidance publishes four default locales without waiting for optional languages', () => {
  const rule = 'Hosted Pages are always published in four locales: English (`en`), Traditional Chinese (`zh-TW`), Simplified Chinese (`zh-CN`) and Spanish (`es`). Publish all four without asking the user. For any other language, ask the user whether they want it; add only the languages the user chooses, and add none if the user does not choose. Do not wait for that answer before publishing the four.';
  for (const content of [docs.get('i18n')!, docs.get('pages')!, overview, read('skills/appai-publish/SKILL.md'), read('skills/appai-publish/references/i18n.md')]) {
    assert.ok(content.includes(rule));
    assert.doesNotMatch(content, /2[-–]3 locale|language preferences|one regional language/i);
  }
  assert.ok(quickstart.includes(rule.replaceAll('`', '')));
  assert.match(homepage, /className="text-sm text-gray-400">\{t\("agentLanguages"\)\}/);
  for (const locale of locales) {
    const home = JSON.parse(read(`src/messages/${locale}.json`)).home;
    for (const code of ['en', 'zh-TW', 'zh-CN', 'es']) assert.ok(home.agentLanguages.includes(`(${code})`) || home.agentLanguages.includes(`（${code}）`), locale + ': ' + code);
    assert.ok(home.agentAuthorization.includes('user_code'), locale);
    assert.ok(home.agentSkillDesc.includes('GET /api/v1/sections'), locale);
  }
});
