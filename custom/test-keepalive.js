// Checks the scripts TizenBrew adds to pages shown inside it (service-nextgen/service/utils/backKey.js):
// quitting from a website or app sends TizenBrew to the background; its own pages are left alone.
const assert = require('assert');
const vm = require('vm');
const path = require('path');
const { KEEP_ALIVE, PAGE_SCRIPT, addBackKey } = require(path.join(__dirname, '../tizenbrew-app/TizenBrew/service-nextgen/service/utils/backKey.js'));

function fakeTv(protocol) {
    const calls = [];
    const app = { hide() { calls.push('hide'); }, exit() { calls.push('exit'); } };
    const ctx = {
        location: { protocol, host: 'www.youtube.com', pathname: '/tv' },
        tizen: { application: { getCurrentApplication: () => app } },
        addEventListener() { }
    };
    ctx.window = ctx;
    ctx.window.close = () => calls.push('window.close');
    vm.createContext(ctx);
    return { ctx, calls };
}

const checks = [];
function check(name, fn) { try { fn(); checks.push('PASS ' + name); } catch (e) { checks.push('FAIL ' + name + ': ' + e.message); } }

check('a website quitting (exit / window.close) hides TizenBrew instead', () => {
    const { ctx, calls } = fakeTv('https:');
    vm.runInContext(KEEP_ALIVE, ctx);
    vm.runInContext('tizen.application.getCurrentApplication().exit(); window.close();', ctx);
    assert.deepStrictEqual(calls, ['hide', 'hide']);
});

check('TizenBrew\'s own pages (file://) still quit for real (restart into debug mode)', () => {
    const { ctx, calls } = fakeTv('file:');
    vm.runInContext(KEEP_ALIVE, ctx);
    vm.runInContext('tizen.application.getCurrentApplication().exit();', ctx);
    assert.deepStrictEqual(calls, ['exit']);
});

check('running the scripts twice (debugger + page) changes nothing', () => {
    const { ctx, calls } = fakeTv('https:');
    vm.runInContext(PAGE_SCRIPT, ctx);
    vm.runInContext(PAGE_SCRIPT, ctx);
    vm.runInContext('tizen.application.getCurrentApplication().exit();', ctx);
    assert.deepStrictEqual(calls, ['hide']);
});

check('no tizen object (plain browser): no error', () => {
    const ctx = { location: { protocol: 'https:', host: 'x', pathname: '/' }, addEventListener() { } };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(PAGE_SCRIPT, ctx);
});

check('scripts go right after <head>, not into <header>', () => {
    const out = addBackKey('<html><body><header>x</header><head><title>t</title></head></body></html>');
    assert.ok(out.indexOf('<head><script>') > 0 && out.indexOf('<header><script>') < 0);
});

console.log(checks.join('\n'));
if (checks.some(c => c.startsWith('FAIL'))) process.exit(1);
console.log('keep-alive: all checks passed');
