const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('../extension/core.js');
const now = Date.parse('2026-10-11T12:00:00Z');
const meta = {validThrough:'2027-06-30'};
test('fresh current data has no warning',()=>{
  assert.equal(C.freshnessWarning(meta,{kind:'current',lastSuccess:now},now),null);
  assert.equal(C.freshnessWarning(meta,{kind:'pending'},now),null);
});
test('expired data stays red even with checks disabled or a current cached listing',()=>{
  for(const state of [{enabled:false},{kind:'current',lastSuccess:now}]) {
    const warning=C.freshnessWarning({validThrough:'2026-06-30'},state,now);
    assert.equal(warning.severity,'danger'); assert.match(warning.title,/out of date/);
  }
});
test('the effective end date is inclusive',()=>{
  const date=Date.parse('2027-06-30T23:59:59Z');
  assert.equal(C.freshnessWarning(meta,{kind:'current',lastSuccess:date},date),null);
  assert.equal(C.freshnessWarning(meta,{},date+1000).severity,'danger');
});
test('known updates cannot be hidden by disabling monitoring',()=>{
  assert.equal(C.freshnessWarning(meta,{enabled:false,changed:true},now).severity,'danger');
});
test('future release is informational until effective',()=>{
  const state={changed:true,kind:'future',release:{start:'2026-11-01'}};
  assert.equal(C.freshnessWarning(meta,state,now).severity,'info');
  assert.equal(C.freshnessWarning(meta,state,Date.parse('2026-11-01')).severity,'danger');
});
test('failed and seven-day-stale checks show uncertainty, not confirmed expiration',()=>{
  assert.match(C.freshnessWarning(meta,{kind:'error'},now).title,/unverified/);
  assert.match(C.freshnessWarning(meta,{kind:'current',lastSuccess:now-8*86400000},now).title,/may be/);
  assert.match(C.freshnessWarning(meta,{enabled:false},now).title,/unverified/);
});
