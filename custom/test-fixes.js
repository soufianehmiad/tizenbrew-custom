// Tests the fixes loader (service utils/fixes.js) against a local stand-in for GitHub.
// Run: node custom/test-fixes.js
const assert = require('assert');
const http = require('http');
const path = require('path');

let mode = 'ok';
const server = http.createServer((req, res) => {
    if (mode === 'down') { req.socket.destroy(); return; }
    if (req.url === '/fixes/%40foxreis/tizentube.js' || req.url === '/fixes/@foxreis/tizentube.js') {
        res.end(mode === 'ok' ? '/* fix v1 */' : '/* fix v2 */');
    } else { res.statusCode = 404; res.end('404: Not Found'); }
});

server.listen(0, '127.0.0.1', async () => {
    process.env.TIZENBREW_FIXES_URL = `http://127.0.0.1:${server.address().port}/fixes/`;
    const { fetchFixes, fixesUrl } = require(path.join(__dirname, '../tizenbrew-app/TizenBrew/service-nextgen/service/utils/fixes.js'));
    const tt = { name: '@foxreis/tizentube' };
    const origError = console.error; console.error = () => { };
    try {
        assert.ok(fixesUrl(tt).endsWith('/fixes/%40foxreis/tizentube.js'), fixesUrl(tt));
        assert.strictEqual(await fetchFixes(tt), '/* fix v1 */', 'existing fix is loaded');
        assert.strictEqual(await fetchFixes({ name: 'some-other-app' }), '', 'no fix file means no fix');
        assert.strictEqual(await fetchFixes({ name: '' }), '', 'no module, no request');
        mode = 'down';
        assert.strictEqual(await fetchFixes(tt), '/* fix v1 */', 'GitHub unreachable: last copy is used');
        mode = 'v2';
        assert.strictEqual(await fetchFixes(tt), '/* fix v2 */', 'an updated fix is picked up');
        console.error = origError;
        console.log('fixes loader: all checks passed');
        server.close(); process.exit(0);
    } catch (e) {
        console.error = origError;
        console.log('FAIL fixes loader:', e.message);
        server.close(); process.exit(1);
    }
});
