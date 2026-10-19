const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,firefox}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:4178';
const live=process.env.LIVE_TILES==='1';
const output=path.join(__dirname,'../test-results');

(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=process.env.BROWSER==='firefox'?await firefox.launch({headless:true}):await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1100}});
    const errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(!r.url().startsWith(base)) external.push(r.url());});
    if(!live) {
      // Deterministic basemap fixture: tests don't depend on a public tile service.
      await page.route('https://tiles.openfreemap.org/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({
        version:8,sources:{fixture:{type:'geojson',attribution:'OpenFreeMap test fixture',data:{type:'FeatureCollection',features:[
          {type:'Feature',geometry:{type:'LineString',coordinates:[[-98,30],[-97,31]]},properties:{}}
        ]}}},layers:[{id:'background',type:'background',paint:{'background-color':'#f2f1ed'}},
          {id:'fixture-road',type:'line',source:'fixture',paint:{'line-color':'#fff','line-width':3}}]
      })}));
    }
    await page.goto(base);await page.locator('#loading').waitFor({state:'hidden'});
    assert.equal(external.length,0,'County view must not request external basemaps');
    await page.locator('#street-view').click();
    await page.locator('#streets[data-ready="true"]').waitFor({timeout:60000});
    assert.equal(await page.locator('#street-status').isVisible(),false);
    assert.match(await page.locator('#county-name').innerText(),/Travis/);
    assert.equal(await page.locator('#street-view').getAttribute('aria-pressed'),'true');
    assert.ok(await page.locator('.maplibregl-ctrl-attrib').isVisible());
    const colors=await page.locator('.maplibregl-canvas').evaluate(canvas=>{
      const gl=canvas.getContext('webgl2');const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
      gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      const colors=new Set();for(let i=0;i<pixels.length;i+=80) colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);return colors.size;
    });
    assert.ok(colors>8,`Nonblank county/basemap canvas expected, got ${colors} colors`);
    await page.screenshot({path:path.join(output,`streets-${live?'live':'fixture'}-desktop.png`),fullPage:true});
    await page.locator('#salary').fill('300000');assert.equal(await page.locator('#result-label').innerText(),'Level IV+');
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const greenFraction=await page.locator('.maplibregl-canvas').evaluate(canvas=>{
      const gl=canvas.getContext('webgl2'),pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
      gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let green=0,total=0;for(let i=0;i<pixels.length;i+=80){total++;if(pixels[i+1]>pixels[i]*1.2 && pixels[i+1]>pixels[i+2]*1.05)green++;}return green/total;
    });
    assert.ok(greenFraction>0.3,`Salary change should repaint the county green, got ${greenFraction}`);
    await page.locator('#occupation-select').selectOption('15-1252.00');
    await page.waitForFunction(()=>document.querySelector('#occupation-status').textContent==='');
    await page.locator('#county-search').fill('Santa Clara County, CA');await page.locator('#county-search').press('Enter');
    assert.match(await page.locator('#county-name').innerText(),/Santa Clara/);
    await page.locator('#zoom-in').click();await page.locator('#zoom-out').click();
    await page.locator('#streets[data-ready="true"]').waitFor({timeout:60000});
    await page.locator('.maplibregl-canvas').click();
    assert.match(await page.locator('#county-name').innerText(),/Santa Clara/);
    await page.locator('#county-view').click();assert.equal(await page.locator('#map').isVisible(),true);
    assert.equal(await page.locator('#salary').inputValue(),'300000');
    assert.equal(await page.locator('#occupation-select').inputValue(),'15-1252.00');
    await page.locator('#street-view').click();
    for(const width of [390,320]) {
      await page.setViewportSize({width,height:844});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.locator('#streets[data-ready="true"]').waitFor({timeout:60000});
      await page.screenshot({path:path.join(output,`streets-${live?'live':'fixture'}-${width}.png`),fullPage:true});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.ok(await page.locator('.maplibregl-ctrl-attrib').isVisible());
    }
    // A failed remote style is recoverable without breaking county comparisons.
    const offline=await browser.newPage();
    await offline.route('https://tiles.openfreemap.org/**',route=>route.abort());
    await offline.goto(base);await offline.locator('#loading').waitFor({state:'hidden'});
    await offline.locator('#street-view').click();
    await offline.locator('#street-status button').waitFor({timeout:35000});
    await offline.locator('#county-view').click();
    assert.equal(await offline.locator('#map').isVisible(),true);
    assert.equal(await offline.locator('#result-label').innerText(),'Level II');
    await offline.unroute('https://tiles.openfreemap.org/**');
    await offline.route('https://tiles.openfreemap.org/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#f2f1ed'}}]})}));
    await offline.locator('#street-view').click();
    await offline.locator('#streets[data-ready="true"]').waitFor({timeout:30000});
    assert.equal(await offline.locator('#street-status').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log(`Street view passed (${live?'live tiles':'offline fixture'}): nonblank canvas, attribution, modes, salary, occupation, county, zoom, mobile & network failure.`);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
