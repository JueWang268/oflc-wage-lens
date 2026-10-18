const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {firefox}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:4178';
const output=path.join(__dirname,'../test-results');
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await firefox.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1080}}), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);await page.locator('#loading').waitFor({state:'hidden'});
    assert.equal(await page.locator('#occupation-select').inputValue(),'15-1252');
    assert.equal(await page.locator('#occupation-select option').count(),1845);
    assert.equal(await page.locator('#result-label').innerText(),'Level II');
    await page.screenshot({path:path.join(output,'occupations-desktop.png'),fullPage:true});
    async function choose(code){
      await page.locator('#occupation-search').fill('');await page.locator('#occupation-select').selectOption(code);
      await page.waitForFunction(()=>document.querySelector('#occupation-status').textContent==='');
      assert.equal(await page.locator('#occupation-select').inputValue(),code);
    }
    await page.locator('#state').selectOption('TX');
    await page.locator('#county-search').fill('Travis County, TX');await page.locator('#county-search').press('Enter');
    await choose('29-1141');
    assert.equal(await page.locator('#occupation-name').innerText(),'Registered Nurses');
    assert.equal(await page.locator('#result-label').innerText(),'Level IV+');
    assert.equal(await page.locator('#state').inputValue(),'TX');assert.match(await page.locator('#county-name').innerText(),/Travis/);
    await page.locator('#salary').fill('90000');
    assert.equal(await page.locator('#result-label').innerText(),'Level II');
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);
    const csv=fs.readFileSync(await download.path(),'utf8');assert.ok(csv.includes('"29-1141"'));assert.ok(csv.includes('"Registered Nurses"'));assert.equal(csv.split('\r\n').length,255);
    await page.locator('#occupation-search').fill('15-1252.00');
    await page.locator('#occupation-select').selectOption('15-1252.00');
    await page.waitForFunction(()=>document.querySelector('#occupation-status').textContent==='');
    assert.equal(await page.locator('#occupation-onet').innerText(),'15-1252.00');
    assert.equal(await page.locator('#occupation-soc').innerText(),'15-1252');
    await page.reload();await page.locator('#loading').waitFor({state:'hidden'});
    assert.equal(await page.locator('#occupation-select').inputValue(),'15-1252.00');
    await choose('25-1011');
    assert.match(await page.locator('#source-unit').innerText(),/Annual/);
    const rows=await page.locator('.threshold-values strong').allTextContents();
    const payload=require('../dist/data/occupations/25-1011.json');
    assert.equal(Number(rows[0].replace(/[^0-9.]/g,'')),payload.areas['12420'].levels[0]);
    await page.locator('#hour').click();
    assert.equal(Number((await page.locator('.threshold-values strong').first().innerText()).replace(/[^0-9.]/g,'')),Number((payload.areas['12420'].levels[0]/2080).toFixed(2)));
    await page.locator('#year').click();
    const before=await page.locator('#result-label').innerText();await page.locator('#occupation-search').fill('zzzz-no-match');
    assert.equal(await page.locator('#occupation-select').inputValue(),'25-1011');assert.equal(await page.locator('#result-label').innerText(),before);
    // A slower request must not recolor the map after a newer selection completes.
    let release, began;
    const delayed=new Promise(resolve=>release=resolve), started=new Promise(resolve=>began=resolve);
    await page.route('**/occupations/17-2051.json*',async route=>{began();await delayed;await route.continue();});
    await page.locator('#occupation-search').fill('');await page.locator('#occupation-select').selectOption('17-2051');await started;
    assert.equal(await page.locator('#download').isDisabled(),true);
    assert.equal(await page.locator('.county').first().getAttribute('fill'),'#cbd0ce');
    await choose('29-1141');release();await page.waitForResponse(r=>r.url().includes('/17-2051.json'));
    assert.equal(await page.locator('#occupation-name').innerText(),'Registered Nurses');
    await page.route('**/occupations/13-2011.json*',route=>route.fulfill({status:503,body:'unavailable'}));
    await page.locator('#occupation-select').selectOption('13-2011');await page.locator('#occupation-retry').waitFor({state:'visible'});
    assert.equal(await page.locator('#result-label').innerText(),'Occupation data unavailable');
    assert.equal(await page.locator('#download').isDisabled(),true);
    await page.unroute('**/occupations/13-2011.json*');await page.locator('#occupation-retry').click();
    await page.waitForFunction(()=>document.querySelector('#occupation-status').textContent==='');
    assert.equal(await page.locator('#occupation-soc').innerText(),'13-2011');
    // High-wage records have no four-level estimate; do not invent green areas.
    const high=require('../dist/data/occupations/29-1214.json');
    const geography=require('../dist/data/counties.json');
    const county=geography.counties.features.find(f=>high.areas[f.properties.area]?.label==='High Wage');
    await page.locator('#reset').click();await choose('29-1214');
    await page.locator('#county-search').fill(`${county.properties.name}, ${county.properties.state}`);await page.locator('#county-search').press('Enter');
    assert.equal(await page.locator('#result-label').innerText(),'Wage data unavailable');
    assert.match(await page.locator('#next-level').innerText(),/High-wage/);
    await choose('15-1252');await page.locator('#reset').click();
    for(const width of [390,320]) {
      await page.setViewportSize({width,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(output,`occupations-mobile-${width}.png`),fullPage:true});
    }
    await page.goto(`${base}?occupation=invalid-code`);await page.locator('#loading').waitFor({state:'hidden'});
    assert.equal(await page.locator('#occupation-select').inputValue(),'15-1252');
    assert.deepEqual(errors,[]);
    console.log('Occupation browser tests passed: default, 1,845 options, filtering, SOC/O*NET, units, CSV, bookmarks, races, failures, missing levels & mobile.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
