// Installs temporarily in web-ext's disposable profile. Never touches a personal profile.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const {spawn} = require('node:child_process');
const assert = require('node:assert/strict');
const base = path.resolve(__dirname, '..');
let child, timer, temporarySource;
let resolveResult;
const result = new Promise(resolve => {resolveResult=resolve;});
const sample = fs.readFileSync(path.join(__dirname,'fixture.html'),'utf8');
const probe = `<script>
let attempts=0;
const poll=setInterval(()=>{
  const root=document.querySelector('oflc-wage-lens')?.shadowRoot;
  if(root?.querySelector('#tier')?.textContent.includes('Tier') && root?.querySelector('#update-status')?.textContent.includes('No newer')) {
    clearInterval(poll);
    fetch('/result', {method:'POST',body:JSON.stringify({tier:root.querySelector('#tier').textContent,summary:root.querySelector('#summary').textContent,rows:root.querySelectorAll('#levels tr').length,spectrum:!root.querySelector('#spectrum').hidden,range:!root.querySelector('#pay-band').hidden,monitor:root.querySelector('#update-status').textContent})});
  } else if(++attempts===10) location.reload();
},500);
</script>`;
const server=http.createServer((req,res)=>{
  if(req.method==='POST' && req.url==='/result') {
    let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{res.end('ok');resolveResult(JSON.parse(body));});
  }else {res.setHeader('Content-Type','text/html');res.end(sample.replace('</html>',probe+'</html>'));}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/job`;
  // Replace only the public DOL network response in an isolated source copy.
  // Monitor parsing, scheduling, storage, messaging and UI use production code.
  temporarySource=fs.mkdtempSync(path.join(os.tmpdir(),'wage-lens-smoke-'));
  fs.cpSync(path.join(base,'extension'),temporarySource,{recursive:true});
  const dol='<table><tr><td>7/2026 - 6/2027</td><td>July 1, 2026</td><td><a href="https://flag.dol.gov/sites/default/files/wages/OFLC_Wages_2026-27.zip">Wage files</a></td></tr></table>';
  if (!process.env.TEST_LIVE_DOL) {
    fs.writeFileSync(path.join(temporarySource,'test-network.js'),`const originalFetch=globalThis.fetch;globalThis.fetch=(url,options)=>url==='https://flag.dol.gov/wage-data/wage-data-downloads'?Promise.resolve(new Response(${JSON.stringify(dol)},{headers:{'content-type':'text/html'}})):originalFetch(url,options);`);
    const manifest=JSON.parse(fs.readFileSync(path.join(temporarySource,'manifest.json'),'utf8'));
    manifest.background.scripts.unshift('test-network.js');
    fs.writeFileSync(path.join(temporarySource,'manifest.json'),JSON.stringify(manifest));
  }
  const firefox = process.env.TEST_FIREFOX || (process.platform === 'darwin' ? '/Applications/Firefox.app/Contents/MacOS/firefox' : 'firefox');
  const args=['run','--source-dir',temporarySource,'--no-reload','--no-input','--no-config-discovery','--firefox',firefox,'--args=-headless','--start-url',url];
  child=spawn(path.join(base,'node_modules/.bin/web-ext'),args,{cwd:base,detached:true,env:{...process.env,NO_UPDATE_NOTIFIER:'1'},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',b=>process.stdout.write(b));child.stderr.on('data',b=>process.stderr.write(b));
  const stopped = new Promise((_,reject) => {
    child.once('error',reject);
    child.once('exit',code=>reject(new Error(`web-ext exited before the smoke test completed (${code})`)));
  });
  const answer=await Promise.race([result,stopped,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Real extension did not report a result within 45 seconds')),45000);})]);
  assert.equal(answer.tier,'Tier II to III');assert.equal(answer.rows,4);assert.match(answer.summary,/Travis County, TX/);
  assert.equal(answer.spectrum,true);assert.equal(answer.range,true);
  assert.match(answer.monitor,/No newer release/);
  console.log(`Real Firefox add-on smoke passed: manifest, injection, wages and autonomous monitor (${process.env.TEST_LIVE_DOL ? 'live' : 'synthetic'} DOL response).`);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{
  clearTimeout(timer);server.close();server.closeAllConnections();
  if(child?.pid) {try{process.kill(-child.pid,'SIGTERM');}catch{}}
  if(temporarySource) fs.rmSync(temporarySource,{recursive:true,force:true});
});
