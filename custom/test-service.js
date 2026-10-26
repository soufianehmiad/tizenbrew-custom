// Runs the real built TizenBrew service (service dist/index.js) on this PC with a stand-in `tizen`
// object and a temporary config file, then talks to it the way the TV interface does.
// Needs internet (loads TizenTube from jsdelivr). Run: node custom/test-service.js  (port 8081 must be free)
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const http = require('http');
const path = require('path');

const svc = path.join(__dirname, '../tizenbrew-app/TizenBrew/service-nextgen/service');
const distPath = process.argv[2] || path.join(svc, 'dist/index.js');
const WebSocket = require(process.argv[3] || path.join(svc, 'node_modules/ws-new'));

// Temporary config, deliberately damaged: the service must still start.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tizenbrew-test-'));
const configPath = path.join(dir, 'tizenbrewConfig.json');
fs.writeFileSync(configPath, '{ this is not json');
process.env.TIZENBREW_CONFIG = configPath;
process.env.TIZENBREW_DEBUGCHECK_TRIES = '3';   // the real service keeps asking for ~2 minutes

global.tizen = {
  application: { getAppInfo: () => ({ packageId: 'AdFreeTube' }) },
  systeminfo: { getCapability: () => '6.5.0' }
};
const origError = console.error;
console.error = () => { };          // the service logs expected errors (no TV here); keep output readable
require(distPath).onStart();

const wait = (ms) => new Promise(r => setTimeout(r, ms));
function get(p) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: 8081, path: p }, (res) => {
      let body = ''; res.on('data', d => body += d); res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body }));
    }).on('error', reject);
  });
}
function connect(origin) {
  return new Promise((resolve) => {
    const ws = new WebSocket('ws://127.0.0.1:8081', origin ? { origin } : {});
    ws.on('open', () => resolve({ ws, ok: true }));
    ws.on('error', () => resolve({ ws, ok: false }));
    ws.on('unexpected-response', () => resolve({ ws, ok: false }));
  });
}

(async () => {
  const results = [];
  const check = async (name, fn) => { try { await fn(); results.push('PASS ' + name); } catch (e) { results.push('FAIL ' + name + ': ' + e.message); } };
  await wait(1500);

  const { ws } = await connect();
  const inbox = [];
  ws.on('message', (m) => inbox.push(JSON.parse(m)));
  const ask = async (msg, type, ms = 15000) => {
    const start = inbox.length; ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
    for (let t = 0; t < ms; t += 100) { const hit = inbox.slice(start).find(x => x.type === type); if (hit) return hit; await wait(100); }
    throw new Error('no reply of type ' + type);
  };

  await check('starts despite a damaged config file (and keeps a copy of it)', () => assert.ok(fs.existsSync(configPath + '.broken')));

  // Casting right after start-up: the module list may still be loading.
  await check('app control (casting) waits for the module list', async () => {
    const r = await ask({ type: 0, payload: { package: 'npm/@foxreis/tizentube', args: 'v=x' } }, 0, 20000);
    assert.strictEqual(r.payload, null);
  });

  const dbg = await ask({ type: 1 }, 1);
  await check('GetDebugStatus answers', () => assert.deepStrictEqual(Object.keys(dbg.payload).sort(), ['rwiDebug', 'tizenDebug', 'webDebug']));

  await check('debug-mode check retries, then answers false with the reason (no TV here)', async () => {
    const start = inbox.length;
    const r = await ask({ type: 2 }, 2, 45000);
    assert.strictEqual(r.payload, false);
    await wait(300);
    const why = inbox.slice(start).find(x => x.type === 8);
    assert.ok(why && /did not answer the Developer Mode check/.test(why.payload), 'no reason sent: ' + JSON.stringify(why));
  });

  // Simulated TV settings API (port 8001). After a restart the real TV refuses it for a while.
  function fakeTv(device) {
    return new Promise(resolve => {
      const srv = http.createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ device })); });
      srv.listen(8001, '127.0.0.1', () => resolve(srv));
    });
  }

  await check('TV just restarted: settings API refuses at first, answers later -> debug mode allowed', async () => {
    const pending = ask({ type: 2 }, 2, 20000);
    await wait(3000);                                     // TV "still starting"
    const srv = await fakeTv({ developerIP: '127.0.0.1', developerMode: '1' });
    try { assert.strictEqual((await pending).payload, true); } finally { srv.close(); }
  });

  await check('Host PC IP set to the laptop: answers false and names the IP', async () => {
    const srv = await fakeTv({ developerIP: '192.0.2.10', developerMode: '1' });
    try {
      const start = inbox.length;
      assert.strictEqual((await ask({ type: 2 }, 2, 10000)).payload, false);
      await wait(300);
      const why = inbox.slice(start).find(x => x.type === 8);
      assert.ok(why && /Host PC IP 192\.0\.2\.10/.test(why.payload), 'reason: ' + JSON.stringify(why));
    } finally { srv.close(); }
  });

  let mods;
  await check('GetModules loads TizenTube from jsdelivr', async () => {
    mods = (await ask({ type: 4, payload: true }, 4, 20000)).payload;
    const tt = mods.find(m => m.fullName === 'npm/@foxreis/tizentube');
    assert.ok(tt, 'missing'); assert.strictEqual(tt.appName, 'TizenTube'); assert.ok(/^\d+\.\d+\.\d+/.test(tt.version)); assert.ok(!tt.failed);
    results.push('     TizenTube ' + tt.version);
  });

  await check('bad JSON / null / unknown messages get an Error reply, no crash', async () => {
    assert.ok(/Invalid JSON/.test((await ask('not json', 8)).payload));
    assert.ok(/Invalid message/.test((await ask('null', 8)).payload));
    assert.ok(/Invalid event type/.test((await ask({ type: 99 }, 8)).payload));
    assert.ok(/Request failed|not found/.test((await ask({ type: 10 }, 8, 3000).catch(() => ({ payload: 'Request failed' }))).payload));
  });

  await check('LaunchModule / StartService only accept installed modules', async () => {
    assert.ok(/Module not found/.test((await ask({ type: 5, payload: { fullName: 'npm/evil', packageType: 'mods', mainFile: 'x.js' } }, 8)).payload));
    assert.ok(/Module not found/.test((await ask({ type: 6, payload: { fullName: 'npm/evil', serviceFile: 'x.js' } }, 8)).payload));
  });

  await check('websites cannot connect; TizenBrew pages can', async () => {
    const evil = await connect('https://evil.example'); assert.strictEqual(evil.ok, false, 'website was accepted');
    const yt = await connect('https://www.youtube.com'); assert.strictEqual(yt.ok, false, 'youtube.com was accepted');
    // The first page origin to connect is the TizenBrew UI (here file://); afterwards only it is accepted.
    const file = await connect('file://'); assert.strictEqual(file.ok, true, 'file:// was refused'); file.ws.close();
    const again = await connect('file://'); assert.strictEqual(again.ok, true, 'UI reconnect was refused'); again.ws.close();
    const sandboxed = await connect('null'); assert.strictEqual(sandboxed.ok, false, 'sandboxed-iframe origin "null" was accepted');
    const own = await connect('http://127.0.0.1:8081'); assert.strictEqual(own.ok, true, 'own app page was refused'); own.ws.close();
  });

  await check('module proxy: installed modules only, real content type', async () => {
    const ok = await get('/module/' + encodeURIComponent('npm/@foxreis/tizentube') + '/package.json');
    assert.strictEqual(ok.status, 200); assert.ok(ok.body.includes('@foxreis/tizentube')); assert.ok(/json/.test(ok.type || ''), 'type ' + ok.type);
    const missing = await get('/module/' + encodeURIComponent('npm/@foxreis/tizentube') + '/no-such-file.js');
    assert.strictEqual(missing.status, 404);
    const other = await get('/module/' + encodeURIComponent('gh/someone/anything') + '/index.html');
    assert.strictEqual(other.status, 403);
    const bad = await get('/module/%E0%A4%A/x');
    assert.strictEqual(bad.status, 400);
    // App-type modules: their pages must arrive as HTML (jsDelivr itself says text/plain).
    const cfg = { modules: ['npm/@foxreis/tizentube', 'npm/swagger-ui-dist@5.9.0'], autoLaunchServiceList: [], autoLaunchModule: '' };
    fs.writeFileSync(configPath, JSON.stringify(cfg));
    const page = await get('/module/' + encodeURIComponent('npm/swagger-ui-dist@5.9.0') + '/index.html');
    assert.strictEqual(page.status, 200); assert.ok(/text\/html/.test(page.type || ''), 'html served as ' + page.type);
    // App pages carry the Back-to-TizenBrew script (so apps work without debug mode), once, right after <head>.
    assert.strictEqual(page.body.split('__tbBackFix = true').length, 2, 'Back script missing or doubled');
    assert.ok(/<head[^>]*><script>\(function \(\) \{\s+if \(window\.__tbBackFix\)/.test(page.body), 'Back script not at the start of <head>');
    assert.ok(page.body.includes('swagger-ui'), 'page content changed');
    // ...and the script that keeps TizenBrew running in the background instead of quitting.
    assert.strictEqual(page.body.split('window.__tbKeepAlive = true').length, 2, 'keep-alive script missing or doubled');
    const css = await get('/module/' + encodeURIComponent('npm/swagger-ui-dist@5.9.0') + '/swagger-ui.css');
    assert.ok(/text\/css/.test(css.type || ''), 'css served as ' + css.type);
    assert.ok(!css.body.includes('__tbBackFix'), 'Back script added to a non-HTML file');
    cfg.modules.pop();
    fs.writeFileSync(configPath, JSON.stringify(cfg));
  });

  await check('adding an app saves the config safely; a failed download is retried', async () => {
    ws.send(JSON.stringify({ type: 10, payload: { action: 'add', module: 'npm/tizenbrew-test-no-such-module-xyz' } }));
    await wait(300);
    const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.ok(saved.modules.includes('npm/tizenbrew-test-no-such-module-xyz'));
    assert.ok(!fs.existsSync(configPath + '.tmp'), 'temp file left behind');
    const first = (await ask({ type: 4, payload: true }, 4, 20000)).payload.find(m => m.fullName.endsWith('xyz'));
    assert.ok(first && first.failed && first.appName === 'Unknown Module', 'not marked failed');
    // Change the config behind the service's back: only a real reload (not the cached list) can see it.
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    cfg.modules = cfg.modules.filter(m => !m.endsWith('xyz'));
    fs.writeFileSync(configPath, JSON.stringify(cfg));
    const second = (await ask({ type: 4 }, 4, 20000)).payload;  // no payload: must retry because one failed
    assert.ok(!second.some(m => m.fullName.endsWith('xyz')), 'answered from the cached failure instead of retrying');
    const third = (await ask({ type: 4 }, 4, 5000)).payload;    // nothing failed now: served from cache
    assert.ok(third.some(m => m.fullName === 'npm/@foxreis/tizentube'));
  });

  await check('GetConfig reports the current choices (shown in Settings)', async () => {
    ws.send(JSON.stringify({ type: 10, payload: { action: 'autolaunch', module: 'npm/@foxreis/tizentube' } }));
    ws.send(JSON.stringify({ type: 10, payload: { action: 'autolaunchService', module: 'npm/@foxreis/tizentube' } }));
    await wait(300);
    const cfg = (await ask({ type: 11 }, 11, 5000)).payload;
    assert.deepStrictEqual(cfg, { autoLaunchModule: 'npm/@foxreis/tizentube', autoLaunchServiceList: ['npm/@foxreis/tizentube'] });
    ws.send(JSON.stringify({ type: 10, payload: { action: 'autolaunch', module: '' } }));
    ws.send(JSON.stringify({ type: 10, payload: { action: 'autolaunchService', module: '' } }));
    await wait(300);
    const off = (await ask({ type: 11 }, 11, 5000)).payload;
    assert.deepStrictEqual(off, { autoLaunchModule: '', autoLaunchServiceList: [] });
  });

  await check('Background services setting: a single stored name is accepted', () => {
    fs.writeFileSync(configPath, JSON.stringify({ modules: ['npm/@foxreis/tizentube'], autoLaunchServiceList: 'npm/@foxreis/tizentube', autoLaunchModule: '' }));
    const { readConfig } = require(path.join(svc, 'utils/configuration.js'));
    assert.deepStrictEqual(readConfig().autoLaunchServiceList, ['npm/@foxreis/tizentube']);
  });

  console.error = origError;
  console.log(results.join('\n'));
  ws.close();
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log('FAIL harness:', e.message); process.exit(1); });
