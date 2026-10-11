const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {firefox} = require(process.env.WAGE_LENS_NODE_MODULES ? path.join(process.env.WAGE_LENS_NODE_MODULES,'playwright') : 'playwright');
const data = require('../extension/data/software-developers.json');
const base = path.resolve(__dirname,'..');
(async () => {
  const browser = await firefox.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const outgoing=[]; page.on('request',r=>{if(!r.isNavigationRequest()) outgoing.push(r.url());});
  async function fixture(html, url, failData = false, dataset = data) {
    if (url) {
      // URL fragments are absent from HTTP requests; intercept all requests so fixtures never contact mail sites.
      await page.route('**/*', route => route.request().isNavigationRequest() ? route.fulfill({contentType:'text/html',body:html}) : route.abort());
      await page.goto(url); await page.unroute('**/*');
    } else { await page.goto('about:blank'); await page.setContent(html); }
    await page.evaluate(({data,failData})=>{
      window.failWageData=failData;
      window.wageUpdateState={enabled:true,kind:'current',lastSuccess:Date.now()};
      window.browser={runtime:{sendMessage:async message=>{
        if(message.type==='wage-lens-data') {if(window.failWageData) throw new Error('Test data unavailable');return data;}
        if(message.type==='wage-lens-update-enabled') window.wageUpdateState.enabled=message.enabled;
        return window.wageUpdateState;
      },onMessage:{addListener:fn=>window.toggleLens=fn}},storage:{onChanged:{addListener:fn=>window.updateStorage=fn}}};
    },{data:dataset,failData});
    for(const file of ['core.js','icons.js','content.js']) await page.addScriptTag({path:path.join(base,'extension',file)});
  }
  const sample=fs.readFileSync(path.join(__dirname,'fixture.html'),'utf8');
  await fixture(sample);
  await page.locator('#tier').waitFor();
  await page.waitForFunction(()=>document.querySelector('oflc-wage-lens')?.shadowRoot.querySelector('#tier').textContent==='Tier II to III');
  assert.match(await page.locator('#summary').textContent(),/Travis County, TX/);
  assert.equal(await page.locator('#levels tr').count(),4);
  assert.equal(await page.locator('#levels tr').first().isVisible(),true);
  assert.equal(await page.locator('#body').evaluate(el=>el.firstElementChild.getAttribute('for')),'locations');
  assert.equal(await page.locator('#locations').inputValue(),'0');
  assert.equal(await page.locator('#salaries').inputValue(),'0');
  fs.mkdirSync(path.join(base,'test-results'),{recursive:true});
  assert.equal(await page.locator('#spectrum').isVisible(),true);
  assert.equal(await page.locator('#pay-band').isVisible(),true);
  const rangeWidth=await page.locator('#pay-band').evaluate(el=>parseFloat(el.style.width));
  assert.ok(rangeWidth>42 && rangeWidth<43);
  await page.screenshot({path:path.join(base,'test-results','desktop.png')});
  await page.locator('#minimum').fill('119641.60'); await page.locator('#maximum').fill('');
  assert.equal(await page.locator('#tier').innerText(),'Tier II');
  assert.equal(await page.locator('#pay-band').isVisible(),false);
  assert.ok(Math.abs(await page.locator('#pay-start').evaluate(el=>parseFloat(el.style.left))-100/3)<0.001);
  await page.screenshot({path:path.join(base,'test-results','single.png')});
  await page.locator('#hour').click();
  assert.match(await page.locator('#bound-min').innerText(),/46\.10\/hr/);
  assert.ok(Math.abs(await page.locator('#pay-start').evaluate(el=>parseFloat(el.style.left))-100/3)<0.001);
  await page.locator('#year').click();
  for(let i=0;i<3;i++){await page.locator('#hour').click();await page.locator('#year').click();}
  assert.equal(await page.locator('#tier').innerText(),'Tier II');
  await page.locator('#minimum').fill('119641.59'); assert.equal(await page.locator('#tier').innerText(),'Tier I');
  await page.locator('#minimum').fill('160000'); await page.locator('#maximum').fill('120000');
  assert.equal(await page.locator('#tier').isVisible(),false);
  assert.equal(await page.locator('#spectrum').isVisible(),true);
  assert.equal(await page.locator('#pay-start').isVisible(),false);
  assert.equal(await page.locator('#pay-band').isVisible(),false);
  await page.locator('#minimum').fill('80000');await page.locator('#maximum').fill('200000');
  assert.match(await page.locator('#spectrum-overflow').innerText(),/below Level I.*above Level IV/);
  assert.equal(await page.locator('#pay-band').evaluate(el=>el.style.width),'100%');
  await page.screenshot({path:path.join(base,'test-results','overflow.png')});
  await page.locator('#minimum').fill('190000');
  assert.equal(await page.locator('#pay-band').isVisible(),false);
  assert.equal(await page.locator('#pay-start').evaluate(el=>el.style.left),'100%');
  await page.locator('#minimum').fill('120000');await page.locator('#maximum').fill('150000');
  await page.locator('#location-search').fill('King County WA'); await page.locator('#search-results button').filter({hasText:'King County, WA'}).click();
  assert.match(await page.locator('#summary').textContent(),/King County, WA/);
  await page.locator('#refresh').click(); await page.waitForFunction(()=>document.querySelector('oflc-wage-lens').shadowRoot.querySelector('#summary').textContent.includes('Travis County'));
  await page.setViewportSize({width:390,height:844}); await page.screenshot({path:path.join(base,'test-results','mobile.png')});
  const box=await page.locator('oflc-wage-lens').boundingBox(); assert.ok(box.x>=0 && box.x+box.width<=390);
  assert.ok(await page.locator('.body').evaluate(el=>el.scrollWidth<=el.clientWidth));
  await page.locator('#minimize').click();assert.equal(await page.locator('#body').isVisible(),false);
  await page.locator('#minimize').click();await page.locator('#close').click();assert.equal(await page.locator('oflc-wage-lens').isVisible(),false);
  await page.evaluate(()=>window.toggleLens({type:'wage-lens-toggle'})); await page.locator('#body').waitFor({state:'visible'});
  // Mutation updates do not parse the overlay's own dollar figures.
  await page.evaluate(()=>{document.querySelector('main').append(document.createElement('p'));});
  await page.waitForTimeout(1000); assert.equal(await page.locator('#salaries option').count(),2);
  // Recovery must retain the same controls, manual values and closed-panel intent.
  await page.locator('#minimum').fill('123456');
  await page.evaluate(() => { window.originalLens = document.querySelector('oflc-wage-lens'); window.originalLens.remove(); });
  await page.locator('oflc-wage-lens').waitFor({state:'visible'});
  assert.equal(await page.locator('#minimum').inputValue(),'123456');
  assert.equal(await page.evaluate(() => document.querySelector('oflc-wage-lens') === window.originalLens),true);
  await page.evaluate(() => {
    const next=document.documentElement.cloneNode(true);
    next.querySelector('oflc-wage-lens')?.remove();
    document.replaceChild(next,document.documentElement);
  });
  await page.locator('oflc-wage-lens').waitFor({state:'visible'});
  assert.equal(await page.locator('#minimum').inputValue(),'123456');
  // A toolbar click in the same task as removal must reopen, not hide a detached node.
  await page.evaluate(() => { document.querySelector('oflc-wage-lens').remove(); return window.toggleLens({type:'wage-lens-toggle'}); });
  assert.equal(await page.locator('oflc-wage-lens').isVisible(),true);
  await page.evaluate(() => window.toggleLens({type:'wage-lens-show'}));
  assert.equal(await page.locator('oflc-wage-lens').isVisible(),true);
  await page.locator('#close').click();
  await page.evaluate(() => document.querySelector('oflc-wage-lens').remove());
  await page.waitForTimeout(900);
  assert.equal(await page.locator('oflc-wage-lens').count(),0);
  await page.evaluate(() => window.toggleLens({type:'wage-lens-toggle'}));
  assert.equal(await page.locator('oflc-wage-lens').isVisible(),true);
  // The observer must follow a replacement body, and hydration must not dismiss a recognized job.
  await page.evaluate(() => { const body=document.createElement('body'); body.innerHTML='<main><h1>Loading</h1></main>'; document.body.replaceWith(body); });
  await page.waitForTimeout(900);
  assert.equal(await page.locator('oflc-wage-lens').isVisible(),true);
  await page.locator('#refresh').click();
  await page.evaluate(() => {document.querySelector('main').innerHTML='<h1>Software Engineer</h1><p>Location: Travis County, TX</p><h2>Responsibilities</h2><p>Base salary: $130,000 per year</p><button>Apply</button>';});
  await page.waitForFunction(() => document.querySelector('oflc-wage-lens').shadowRoot.querySelector('#minimum').value==='130000');
  await fixture(sample); await page.locator('#tier').waitFor();
  await page.evaluate(() => { document.querySelector('main').innerHTML='<h1>Loading</h1>'; });
  await page.waitForTimeout(900);
  assert.equal(await page.locator('oflc-wage-lens').isVisible(),true);
  await page.locator('oflc-wage-lens').waitFor({state:'hidden'});
  await page.evaluate(html => {document.querySelector('main').outerHTML=html;},sample.match(/<main>[\s\S]*<\/main>/)[0]);
  await page.locator('oflc-wage-lens').waitFor({state:'visible'});
  await page.evaluate(() => { document.querySelector('main').innerHTML='<h1>Recommended jobs</h1><h2>Software Engineer</h2><p>Responsibilities. Base salary: $150,000 per year</p><button>Apply now</button>'; });
  await page.locator('oflc-wage-lens').waitFor({state:'hidden'});
  await page.evaluate(() => { history.pushState({},'', '#account'); document.querySelector('main').innerHTML='<h1>Account settings</h1>'; });
  await page.locator('oflc-wage-lens').waitFor({state:'hidden'});
  await fixture(sample.replace('Travis County, TX','Remote').replace('Location: Remote','Location: Remote\nCompany headquarters: New York, NY'));
  await page.locator('#locations').waitFor();assert.equal(await page.locator('#locations').inputValue(),'');
  assert.equal(await page.locator('#status').isVisible(),false);
  assert.equal(await page.locator('#tier').isVisible(),false);
  await page.screenshot({path:path.join(base,'test-results','remote.png')});
  assert.equal(await page.locator('#spectrum').isVisible(),false);
  await fixture(sample.replace('$120,000 - $150,000', '$120,000+'));
  await page.locator('#tier').waitFor();
  assert.match(await page.locator('#spectrum-pay').innerText(),/Posted floor/);
  assert.equal(await page.locator('#pay-band').isVisible(),false);
  await fixture(sample.replace('Travis County, TX','Austin, TX; Seattle, WA'));
  await page.locator('#tier').waitFor();assert.equal(await page.locator('#locations option').count(),3);
  assert.equal(await page.locator('#locations').inputValue(),'0');
  assert.match(await page.locator('#tier').innerText(),/Tier/);
  await page.locator('#locations').selectOption('1');assert.equal(await page.locator('#locations').inputValue(),'1');
  await page.locator('#locations').selectOption('');assert.equal(await page.locator('#tier').isVisible(),false);
  await fixture(sample.replace('</main>','<p>Base salary: $180,000 per year</p></main>'));
  await page.locator('#tier').waitFor();
  assert.equal(await page.locator('#salaries option').count(),3);
  assert.equal(await page.locator('#salaries').inputValue(),'0');
  assert.equal(await page.locator('#minimum').inputValue(),'120000');
  await page.locator('#salaries').selectOption('1');
  await page.evaluate(()=>{document.querySelector('main').append(document.createElement('p'));});
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('#salaries').inputValue(),'1');
  assert.equal(await page.locator('#minimum').inputValue(),'180000');
  await fixture('<main><h1>Software Engineer</h1><p>Austin, TX</p><h2>Responsibilities</h2><p>Build software.</p><button>Apply</button></main>');
  await page.locator('#locations').waitFor();assert.match(await page.locator('#status').textContent(),/No usable USD/);
  assert.equal(await page.locator('#spectrum').isVisible(),true);
  assert.equal(await page.locator('#levels tr').first().isVisible(),true);
  assert.equal(await page.locator('#pay-start').isVisible(),false);
  assert.equal(await page.locator('#pay-end').isVisible(),false);
  await page.screenshot({path:path.join(base,'test-results','location-only.png')});
  const job={'@type':'JobPosting',title:'Software Engineer',jobLocation:{address:{addressLocality:'Austin',addressRegion:'TX',addressCountry:'US'}},baseSalary:{currency:'USD',value:{value:120000,unitText:'YEAR'}}};
  await fixture(sample.replace('</main>',`<script type="application/ld+json">${JSON.stringify(job)}</script></main>`));
  await page.locator('#tier').waitFor();assert.equal(await page.locator('#tier').innerText(),'Tier II');
  assert.match(await page.locator('#area').textContent(),/county not inferred/);
  assert.match(await page.locator('#evidence').textContent(),/structured data/);
  const second={...job,title:'Another role',baseSalary:{currency:'USD',value:{value:200000,unitText:'YEAR'}}};
  await fixture(sample.replace('</main>',`<script type="application/ld+json">${JSON.stringify({'@graph':[job,second]})}</script></main>`));
  assert.equal(await page.locator('oflc-wage-lens').count(),0);
  await page.evaluate(()=>window.toggleLens({type:'wage-lens-show'}));
  await page.locator('#tier').waitFor();assert.equal(await page.locator('#jobs option').count(),2);
  await page.locator('#jobs').selectOption('1');await page.waitForFunction(()=>document.querySelector('oflc-wage-lens').shadowRoot.querySelector('#tier').textContent==='Tier IV');
  // A client-side route change clears manually entered pay and location.
  await fixture(sample); await page.locator('#tier').waitFor();
  await page.locator('#minimum').fill('500000');await page.locator('#maximum').fill('');
  await page.evaluate(()=>{history.pushState({},'', '#new-job'); document.querySelector('main').innerHTML='<h1>Software Engineer</h1><p>Seattle, WA</p><p>Base salary: $100,000 per year</p><h2>Responsibilities</h2><button>Apply</button>';});
  await page.waitForFunction(()=>document.querySelector('oflc-wage-lens').shadowRoot.querySelector('#minimum').value==='100000');
  assert.match(await page.locator('#summary').textContent(),/Seattle, WA/);
  await fixture('<h1>Account settings</h1><p>Your subscription costs $20 per month.</p>');
  await page.waitForTimeout(300);assert.equal(await page.locator('oflc-wage-lens').count(),0);
  for (const url of ['https://mail.google.com/mail/u/0/#inbox','https://jobright.ai/jobs/recommended']) {
    await fixture(sample,url);
    await page.waitForTimeout(900);
    assert.equal(await page.locator('oflc-wage-lens').count(),0, url);
  }
  // Malformed metadata must not prevent a valid record from rendering.
  const malformed = {...job,jobLocation:[null,...[].concat(job.jobLocation)],baseSalary:[null,{currency:'USD',value:null},job.baseSalary]};
  await fixture(sample.replace('</main>',`<script type="application/ld+json">{broken</script><script type="application/ld+json">${JSON.stringify(malformed)}</script></main>`));
  await page.locator('#tier').waitFor(); assert.equal(await page.locator('#tier').innerText(),'Tier II');
  // Untrusted text is displayed literally, never parsed into active HTML.
  const malicious = {...job,title:'<img src=x onerror="window.wageLensXss=true">'};
  await fixture(sample.replace('</main>',`<script type="application/ld+json">${JSON.stringify(malicious)}</script></main>`));
  await page.locator('#tier').waitFor();
  assert.match(await page.locator('#evidence').textContent(), /<img/);
  assert.equal(await page.locator('#evidence img').count(),0);
  assert.equal(await page.evaluate(()=>window.wageLensXss),undefined);
  // Invalid commas must not be interpreted as an entirely different salary.
  await page.locator('#minimum').fill('120,00');
  assert.equal(await page.locator('#tier').isVisible(),false);
  await page.locator('#minimum').fill('$120,000');
  assert.equal(await page.locator('#tier').innerText(),'Tier II');
  // Re-injection must not duplicate UI or listeners.
  await page.addScriptTag({path:path.join(base,'extension/content.js')});
  assert.equal(await page.locator('oflc-wage-lens').count(),1);
  // A failed bridge is recoverable; controls must remain safe before data arrives.
  await fixture(sample, undefined, true);
  await page.evaluate(()=>window.toggleLens({type:'wage-lens-show'}));
  await page.locator('#status').waitFor();
  assert.match(await page.locator('#status').innerText(),/could not load/);
  await page.locator('#location-search').fill('Austin');
  await page.locator('#minimum').fill('120000');
  await page.locator('#hour').click();
  await page.evaluate(()=>{window.failWageData=false;});
  await page.locator('#refresh').click();
  await page.waitForFunction(()=>document.querySelector('oflc-wage-lens').shadowRoot.querySelector('#tier').textContent==='Tier II to III');
  await page.evaluate(()=>{
    window.wageUpdateState={enabled:true,kind:'update',changed:true,release:{start:'2026-07-01'},lastSuccess:Date.now()};
    window.updateStorage({wageLensUpdateStatus:{newValue:window.wageUpdateState}},'local');
  });
  assert.equal(await page.locator('#update-notice').isVisible(),true);
  assert.match(await page.locator('#update-notice').innerText(),/new or revised/);
  assert.equal(await page.locator('#update-notice').getAttribute('data-severity'),'danger');
  assert.equal(await page.locator('#update-notice').evaluate(el=>el.previousElementSibling.tagName),'HEADER');
  assert.match(await page.locator('#update-notice').innerText(),/raw-data/);
  await page.locator('details').evaluate(el=>{el.open=true;});
  await page.locator('#update-enabled').uncheck();
  await page.waitForFunction(()=>document.querySelector('oflc-wage-lens').shadowRoot.querySelector('#update-status').textContent.includes('checks are off'));
  assert.equal(await page.locator('#update-notice').isVisible(),true);
  assert.equal(await page.locator('#update-check').isDisabled(),true);
  await page.locator('#update-enabled').check();
  await page.locator('#update-notice').waitFor({state:'visible'});
  await page.screenshot({path:path.join(base,'test-results','update-notice.png')});
  const expired=structuredClone(data); expired.meta.validThrough='2020-06-30';
  await fixture(sample,undefined,false,expired);
  await page.locator('#update-notice').waitFor({state:'visible'});
  assert.match(await page.locator('#update-notice').innerText(),/expired on 2020-06-30/);
  await page.locator('#body').evaluate(el=>{el.scrollTop=el.scrollHeight;});
  assert.equal(await page.locator('#update-notice').isVisible(),true);
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:path.join(base,'test-results','expired-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(base,'test-results','expired-mobile.png')});
  for(const viewport of [{width:390,height:844},{width:320,height:480}]) {
    await page.setViewportSize(viewport);
    const panel=await page.locator('.panel').boundingBox();
    assert.ok(panel.y+panel.height<=viewport.height);
    assert.ok(await page.locator('#update-notice').evaluate(el=>el.scrollWidth<=el.clientWidth));
    assert.ok(await page.locator('#body').evaluate(el=>el.clientHeight>0));
  }
  assert.deepEqual(errors,[]); assert.deepEqual(outgoing,[]);
  await browser.close(); console.log('Firefox DOM tests passed: spectrum, lifecycle, overrides, malformed metadata, untrusted text, data-load recovery, zero outgoing page requests, desktop/mobile.');
})().catch(e=>{console.error(e);process.exit(1);});
