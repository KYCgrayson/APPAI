/* Browser E2E. Run against the local preview; never writes platform data.
 * NODE_PATH=<Playwright package directory> node scripts/qa-platform-directory.cjs
 * Optional: QA_BASE_URL, QA_OUTPUT_DIR, QA_EXISTING_PAGE.
 */
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');

const base = process.env.QA_BASE_URL || 'http://localhost:3100';
const output = process.env.QA_OUTPUT_DIR || '/private/tmp/appai-platform-directory-qa';
const results = [];
let browser;

async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.message }); }
}
function assert(value, message) { if (!value) throw new Error(message); }

(async () => {
  await fs.mkdir(output, { recursive: true });
  browser = await chromium.launch({ headless: true, channel: process.env.QA_BROWSER_CHANNEL || 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
  await context.route('**/api/p/track/view', route => route.fulfill({ status: 204 }));
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const visit = async (route) => {
    await context.clearCookies();
    const response = await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    assert(response, `No response: ${route}`);
    return response;
  };
  const screenshot = async (name) => page.screenshot({ path: path.join(output, name), fullPage: true });
  const noOverflow = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Horizontal overflow');

  await check('Home exposes three working directory entrances', async () => {
    assert((await visit('/')).status() === 200, 'Home not available');
    for (const href of ['/websites', '/tools', '/apps?kind=apps']) {
      assert(await page.locator(`a[href="${href}"]`).count(), `Missing entrance: ${href}`);
    }
    await screenshot('home-desktop.png');
  });
  await check('Websites links to Grayson; navigation opens the profile', async () => {
    assert((await visit('/websites')).status() === 200, 'Websites not available');
    const link = page.locator('a[href="/people/grayson"]').first();
    assert(await link.count(), 'Profile missing from websites');
    assert(await page.locator('a[href="/p/demo-portfolio"]').count(), 'Existing portfolio website missing');
    await screenshot('websites-desktop.png');
    await link.click();
    await page.waitForURL('**/people/grayson');
    assert(await page.getByRole('heading', { name: 'Grayson', exact: true }).count(), 'Profile heading missing');
    for (const name of ['ChefChef', 'MedLogAI', 'APAC commercial development', 'Cross-border delivery', 'AI product building']) {
      assert(await page.getByRole('heading', { name: new RegExp(`^${name}(?:\\s|$)`) }).count(), `Missing profile content: ${name}`);
    }
    const profileText = await page.textContent('body');
    assert(!/Meyer Burger|Chroma ATE/.test(profileText), 'Company details remain on personal site');
    await screenshot('profile-desktop.png');
    await noOverflow();
  });
  await check('Profile anchors and external project links are usable', async () => {
    await visit('/people/grayson');
    for (const id of ['projects', 'experience', 'contact']) {
      const link = page.locator(`a[href="#${id}"]`).first();
      await link.click();
      assert(await page.locator(`#${id}`).count(), `Anchor target missing: ${id}`);
      assert(new URL(page.url()).hash === `#${id}`, `Anchor did not navigate: ${id}`);
    }
    assert(await page.locator('a[href="https://chefchef.app/"]').count(), 'Verified ChefChef link missing');
    assert(!(await page.locator('a[href="mailto:"],a[href="#"],a[download]').count()), 'Unusable contact/download link');
  });
  await check('Tools and Apps views load without mixing in personal site', async () => {
    for (const route of ['/tools', '/apps?kind=apps']) {
      assert((await visit(route)).status() === 200, `${route} unavailable`);
      assert(!(await page.locator('a[href="/people/grayson"]').count()), 'Personal profile in wrong form');
      if (route === '/tools') {
        assert(await page.locator('a[href="/p/wheel-spinner"]').count(), 'Known Wheel Spinner tool missing');
        assert(!(await page.locator('a[href="/p/medlogai"]').count()), 'MedLogAI product mixed into tools');
      } else {
        assert(await page.locator('a[href="/p/medlogai"]').count(), 'Known MedLogAI product missing');
        assert(!(await page.locator('a[href="/p/wheel-spinner"]').count()), 'Wheel Spinner mixed into apps');
        assert(!(await page.locator('a[href="/p/demo-portfolio"]').count()), 'Portfolio website mixed into apps');
      }
      await noOverflow();
    }
    await screenshot('apps-desktop.png');
  });
  await check('Purpose filter keeps Tools form; profile excluded from finance', async () => {
    await visit('/tools?category=MEDIA');
    assert(await page.locator('a[href="/tools?category=SOCIAL"]').count(), 'Purpose filter lost product form');
    await visit('/apps?kind=apps&category=MEDIA');
    assert(await page.locator('a[href="/apps?kind=apps&category=SOCIAL"]').count(), 'Apps filter lost form');
    await visit('/websites?category=FINANCE');
    assert(!(await page.locator('a[href="/people/grayson"]').count()), 'Unrelated profile shown for Finance');
  });
  await check('Chinese URLs retain locale through directory and profile', async () => {
    assert((await visit('/zh-TW/websites')).status() === 200, 'Chinese directory unavailable');
    assert(await page.locator('a[href="/zh-TW/people/grayson"]').count(), 'Profile link lost locale');
    await page.locator('a[href="/zh-TW/people/grayson"]').first().click();
    await page.waitForURL('**/zh-TW/people/grayson');
    assert((await page.textContent('body')).includes('商務'), 'Chinese profile content missing');
    assert(!/Meyer Burger|Chroma ATE/.test(await page.textContent('body')), 'Company details remain in Traditional Chinese');
    await screenshot('profile-zh-TW.png');
    assert((await visit('/zh-CN/people/grayson')).status() === 200, 'Simplified Chinese profile unavailable');
    assert(!/Meyer Burger|Chroma ATE/.test(await page.textContent('body')), 'Company details remain in Simplified Chinese');
  });
  await check('Unknown profile returns 404 and no personal content', async () => {
    const response = await visit('/people/no-such-person-qa');
    assert(response.status() === 404, `Unknown profile returned ${response.status()}`);
    assert(!(await page.getByRole('heading', { name: 'Grayson', exact: true }).count()), 'Unknown profile leaked content');
  });
  await check('Profile metadata and sitemap expose the reviewed language variants', async () => {
    await visit('/people/grayson');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    assert(canonical?.endsWith('/people/grayson'), 'Incorrect profile canonical');
    for (const language of ['en', 'zh-TW', 'zh-CN']) {
      assert(await page.locator(`link[rel="alternate"][hreflang="${language}"]`).count(), `Missing language: ${language}`);
    }
    const response = await context.request.get(`${base}/sitemap.xml`);
    assert(response.ok(), 'Sitemap unavailable');
    const xml = await response.text();
    assert(xml.includes('/people/grayson'), 'Published profile absent from sitemap');
    assert(!xml.includes('/people/no-such-person-qa'), 'Unknown profile present in sitemap');
  });
  await check('Existing complete directory and representative hosted page survive', async () => {
    assert((await visit('/apps')).status() === 200, 'Legacy directory unavailable');
    if (!process.env.QA_EXISTING_PAGE) throw new Error('Set QA_EXISTING_PAGE to an existing published /p/... URL path');
    assert((await visit(process.env.QA_EXISTING_PAGE)).status() === 200, 'Existing hosted page unavailable');
  });
  await check('Mobile directory navigation and profile have no overflow', async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    await visit('/websites');
    for (const href of ['/websites', '/tools', '/apps?kind=apps']) {
      assert(await page.locator(`header a[href="${href}"]`).isVisible(), `Mobile entrance hidden: ${href}`);
    }
    await noOverflow();
    await screenshot('websites-mobile.png');
    await page.locator('a[href="/people/grayson"]').first().click();
    await page.waitForURL('**/people/grayson');
    await noOverflow();
    await screenshot('profile-mobile.png');
  });
  await check('Navigation receives keyboard focus', async () => {
    await visit('/websites');
    const target = page.locator('header a[href="/tools"]');
    await target.focus();
    assert(await target.evaluate(element => element === document.activeElement), 'Tools cannot receive focus');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/tools');
  });
  const report = { base, createdAt: new Date().toISOString(), results, passed: results.every(result => result.passed) };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
})().catch(async error => {
  console.error(error.message);
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ base, results, passed: false, fatal: error.message }, null, 2));
  process.exitCode = 1;
}).finally(async () => { if (browser) await browser.close(); });
