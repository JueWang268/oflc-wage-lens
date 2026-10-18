const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('../dist/map-core.js');
const dataset=require('../dist/data/counties.json');
test('five bands, exact thresholds and one cent below',()=>{
  const a={levels:[40,50,60,70],label:''};
  assert.equal(core.tier(1,a),0);
  for(let i=0;i<4;i++){assert.equal(core.tier(a.levels[i]*2080,a),i+1);assert.equal(core.tier(a.levels[i]*2080-.01,a),i);}
  assert.equal(core.tier(200000,a),4);assert.equal(core.bands.length,5);
});
test('missing, flagged, unordered and invalid inputs never produce a tier',()=>{
  for(const value of [0,-1,NaN,Infinity,10000001])assert.equal(core.tier(value,{levels:[1,2,3,4]}),null);
  for(const area of [null,{levels:[1,2,null,4]},{levels:[1,3,2,4]},{levels:[1,2,3,4],label:'suppressed'}])assert.equal(core.tier(120000,area),null);
});
test('annual/hourly comparisons agree at all four levels',()=>{
  const area={levels:[46.1,57.52,68.94,80.36],label:''};
  area.levels.forEach((hourly,i)=>assert.equal(core.tier(Number((hourly*2080).toFixed(2)),area),i+1));
});
test('all county joins reference a matching state and full county name',()=>{
  const norm=s=>s.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N} ]/gu,'').trim();
  const ids=new Set();
  for(const county of dataset.counties.features){
    assert.match(county.id,/^\d{5}$/);assert.ok(!ids.has(county.id));ids.add(county.id);
    const p=county.properties;
    if(p.area)assert.ok(dataset.areas[p.area].counties.some(c=>c.state===p.state && norm(c.name)===norm(p.name)));
    assert.ok(county.geometry.coordinates.length);
  }
  assert.equal(ids.size,3144);assert.equal(Object.keys(dataset.states).length,51);
});
test('known locations, nationwide totals and Texas filter',()=>{
  const travis=dataset.counties.features.find(c=>c.id==='48453');
  assert.equal(travis.properties.name,'Travis County');assert.equal(travis.properties.state,'TX');
  assert.equal(core.tier(120000,dataset.areas[travis.properties.area]),2);
  const all=core.distribution(dataset.counties.features,dataset.areas,120000);
  assert.equal(all.counts.reduce((a,b)=>a+b,all.unknown),3144);
  assert.equal(core.distribution(dataset.counties.features,dataset.areas,120000,'TX').total,254);
});
test('no em dashes or remotely loaded runtime scripts',()=>{
  const html=fs.readFileSync(require('node:path').join(__dirname,'../dist/index.html'),'utf8');
  assert.ok(!/src="https?:/.test(html));
});
