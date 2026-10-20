const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const geo=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/data/counties.json')));

test('all 3,144 counties preserve their canonical five-digit picking and outline IDs',async()=>{
  const {countySourceData}=await import('../dist/streets.mjs');
  const source=countySourceData(geo.counties);
  const known=new Set(geo.counties.features.map(f=>f.id));
  assert.equal(source.features.length,3144);
  for(const feature of source.features) {
    assert.match(feature.properties.fips,/^\d{5}$/);
    assert.ok(known.has(feature.properties.fips));
    assert.equal(feature.properties.fips,feature.id);
  }
  assert.equal(new Set(source.features.map(f=>f.properties.fips)).size,3144);
  assert.ok(geo.counties.features.every(f=>!Object.hasOwn(f.properties,'fips')),'Do not mutate the shared county data');
});

test('street colors use wage-area IDs and missing areas stay gray',async()=>{
  const {colorExpression}=await import('../dist/streets.mjs');
  assert.equal(colorExpression({}),'#cbd0ce');
  assert.deepEqual(colorExpression({'123':'#efcb49'}),['match',['get','area'],'123','#efcb49','#cbd0ce']);
});

test('every county and state has valid street bounds, including Alaska across the dateline',async()=>{
  const {boundsFor}=await import('../dist/streets.mjs');
  for(const feature of [...geo.counties.features,...geo.stateShapes.features]) {
    const [[west,south],[east,north]]=boundsFor(feature);
    assert.ok([west,south,east,north].every(Number.isFinite),feature.id);
    assert.ok(east>west && north>south,feature.id);
    assert.ok(east-west<100,`${feature.id} should not wrap around the world`);
  }
  const alaska=boundsFor(geo.stateShapes.features.find(f=>f.id==='AK'));
  assert.ok(alaska[1][0]-alaska[0][0]<60);
});
