/* eslint-disable @typescript-eslint/no-require-imports -- Standalone opt-in Playwright QA. */
/* Run with Node on PATH: node scripts/stress-video-first-click.cjs
 * Playwright must already be available (NODE_PATH may point to an existing install).
 * No npm test integration, downloads, database, .env or app-server setup needed.
 * Bundles the real VideoPlayer with installed TypeScript/Next webpack and serves
 * a loopback fixture. Uses real YouTube, 20 fresh contexts per Chrome profile.
 * Optional: QA_VIDEO_ID (embeddable 11-character ID), QA_VIDEO_TIME (default 90).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { webpack } = require('next/dist/compiled/webpack/webpack');

const root = path.resolve(__dirname, '..');
const videoId = process.env.QA_VIDEO_ID || 'M7lc1UVf-VE'; // YouTube API's public example
const target = Number(process.env.QA_VIDEO_TIME || 90);
assert.match(videoId, /^[A-Za-z0-9_-]{11}$/);
assert.ok(Number.isSafeInteger(target) && target > 1 && target <= 86400);

async function bundle(directory) {
  const entry = path.join(directory, 'entry.jsx');
  const loader = path.join(directory, 'typescript-loader.cjs');
  await fs.writeFile(loader, `const ts = require(${JSON.stringify(require.resolve('typescript'))});
    module.exports = function(source) { return ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
    }).outputText; };`);
  await fs.writeFile(entry, `
    import React, { useEffect } from 'react';
    import { createRoot } from 'react-dom/client';
    import { VideoPlayer } from ${JSON.stringify(path.join(root, 'src/templates/sections/VideoPlayer.tsx'))};
    import { videoStrings } from ${JSON.stringify(path.join(root, 'src/templates/sections/video-strings.ts'))};
    function Harness() {
      useEffect(() => { window.__videoHarnessReady = true; }, []);
      return React.createElement(VideoPlayer, {
        video: { kind: 'youtube', id: ${JSON.stringify(videoId)}, url: 'https://www.youtube.com/watch?v=${videoId}' },
        sectionId: 'intro', startAt: 0, title: 'YouTube first-click QA', themeColor: '#334455',
        strings: videoStrings('en'), priority: true,
        thumbnail: 'https://i.ytimg.com/vi/${videoId}/hqdefault.jpg'
      });
    }
    createRoot(document.getElementById('player')).render(React.createElement(Harness));`);
  const compiler = webpack({
    mode: 'production', target: 'web', entry, devtool: false,
    output: { path: directory, filename: 'player.js' },
    resolve: { extensions: ['.js', '.jsx', '.ts', '.tsx'], alias: { '@': path.join(root, 'src') }, modules: [path.join(root, 'node_modules')] },
    module: { rules: [{ test: /\.tsx?$/, use: loader }] },
    optimization: { minimize: false },
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => {
    compiler.close(closeError => {
      if (error || closeError) reject(error || closeError);
      else if (stats.hasErrors()) reject(new Error(stats.toString({ all: false, errors: true })));
      else resolve();
    });
  }));
  return fs.readFile(path.join(directory, 'player.js'));
}

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'appai-video-first-click-'));
  let browser;
  let server;
  const results = [];
  try {
    const js = await bundle(directory);
    server = http.createServer((request, response) => {
      if (request.url === '/player.js') {
        response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
        response.end(js);
      } else {
        response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
        response.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Video first-click stress fixture</title><style>body{margin:12px;font:16px sans-serif}section{max-width:960px;margin:auto}
          #player>div:first-child>div{position:relative}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
          #player>div:first-child a{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}img{width:100%;height:100%;object-fit:cover}svg{position:absolute;width:48px;height:48px}
          #moment{display:inline-block;padding:16px}</style><section id="intro"><div id="player"></div>
          <a id="moment" data-video-time="${target}" href="https://www.youtube.com/watch?v=${videoId}&amp;t=${target}s">First moment</a></section>
          <script src="/player.js"></script></html>`);
      }
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const url = `http://127.0.0.1:${server.address().port}/`;
    const { chromium, devices } = require('playwright');
    browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--mute-audio'] });
    const profiles = [
      ['desktop', devices['Desktop Chrome']],
      ['iPhone', { ...devices['iPhone 13'], defaultBrowserType: 'chromium' }],
      ['Android', devices['Pixel 5']],
    ];
    for (const [profile, options] of profiles) {
      for (let run = 1; run <= 20; run++) {
        const context = await browser.newContext(options);
        const result = { profile, run, passed: false, messages: [], network: [] };
        try {
          const page = await context.newPage();
          page.on('requestfailed', request => result.network.push({ url: request.url(), error: request.failure()?.errorText }));
          await page.addInitScript(({ target }) => {
            window.__videoStress = { confirmed: false, currentTime: null, playerState: null, messages: [] };
            window.addEventListener('message', event => {
              if (event.source !== document.querySelector('iframe')?.contentWindow || event.origin !== 'https://www.youtube-nocookie.com') return;
              let message;
              try { message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
              if (!message || typeof message !== 'object') return;
              const info = message.info;
              const s = window.__videoStress;
              if (message.event === 'infoDelivery' && typeof info?.currentTime === 'number') {
                s.currentTime = info.currentTime;
                if (Math.abs(info.currentTime - target) <= 1) s.confirmed = true;
              }
              const state = message.event === 'onStateChange' ? info : info?.playerState;
              if (typeof state === 'number') s.playerState = state;
              s.messages.push({ ms: Math.round(performance.now()), event: message.event, time: s.currentTime, state: s.playerState });
            });
          }, { target });
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          await page.waitForFunction(() => window.__videoHarnessReady);
          assert.equal(await page.locator('iframe').count(), 0, 'Fresh facade must not load an iframe');
          await page.locator('#moment').click(); // exactly one first moment click
          await page.waitForFunction(() => {
            const text = document.querySelector('[role="status"]')?.textContent || '';
            return text.startsWith('Jumped to ') || text.includes('could not load');
          }, undefined, { timeout: 16000 });
          const first = await page.evaluate(() => ({ ...window.__videoStress, status: document.querySelector('[role="status"]')?.textContent }));
          assert.ok(first.confirmed, `Unconfirmed position: ${first.status}; currentTime=${first.currentTime}`);
          // Observe the blocked-playback grace period too, without clicking again.
          await page.waitForTimeout(2000);
          const final = await page.evaluate(() => ({ ...window.__videoStress, status: document.querySelector('[role="status"]')?.textContent }));
          assert.ok(final.status?.startsWith('Jumped to '), final.status);
          assert.ok(!final.status.includes('press play') || ![1, 3].includes(final.playerState), 'Playing/buffering must not be reported as blocked');
          result.passed = true;
        } catch (error) {
          result.error = error.message;
        } finally {
          const page = context.pages()[0];
          if (page) Object.assign(result, await page.evaluate(() => ({ ...window.__videoStress, status: document.querySelector('[role="status"]')?.textContent })).catch(() => ({})));
          await context.close();
        }
        results.push(result);
        console.log(JSON.stringify(result));
      }
    }
    for (const [profile] of profiles) {
      const rows = results.filter(result => result.profile === profile);
      console.log(`${profile}: ${rows.filter(result => result.passed).length}/${rows.length} passed (fresh contexts, first click)`);
    }
    if (results.some(result => !result.passed)) process.exitCode = 1;
  } finally {
    try { if (browser) await browser.close(); }
    finally {
      try { if (server?.listening) await new Promise(resolve => server.close(resolve)); }
      finally { await fs.rm(directory, { recursive: true, force: true }); }
    }
  }
}

main().catch(error => { console.error(`Video stress QA could not complete: ${error.stack}`); process.exitCode = 1; });
