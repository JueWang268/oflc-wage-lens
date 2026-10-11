const {test} = require('node:test');
const assert = require('node:assert/strict');
const M = require('../extension/monitor.js');
const row = {period:'7/2026 - 6/2027',updated:'July 1, 2026',url:M.BASELINE.url};

test('official download rows are parsed and sorted by wage year', () => {
  const records = M.parseRecords([row,{...row,period:'7/2027 - 6/2028',updated:'July 1, 2027',url:'/sites/default/files/wages/OFLC_Wages_2027-28.zip'}]);
  assert.equal(records[0].start,'2027-07-01');
  assert.equal(records[1].updated,'2026-07-01');
});
test('untrusted links, non-annual periods and invalid dates fail closed', () => {
  for (const invalid of [
    {...row,url:'https://evil.test/data.zip'}, {...row,url:'http://flag.dol.gov/data.zip'},
    {...row,url:'https://user:pass@flag.dol.gov/data.zip'}, {...row,url:'javascript:alert(1)'},
    {...row,url:'https://flag.dol.gov:444/data.zip'}, {...row,period:'7/2026 - 6/2030'},
    {...row,updated:'February 30, 2026'}, {...row,updated:'not a date'}
  ]) assert.throws(()=>M.parseRecords([invalid]), /not recognized/);
});
test('current, revised, newer and future releases have distinct states', () => {
  assert.equal(M.assess([M.BASELINE],'2026-10-11').kind,'current');
  assert.equal(M.assess([{...M.BASELINE,updated:'2026-10-10'}],'2026-10-11').kind,'update');
  assert.equal(M.assess([{...M.BASELINE,url:M.BASELINE.url+'?revision=2'}],'2026-10-11').kind,'update');
  const next = {...M.BASELINE,start:'2027-07-01',end:'2028-06-30',updated:'2027-07-01'};
  assert.equal(M.assess([next],'2027-06-30').kind,'future');
  assert.equal(M.assess([next],'2027-07-01').kind,'update');
  assert.throws(()=>M.assess([{...M.BASELINE,start:'2025-07-01'}],'2026-10-11'), /predates/);
});
const response = body => new Response(body,{headers:{'content-type':'text/html'}});
test('response type, HTTP errors and size limits are enforced', async () => {
  await assert.rejects(M.readPage(new Response('no',{status:503})), /503/);
  await assert.rejects(M.readPage(new Response('{}',{headers:{'content-type':'application/json'}})), /HTML/);
  await assert.rejects(M.readPage(response('x'.repeat(1024*1024+1))), /size limit/);
  assert.equal(await M.readPage(response('<table></table>')), '<table></table>');
});

function harness({initial, parse = () => [M.BASELINE], fail = false} = {}) {
  let time = Date.parse('2026-10-11T12:00:00Z'), state = initial ? {baselineKey:JSON.stringify(M.BASELINE),...initial} : undefined, calls = 0, alarm, listener, badge;
  const browser = {
    storage:{local:{get:async()=>({[M.KEY]:state}),set:async values=>{state=values[M.KEY];}}},
    action:{setBadgeText:async value=>{badge=value.text;},setBadgeBackgroundColor:async()=>{}},
    alarms:{get:async()=>alarm,create:async(name,options)=>{alarm={name,...options};},clear:async()=>{alarm=null;},onAlarm:{addListener:fn=>{listener=fn;}}}
  };
  const monitor = M.create(browser,{parse,now:()=>time,fetcher:async(url,options)=>{
    calls++; assert.equal(url,M.SOURCE);
    assert.equal(options.credentials,'omit'); assert.equal(options.referrerPolicy,'no-referrer');
    assert.equal(options.redirect,'error'); assert.equal(options.cache,'no-store');
    if(fail) throw new Error('Offline');
    return response('<table></table>');
  }});
  return {monitor,browser,get state(){return state;},get calls(){return calls;},get alarm(){return alarm;},get listener(){return listener;},get badge(){return badge;},advance:ms=>{time+=ms;}};
}
test('startup checks once, recreates the daily alarm and caches across restarts', async () => {
  const h = harness(); await h.monitor.start();
  assert.equal(h.calls,1); assert.equal(h.alarm.periodInMinutes,1440);
  assert.equal(h.state.kind,'current'); assert.equal(h.badge,'');
  await h.monitor.check(); assert.equal(h.calls,1);
  const restarted = harness({initial:h.state}); await restarted.monitor.start();
  assert.equal(restarted.calls,0); assert.ok(restarted.alarm);
});
test('concurrent loads share one request and daily checks become due', async () => {
  const h = harness(); await Promise.all([h.monitor.check(),h.monitor.check()]);
  assert.equal(h.calls,1); h.advance(M.DAY); await h.monitor.check(); assert.equal(h.calls,2);
});
test('failed checks preserve last known update and do not hammer DOL', async () => {
  const h = harness({initial:{changed:true,release:M.BASELINE,lastSuccess:10},fail:true});
  await h.monitor.check(); assert.equal(h.state.kind,'error'); assert.equal(h.state.lastSuccess,10);
  assert.equal(h.state.changed,true); assert.equal(h.badge,'NEW');
  await h.monitor.check(); assert.equal(h.calls,1);
  h.advance(60000); await h.monitor.check(true); assert.equal(h.calls,2);
});
test('changed release sets a badge without downloading or replacing wage data', async () => {
  const h = harness({parse:()=>[{...M.BASELINE,updated:'2026-10-10'}]});
  await h.monitor.start(); assert.equal(h.state.kind,'update'); assert.equal(h.badge,'NEW');
  assert.equal(h.calls,1); assert.equal(h.state.areas,undefined);
});
test('opt-out persists, clears alarms and stops checks', async () => {
  const h = harness(); await h.monitor.start(); await h.monitor.setEnabled(false);
  assert.equal(h.alarm,null); assert.equal(h.badge,'');
  h.advance(M.DAY*2); await h.monitor.check(true); assert.equal(h.calls,1);
  const restarted=harness({initial:h.state}); await restarted.monitor.start();
  assert.equal(restarted.calls,0); assert.equal(restarted.alarm,undefined);
  await h.monitor.setEnabled(true); assert.equal(h.calls,2); assert.ok(h.alarm);
});
test('alarm listener ignores unrelated alarms and invokes a due check', async () => {
  const h = harness(); await h.monitor.start(); h.advance(M.DAY);
  h.listener({name:'unrelated'}); assert.equal(h.calls,1);
  h.listener({name:M.ALARM}); await h.monitor.check(); assert.equal(h.calls,2);
});
test('changed or blocked HTML records an error, not a false current result', async () => {
  const h = harness({parse:()=>M.parseRecords([])}); await h.monitor.check();
  assert.equal(h.state.kind,'error'); assert.equal(h.state.lastSuccess,undefined);
  assert.equal(h.badge,'!');
});
test('rebuilt datasets supply the monitor baseline without editing JavaScript',()=>{
  const meta={validFrom:'2027-07-01',validThrough:'2028-06-30',sourceRelease:{start:'2027-07-01',end:'2028-06-30',updated:'2027-07-01',url:'https://flag.dol.gov/sites/default/files/wages/OFLC_Wages_2027-28.zip'}};
  assert.deepEqual(M.baselineFromMeta(meta),meta.sourceRelease);
  assert.deepEqual(M.baselineFromMeta({validFrom:'2026-07-01',validThrough:'2027-06-30'}),M.BASELINE);
  assert.throws(()=>M.baselineFromMeta({...meta,sourceRelease:undefined}),/missing/);
});
test('changing the bundled baseline invalidates persisted check results',async()=>{
  const h=harness({initial:{baselineKey:'old-release',lastAttempt:Date.parse('2026-10-11T12:00:00Z'),changed:true}});
  await h.monitor.check(); assert.equal(h.calls,1); assert.equal(h.state.changed,false);
});
