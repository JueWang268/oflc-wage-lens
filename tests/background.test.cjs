const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../extension/background.js'), 'utf8');
function run(context) {
  return vm.runInNewContext(source, {WageLensMonitor:{create:()=>({start:async()=>{},getStatus:async()=>({kind:'current'}),check:async()=>({kind:'current'}),setEnabled:async enabled=>({enabled})})},...context});
}
for (const installed of [true, false]) test(`toolbar ${installed ? 'toggles existing panel' : 'shows panel after fresh injection'}`, async () => {
  let click, injected = false;
  const messages = [];
  const browser = {
    runtime: {onMessage: {addListener() {}}},
    action: {onClicked: {addListener(fn) {click = fn;}}},
    tabs: {async sendMessage(id, message) {
      assert.equal(id, 7); messages.push(message.type);
      if (!installed && !injected) throw new Error('No receiver');
    }},
    scripting: {async executeScript() {injected = true;}}
  };
  run({browser});
  await click({id: 7});
  assert.deepEqual(messages, installed ? ['wage-lens-toggle'] : ['wage-lens-toggle', 'wage-lens-show']);
  assert.equal(injected, !installed);
});

test('packaged data is shared across concurrent requests and cached', async () => {
  let listener, fetches = 0;
  const data = {areas:{}};
  const browser = {
    runtime:{getURL:p => `moz-extension://test/${p}`,onMessage:{addListener:fn => listener=fn}},
    action:{onClicked:{addListener(){}}}
  };
  run({browser,fetch:async url => {
    assert.equal(url, 'moz-extension://test/data/software-developers.json');
    fetches++; return {ok:true,json:async()=>data};
  }});
  assert.equal(listener({type:'unrelated'}), undefined);
  const values = await Promise.all([listener({type:'wage-lens-data'}),listener({type:'wage-lens-data'})]);
  assert.equal(values[0], data); assert.equal(values[1], data);
  assert.equal(await listener({type:'wage-lens-data'}), data);
  assert.equal(fetches, 1);
});

test('failed packaged data fetch can be retried', async () => {
  let listener, fetches = 0;
  const browser = {runtime:{getURL:p=>p,onMessage:{addListener:fn=>listener=fn}},action:{onClicked:{addListener(){}}}};
  run({browser,fetch:async()=>({ok:++fetches>1,json:async()=>({ready:true})})});
  await assert.rejects(listener({type:'wage-lens-data'}), /unavailable/);
  assert.equal((await listener({type:'wage-lens-data'})).ready, true);
  assert.equal(fetches, 2);
});

test('protected pages report a helpful toolbar title without an unhandled rejection', async () => {
  let click, title;
  const browser = {
    runtime:{onMessage:{addListener(){}}},
    action:{onClicked:{addListener:fn=>click=fn},setTitle:async value=>title=value},
    tabs:{sendMessage:async()=>{throw new Error('No receiver');}},
    scripting:{executeScript:async()=>{throw new Error('Protected page');}}
  };
  run({browser});
  await click({}); assert.equal(title, undefined);
  await click({id:7}); assert.match(title.title, /Firefox protects/);
});
