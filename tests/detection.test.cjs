const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('../extension/core.js');
const detail = {url:'https://example.com/careers/software-engineer', headings:'Software Engineer', headingCount:1, text:'Responsibilities and qualifications. Base salary: $120,000 per year.', hasApply:true};
test('mail and Jobright cannot auto-trigger from job content or schema', () => {
  for (const host of ['mail.google.com','outlook.live.com','outlook.office.com','mail.yahoo.com','mail.proton.me','jobright.ai','www.jobright.ai']) {
    assert.equal(C.pageKind({...detail,url:`https://${host}/jobs/123`,jobs:[{'@type':'JobPosting'}]}),'excluded',host);
  }
});
test('single posting requires schema, known ATS route or title plus application context', () => {
  assert.equal(C.pageKind(detail),'detail');
  assert.equal(C.pageKind({...detail,hasApply:false}),'unknown');
  assert.equal(C.pageKind({...detail,hasApply:false,hasDetail:true}),'detail');
  assert.equal(C.pageKind({...detail,hasApply:false,jobs:[{'@type':'JobPosting'}]}),'detail');
  assert.equal(C.pageKind({...detail,headings:'Software Engineer Salary Guide'}),'unknown');
  assert.equal(C.pageKind({...detail,headingCount:2}),'unknown');
});
test('listing feeds and multiple structured jobs do not auto-trigger', () => {
  assert.equal(C.pageKind({...detail,headings:'Recommended jobs'}),'listing');
  assert.equal(C.pageKind({...detail,jobs:[{},{}]}),'listing');
  assert.equal(C.pageKind({...detail,hasApply:false,jobLinks:5}),'listing');
});
test('Greenhouse detail routes survive hydration but board and confirmation routes do not qualify', () => {
  for (const url of ['https://job-boards.greenhouse.io/embed/job_app?for=t2systems&token=4675527006','https://job-boards.greenhouse.io/acme/jobs/123']) assert.equal(C.pageKind({url}),'detail');
  for (const url of ['https://job-boards.greenhouse.io/acme','https://job-boards.greenhouse.io/embed/job_app/confirmation?token=123']) assert.equal(C.pageKind({url}),'unknown');
});
