const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('../extension/core.js');

test('malformed structured records do not discard valid salaries or addresses', () => {
  const result = C.structured({
    jobLocation: [null, 42, {address:null}, {address:{addressLocality:'Austin',addressRegion:'TX',addressCountry:'US'}}],
    baseSalary: [null, 42, {currency:'USD',value:null}, {currency:'USD',value:{value:120000,unitText:'YEAR'}}]
  });
  assert.deepEqual(result.addresses, ['Austin, TX']);
  assert.equal(result.salaries.length, 1);
  assert.equal(result.salaries[0].min, 120000);
});

test('empty and invalid structured salaries never become zero or an invented range', () => {
  for (const value of [null, {}, {minValue:150000,maxValue:120000}, {value:'NaN'}, {value:Infinity}, {value:12000000}]) {
    assert.deepEqual(C.structured({baseSalary:{currency:'USD',value,unitText:'YEAR'}}).salaries, []);
  }
  assert.deepEqual(C.structured(null), {addresses:[],salaries:[],remote:false});
});

test('salary and bonus on the same line remain separate', () => {
  const values = C.salaryCandidates('Base salary: $120,000 annually; bonus: $20,000 annually');
  assert.deepEqual(values.map(s => s.min), [120000]);
  const inline = C.salaryCandidates('Base salary: $120,000 annually, bonus: $20,000 annually');
  assert.deepEqual(inline.map(s => s.min), [120000]);
});

test('oversized and malformed pay is not silently truncated to a plausible salary', () => {
  for (const value of ['$12000000', '$120,00', '$120000.123']) {
    assert.deepEqual(C.salaryCandidates(`Base salary: ${value} per year`), []);
  }
  assert.deepEqual(C.salaryCandidates(null), []);
  assert.deepEqual(C.salaryCandidates('Base salary: $100k - $120,00 per year'), []);
});

test('multiple jobs never auto-open even on a known ATS detail route', () => {
  assert.equal(C.pageKind({url:'https://job-boards.greenhouse.io/acme/jobs/123',jobs:[{},{}]}), 'listing');
});

test('overflow and inherited property names are not valid pay periods', () => {
  assert.equal(C.annual(Number.MAX_VALUE, 'hour'), null);
  assert.equal(C.annual(120000, 'constructor'), null);
});

test('non-US structured locations and unsupported currency do not produce US candidates', () => {
  const result = C.structured({jobLocation:{address:{addressLocality:'London',addressRegion:'ON',addressCountry:'CA'}},baseSalary:{currency:'CAD',value:{value:120000,unitText:'YEAR'}}});
  assert.deepEqual(result.addresses, []);
  assert.deepEqual(result.salaries, []);
});

test('nested and cyclic job metadata traversal is bounded', () => {
  const job = {'@type':['Thing','https://schema.org/JobPosting'],title:'Engineer'};
  const graph = {'@graph':[job]};
  graph.mainEntity = graph;
  assert.ok(C.jobObjects([graph]).length < 20);
  assert.equal(C.jobObjects([{itemListElement:[{item:job}]}])[0], job);
});
