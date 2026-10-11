const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {firefox} = require('playwright');
(async()=>{
  const browser = await firefox.launch({headless:true});
  try {
    const page = await browser.newPage();
    const requests=[];
    await page.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
    await page.goto('about:blank');
    await page.addScriptTag({path:path.join(__dirname,'../extension/monitor.js')});
    const html='<script>window.remoteExecuted=true</script><img src="https://evil.test/image"><iframe src="https://evil.test/frame"></iframe><table><tr><td>7/2026 - 6/2027</td><td>July 1, 2026</td><td><a href="/sites/default/files/wages/OFLC_Wages_2026-27.zip">Wage files</a></td></tr></table>';
    const records = await page.evaluate(html=>WageLensMonitor.parseHTML(html),html);
    assert.equal(records[0].updated,'2026-07-01');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(()=>window.remoteExecuted),undefined);
    assert.deepEqual(requests,[],'Parsing DOL HTML must not load embedded resources');
    if (process.env.TEST_DOL_HTML) {
      const actual = await page.evaluate(html=>WageLensMonitor.parseHTML(html),fs.readFileSync(process.env.TEST_DOL_HTML,'utf8'));
      assert.ok(actual.length>0);
      console.log('Downloaded official listing parsed:',JSON.stringify(actual[0]));
    }
    console.log('Firefox monitor parser passed: inert HTML, official links, no embedded requests.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
