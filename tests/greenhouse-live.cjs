// Read-only public-page regression check in a disposable Firefox profile.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {firefox} = require(process.env.WAGE_LENS_NODE_MODULES ? path.join(process.env.WAGE_LENS_NODE_MODULES, 'playwright') : 'playwright');
const data = require('../extension/data/software-developers.json');
const base = path.resolve(__dirname, '..');
const url = process.env.TEST_JOB_URL || 'https://job-boards.greenhouse.io/embed/job_app?for=t2systems&token=4675527006';
(async () => {
  const browser = await firefox.launch({headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
    page.on('console', msg => {if (msg.text().includes('OFLC')) console.log(msg.text());});
    page.on('pageerror', error => console.log('Page error:', error.message));
    const source = ['core.js', 'icons.js', 'content.js'].map(file => fs.readFileSync(path.join(base, 'extension', file), 'utf8')).join('\n');
    await page.addInitScript({content: `
      window.browser = {runtime: {sendMessage: async () => {window.lensEvents.push('data requested'); return (${JSON.stringify(data)});}, onMessage: {addListener: fn => window.toggleLens = fn}}};
      window.lensEvents = [];
      new MutationObserver(records => records.forEach(r => {
        for (const node of r.removedNodes) if (node.nodeName === 'OFLC-WAGE-LENS' || node.querySelector?.('oflc-wage-lens')) window.lensEvents.push('host or ancestor removed from ' + r.target.nodeName);
      })).observe(document, {childList: true, subtree: true});
      addEventListener('DOMContentLoaded', () => {${source}\n}, {once: true});
    `});
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 45000});
    for (const delay of [100, 1000, 3000, 5000]) {
      await page.waitForTimeout(delay);
      console.log(JSON.stringify(await page.evaluate(() => {
        const host = document.querySelector('oflc-wage-lens');
        return {url: location.href, host: !!host, hidden: host?.hidden, loaded: window.__wageLensLoaded, events: window.lensEvents, heading: document.querySelector('h1')?.textContent};
      })));
    }
    assert.equal(await page.locator('oflc-wage-lens').isVisible(), true, 'Panel survives Greenhouse hydration');
    await page.evaluate(() => window.toggleLens({type: 'wage-lens-toggle'}));
    assert.equal(await page.locator('oflc-wage-lens').isVisible(), false);
    await page.evaluate(() => window.toggleLens({type: 'wage-lens-toggle'}));
    await page.waitForTimeout(1000);
    console.log('Events:', await page.evaluate(() => window.lensEvents));
    console.log('After toolbar toggle:', await page.locator('oflc-wage-lens').count());
    assert.equal(await page.locator('oflc-wage-lens').isVisible(), true, 'Toolbar reopens panel');
    fs.mkdirSync(path.join(base, 'test-results'), {recursive: true});
    await page.screenshot({path: path.join(base, 'test-results', 'greenhouse-live.png')});
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
