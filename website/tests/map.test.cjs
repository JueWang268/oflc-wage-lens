const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('../dist/map-core.js');
const dataset=require('../dist/data/counties.json');
const catalog=require('../dist/data/occupations.json');
const path=require('node:path');
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
test('no remotely loaded runtime scripts',()=>{
  const html=fs.readFileSync(require('node:path').join(__dirname,'../dist/index.html'),'utf8');
  assert.ok(!/src="https?:/.test(html));
});
test('complete catalog, unique codes, crosswalk aliases and default',()=>{
  assert.equal(catalog.default,'15-1252');assert.equal(catalog.occupations.length,848);
  const options=core.occupationOptions(catalog);
  assert.equal(options.length,1845);assert.equal(new Set(options.map(o=>o.code)).size,1845);
  assert.equal(core.findOccupations(options,'15-1252.00')[0].soc,'15-1252');
  assert.ok(core.findOccupations(options,'registered nurses').some(o=>o.soc==='29-1141'));
  assert.ok(core.findOccupations(options,'quantitative').some(o=>o.kind==='O*NET'));
  assert.equal(core.findOccupations(options,'zzzz-no-match').length,0);
});
test('all 449,440 source rows have valid units and exact threshold boundaries',()=>{
  let count=0, annual=0, missing=0;
  for(const entry of catalog.occupations) {
    const payload=require(`../dist/data/occupations/${entry.code}.json`);
    assert.equal(payload.code,entry.code);assert.equal(payload.title,entry.title);
    assert.equal(Object.keys(payload.areas).length,530);
    for(const [id,area] of Object.entries(payload.areas)) {
      count++;assert.ok(dataset.areas[id]);
      const rates=core.thresholds(area);
      if(['High Wage','No Leveled Wage'].includes(area.label)) {missing++;assert.equal(rates,null);assert.equal(core.tier(1000000,area),null);continue;}
      assert.ok(rates);
      if(area.label==='Annual Wage'){annual++;assert.equal(area.unit,'year');assert.deepEqual(rates,area.levels);}
      else assert.equal(area.unit,'hour');
      rates.forEach(rate=>{
        const expected=rates.filter(r=>r<=rate).length;
        assert.equal(core.tier(rate,area),expected);
        assert.equal(core.tier(rate-.01,area),rates.filter(r=>Math.round(r*100)<Math.round(rate*100)).length);
      });
    }
  }
  assert.equal(count,449440);assert.equal(annual,32299);assert.equal(missing,6521);
});
test('software defaults remain identical to the extension data',()=>{
  const wages=require('../dist/data/occupations/15-1252.json');
  for(const [id,area] of Object.entries(wages.areas)) {
    assert.deepEqual(core.thresholds(area),core.thresholds(dataset.areas[id]));
    assert.equal(core.tier(120000,area),core.tier(120000,dataset.areas[id]));
  }
});
test('annual wages are not multiplied by 2080 and flagged data never inherits defaults',()=>{
  const annual={levels:[70000,79073,88147,97220],unit:'year',label:'Annual Wage'};
  assert.equal(core.tier(79073,annual),2);assert.equal(core.tier(79072.99,annual),1);
  assert.deepEqual(core.thresholds(annual),annual.levels);
  assert.equal(core.thresholds({...annual,unit:'hour'}),null);
  assert.match(core.unavailableReason({label:'High Wage'}),/High-wage/);
});
