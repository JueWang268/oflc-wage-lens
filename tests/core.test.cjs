const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('../extension/core.js');
const data = require('../extension/data/software-developers.json');
const area = data.areas['12420'];
test('salary spectrum uses linear dollars, exact endpoints and clamped overflow', () => {
  const low=area.levels[0]*C.HOURS, high=area.levels[3]*C.HOURS;
  const s=C.spectrum(120000,150000,area);
  assert.ok(Math.abs(s.left-(120000-low)/(high-low)*100)<1e-8);
  assert.ok(Math.abs(s.right-(150000-low)/(high-low)*100)<1e-8);
  assert.deepEqual(C.spectrum(low,high,area),{ticks:s.ticks,left:0,right:100,below:false,above:false});
  assert.deepEqual(C.spectrum(10000,500000,area),{ticks:s.ticks,left:0,right:100,below:true,above:true});
  assert.equal(C.spectrum(150000,120000,area),null);
  assert.equal(C.spectrum(120000,120000,null),null);
  assert.equal(C.spectrum(NaN,120000,area),null);
  assert.equal(C.spectrum(120000,120000,{levels:[50,50,50,50]}),null);
});
test('correct source, occupation and complete wage areas', () => {
  assert.equal(data.meta.soc, '15-1252'); assert.equal(data.meta.onet, '15-1252.00');
  assert.equal(data.meta.industry, 'All industries'); assert.equal(Object.keys(data.areas).length, 530);
  assert.equal(Object.keys(data.meta.sourceHashes).length, 3);
  for (const a of Object.values(data.areas)) assert.deepEqual(a.levels, [...a.levels].sort((a,b)=>a-b));
});
test('Travis County example is Level II at $120,000', () => {
  assert.deepEqual(area.levels, [46.10,57.52,68.94,80.36]);
  assert.equal(C.classify(120000,area),2);
});
test('all 2,120 boundaries inclusive, cent below exclusive', () => {
  for (const a of Object.values(data.areas)) a.levels.forEach((w,i) => {
    const boundary=Math.round(w*2080*100)/100;
    assert.equal(C.classify(boundary,a), a.levels.filter(x=>Math.round(x*208000)<=Math.round(boundary*100)).length);
    assert.equal(C.classify(boundary-.01,a), a.levels.filter(x=>Math.round(x*208000)<Math.round(boundary*100)).length);
  });
});
test('below I, at IV, unknown and invalid pay', () => {
  assert.equal(C.classify(30000,area),0); assert.equal(C.classify(500000,area),4);
  assert.equal(C.classify(0,area),null); assert.equal(C.classify(NaN,area),null);
  assert.equal(C.classify(120000,{levels:[1,null,3,4]}),null);
  assert.equal(C.classify(120000,{levels:[1,2,3,4],label:'High Wage'}),null);
});
test('40 hour, 52 week conversion and no assumed part time', () => {
  assert.equal(C.annual(57.52,'hour'),119641.6); assert.equal(C.annual(10000,'month'),120000);
  assert.equal(C.annual(2000,'week'),104000); assert.equal(C.annual(1000,'day'),260000);
  assert.equal(C.annual(500,'unknown'),null);
});
const salaryCases = [
  ['Base salary: $120,000 - $150,000 per year',120000,150000],
  ['Salary: $120k–150k annually',120000,150000],
  ['Salary: $120–150k per annum',120000,150000],
  ['Pay: $57.52 - $80.36/hour',119641.6,167148.8],
  ['Base pay: USD 120,000 to USD 150,000 annually',120000,150000],
  ['Salary range: $120,000 - $150,000',120000,150000],
  ['Salary: $10,000 monthly',120000,120000],
  ['Salary: $2,000 per week',104000,104000],
  ['Annual base salary: $120,000',120000,120000]
];
for (const [text,min,max] of salaryCases) test(text, () => {
  const s=C.salaryCandidates(text); assert.equal(s.length,1); assert.ok(Math.abs(s[0].min-min)<.001); assert.ok(Math.abs(s[0].max-max)<.001);
});
test('exclude bonus, equity, total comp and foreign currency', () => {
  for(const t of ['Sign-on bonus: $20,000 per year','Total compensation: $200,000 annually','Equity: $100,000/year','Salary CAD $120,000 per year','Salary: C$120,000 per year','Salary: $120,000 CAD per year','Salary: $150,000 - $100,000/year']) assert.equal(C.salaryCandidates(t).length,0,t);
});
test('retain separate base salaries and mark open ended floor', () => {
  const s=C.salaryCandidates('New York, NY base salary: $120,000/year\nSan Francisco, CA base salary: $150,000/year');
  assert.equal(s.length,2); assert.equal(C.salaryCandidates('Salary: $120,000+ annually')[0].openEnded,true);
});
test('structured JSON-LD graph and currency handling', () => {
  const job={'@type':'JobPosting',title:'Software Engineer',jobLocation:{address:{addressLocality:'Austin',addressRegion:'TX',addressCountry:'US'}},baseSalary:{currency:'USD',value:{minValue:120000,maxValue:150000,unitText:'YEAR'}}};
  assert.equal(C.jobObjects([{'@graph':[job]}]).length,1);
  assert.deepEqual(C.structured(job).addresses,['Austin, TX']); assert.equal(C.structured(job).salaries[0].min,120000);
  job.baseSalary.currency='CAD'; assert.equal(C.structured(job).salaries.length,0);
});
test('county matching needs state and does not infer a city county', () => {
  assert.equal(C.locations('Travis County, TX',data)[0].area,'12420');
  const loc=C.locations('Austin, Texas',data)[0]; assert.equal(loc.area,'12420'); assert.equal(loc.kind,'city');
  assert.equal(C.locations('Austin',data).length,0); assert.equal(C.locations('Remote, US',data).length,0);
});
test('cities match whole names, not substrings', () => {
  const ny=C.locations('New York, NY',data); assert.equal(ny.length,1); assert.equal(ny[0].area,'35620');
  assert.equal(C.locations('NotAustin, TX',data).length,0);
});
test('multiple locations, state disambiguation and curated tech cities', () => {
  assert.equal(C.locations('Seattle, WA; Austin, TX',data).length,2);
  assert.notEqual(C.locations('Portland, OR',data)[0].area,C.locations('Portland, ME',data)[0].area);
  assert.equal(C.locations('Redmond, WA',data)[0].area,'42660');
  assert.equal(C.locations('Irving, TX',data)[0].area,'19100');
});
test('search covers every county and supports state names', () => {
  assert.ok(C.searchLocations('Travis Texas',data).some(l=>l.label==='Travis County, TX'));
  assert.equal(C.searchLocations('',data).length,0);
});
