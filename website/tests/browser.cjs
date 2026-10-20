const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {firefox}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:4178';
(async()=>{
  fs.mkdirSync(path.join(__dirname,'../test-results'),{recursive:true});
  const browser=await firefox.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1080}});
  const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith(base))external.push(r.url());});
  await page.goto(base);
  await page.locator('#loading').waitFor({state:'hidden'});
  assert.equal(await page.locator('.masthead').count(),0,'No decorative header above the filters');
  const layout=await page.evaluate(()=>({
    top:document.querySelector('main').getBoundingClientRect().top,
    rows:['occupation-search','occupation-select','salary'].map(id=>document.getElementById(id).getBoundingClientRect().top),
    mapRows:['state','county-search','county-view'].map(id=>document.getElementById(id).getBoundingClientRect().bottom)
  }));
  assert.ok(layout.top<110,`Desktop filters should fit in a compact strip, got ${layout.top}px`);
  assert.ok(Math.max(...layout.rows)-Math.min(...layout.rows)<5,'Desktop inputs share one row');
  assert.ok(Math.max(...layout.mapRows)-Math.min(...layout.mapRows)<5,'State and county share the map-mode row');
  assert.equal(await page.locator('.county').count(),3144);
  assert.equal(await page.locator('.threshold').count(),4);
  assert.equal(await page.locator('.legend-item').count(),5);
  assert.equal(await page.locator('#map-title').count(),0);
  assert.equal(await page.locator('.legend-item small').count(),0);
  assert.equal(await page.locator('.legend-item strong').count(),5);
  assert.equal(await page.locator('.legend-item .count').count(),5);
  assert.equal(await page.locator('#result-label').innerText(),'Level II');
  assert.match(await page.locator('#county-name').innerText(),/Travis/);
  const initial=await page.locator('#result-label').innerText();
  await page.locator('#hour').click();await page.locator('#year').click();
  assert.equal(await page.locator('#salary').inputValue(),'120000');
  assert.equal(await page.locator('#result-label').innerText(),initial);
  await page.screenshot({path:path.join(__dirname,'../test-results/desktop.png'),fullPage:true});
  await page.locator('#salary').fill('119641.60');assert.equal(await page.locator('#result-label').innerText(),'Level II');
  await page.locator('#salary').fill('119641.59');assert.equal(await page.locator('#result-label').innerText(),'Level I');
  await page.locator('#salary').fill('');assert.equal(await page.locator('#salary-error').isVisible(),true);assert.equal(await page.locator('#download').isDisabled(),true);
  assert.equal(await page.locator('.county').first().getAttribute('fill'),'#cbd0ce');
  await page.locator('#salary').fill('300000');assert.equal(await page.locator('#result-label').innerText(),'Level IV+');
  await page.locator('#state').selectOption('CA');assert.match(await page.locator('#coverage').innerText(),/58 counties/);
  assert.ok(await page.locator('#map>g').getAttribute('transform'));
  await page.locator('#county-search').fill('Travis County, TX');await page.locator('#county-search').press('Enter');
  assert.match(await page.locator('#county-name').innerText(),/Travis/);assert.equal(await page.locator('#state').inputValue(),'');
  await page.locator('#reset').click();await page.locator('#salary').fill('120000');
  await page.locator('.county[data-fips="06085"]').click({force:true});
  assert.match(await page.locator('#county-name').innerText(),/Santa Clara/);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);
  const csv=fs.readFileSync(await download.path(),'utf8');assert.equal(csv.split('\r\n').length,3145);assert.ok(csv.includes('"06085"'));
  await page.reload();await page.locator('#loading').waitFor({state:'hidden'});assert.match(await page.locator('#county-name').innerText(),/Santa Clara/);
  for(const width of [1024,768,390,320]) {
    await page.setViewportSize({width,height:844});
    await page.screenshot({path:path.join(__dirname,`../test-results/mobile-${width}.png`),fullPage:true});
    const overflow=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>[el.tagName,el.id,el.className,el.getBoundingClientRect().right]).filter(row=>row[0]!=='path'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),JSON.stringify(overflow.slice(0,20)));
    assert.equal(await page.locator('.threshold').count(),4);
  }
  // Simulate a future visit without requiring changes to the machine clock.
  const future=await browser.newPage();
  await future.addInitScript(()=>{const Original=Date;window.Date=class extends Original{constructor(...a){super(...(a.length?a:['2028-01-01T12:00:00Z']));}static now(){return new Original('2028-01-01T12:00:00Z').getTime();}};});
  await future.goto(base);await future.locator('#loading').waitFor({state:'hidden'});assert.equal(await future.locator('#notice').isVisible(),true);
  const broken=await browser.newPage();await broken.route('**/data/counties.json',route=>route.fulfill({status:500,body:'error'}));
  await broken.goto(base);await broken.getByRole('button',{name:'Retry',exact:true}).waitFor();assert.equal(await broken.locator('#salary').isDisabled(),true);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await browser.close();console.log('Firefox passed: map, thresholds, salary boundaries, units, invalid input, state filter, search, selection, CSV, URL restore, responsive layout, expiry & failed-load recovery.');
})().catch(e=>{console.error(e);process.exit(1);});
