// Optional visual regressions using an existing Playwright installation; no server or network.
// npm run build
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/browser-round5.mjs
// Add BROWSER_ENGINE=webkit to check an installed Playwright WebKit browser.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const engine = process.env.BROWSER_ENGINE === 'webkit' ? webkit : chromium;
const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {});
const files = new Map([
  ['/games/guess-duel/', await readFile(new URL('../dist/index.html', import.meta.url))],
]);
for (const name of await readdir(new URL('../dist/assets/', import.meta.url))) {
  files.set(
    '/games/guess-duel/assets/' + name,
    await readFile(new URL('../dist/assets/' + name, import.meta.url)),
  );
}
const sizes = [
  [375, 667],
  [390, 844],
  [667, 375],
  [844, 390],
  [768, 1024],
  [820, 1180],
  [1024, 1366],
  [1366, 1024],
  [1440, 900],
];

async function layout(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
    };
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.x >= 0 && r.right <= innerWidth;
    };
    const first = document.querySelector('.history-selected li');
    const middle = document.querySelector('.play-middle');
    const controls = [...document.querySelectorAll('button, summary')].filter(visible);
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      keys: [...document.querySelectorAll('.keypad button')].map(rect),
      slots: rect(document.querySelector('.guess-slots')),
      smallControls: controls.filter((el) => rect(el).height < 44).map((el) => el.outerHTML),
      first: first && rect(first),
      middle: middle && rect(middle),
      selectedText: first?.textContent.replace(/\s+/g, ''),
      visibleHistories: [...document.querySelectorAll('.history')].filter(visible).length,
      segments: [...document.querySelectorAll('.history-switch button')].filter(visible).length,
      viewportHeight: innerHeight,
    };
  });
}

function checkLayout(result, phone) {
  assert.equal(result.overflow, false, 'no horizontal scroll');
  assert.equal(result.keys.length, 12, 'the full keypad remains on screen');
  for (const key of result.keys) {
    assert.ok(key.width >= 64 && key.height >= 64, 'key targets stay at least 64px');
    assert.ok(key.y >= 0 && key.bottom <= result.viewportHeight, 'key stays in the viewport');
  }
  assert.ok(result.slots.bottom <= result.viewportHeight, 'guess slots stay visible');
  assert.deepEqual(result.smallControls, [], 'other controls stay at least 44px tall');
  if (phone) {
    assert.equal(result.segments, 2);
    assert.equal(result.visibleHistories, 1);
    assert.ok(result.first.y >= result.middle.y, 'newest entry starts inside the visible area');
    assert.ok(result.first.bottom <= result.middle.bottom, 'newest entry is fully visible');
  } else {
    assert.equal(result.segments, 0);
    assert.equal(result.visibleHistories, 2, 'wide views keep both histories');
  }
}

try {
  for (const locale of ['zh-TW', 'en']) {
    for (const n of [3, 4]) {
      for (const [width, height] of sizes) {
        const context = await browser.newContext({
          viewport: { width, height },
          hasTouch: width < 1000,
          isMobile: width < 900,
        });
        try {
          await context.route('**/*', async (route) => {
            const url = new URL(route.request().url());
            const body = url.origin === 'https://appai.info' && files.get(url.pathname);
            if (!body) return route.abort();
            return route.fulfill({
              body,
              contentType: url.pathname.endsWith('.js')
                ? 'text/javascript'
                : url.pathname.endsWith('.css')
                  ? 'text/css'
                  : 'text/html',
            });
          });
          const page = await context.newPage();
          await page.goto(`https://appai.info/games/guess-duel/?debug=1&locale=${locale}`);
          await page.selectOption('#digits', String(n));
          await page.evaluate(async (n) => {
            const act = window.__duelTest.act;
            await act({ type: 'mode', mode: 'same' });
            await act({ type: 'handover' });
            await act({ type: 'setSecret', code: n === 3 ? '987' : '9876' });
            await act({ type: 'handover' });
            await act({ type: 'setSecret', code: n === 3 ? '056' : '0561' });
            await act({ type: 'handover' });
          }, n);
          const phone = width <= 600;
          const initial = await layout(page);
          checkLayout(initial, phone);
          if (phone) {
            await page.locator('[data-action="ownHistory"]').click();
            assert.equal(
              await page.locator('.history-selected .empty').textContent(),
              locale === 'en' ? 'No guesses yet' : '還沒有猜測',
            );
          }
          await page.evaluate(async (n) => {
            const guesses =
              n === 3
                ? [
                    '123',
                    '012',
                    '234',
                    '013',
                    '345',
                    '014',
                    '456',
                    '015',
                    '567',
                    '016',
                    '678',
                    '017',
                    '789',
                    '018',
                    '891',
                    '019',
                  ]
                : [
                    '1234',
                    '0123',
                    '2345',
                    '0134',
                    '3456',
                    '0145',
                    '4567',
                    '0156',
                    '5678',
                    '0167',
                    '6789',
                    '0178',
                    '7891',
                    '0189',
                    '8912',
                    '0192',
                  ];
            for (const code of guesses) {
              await window.__duelTest.act({ type: 'guess', code });
              document.querySelector('[data-action="nextPlayer"]').click();
              await window.__duelTest.act({ type: 'handover' });
            }
          }, n);
          const populated = await layout(page);
          checkLayout(populated, phone);
          assert.deepEqual(populated.keys, initial.keys, 'histories never move the keypad');
          if (phone) {
            assert.ok(populated.selectedText.startsWith(n === 3 ? '019' : '0192'));
            for (const action of ['ownHistory', 'opponentHistory']) {
              await page.locator(`[data-action="${action}"]`).click();
              checkLayout(await layout(page), true);
            }
          }
          console.log(`${engine.name()} ${locale} N=${n} ${width}x${height}: passed`);
        } finally {
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
}
