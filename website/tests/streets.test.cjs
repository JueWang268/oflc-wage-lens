const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const geo=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/data/counties.json')));

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
