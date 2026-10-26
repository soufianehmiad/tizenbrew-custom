// Checks the autolaunch fix (service-nextgen/service/utils/pendingLaunch.js), including the race
// from upstream issue #151. Run: node custom/test-pending-launch.js
const assert = require('assert');
const { setPending, deliverPending } = require(process.argv[2] || require('path').join(__dirname, '../tizenbrew-app/TizenBrew/service-nextgen/service/utils/pendingLaunch.js'));
const mk = (name) => ({ name, isReady: false, connection: { readyState: 1 }, got: [], send(e) { this.got.push(e); } });
const services = new Map();
// 1) Race from issue #151: old UI socket still "open", not ready; event must wait.
const oldUI = mk('old'); services.set('wsConn', oldUI);
setPending({ type: 9, payload: { type: 'autolaunch', module: 'npm/@foxreis/tizentube' } }, services);
assert.equal(oldUI.got.length, 0, 'old UI must not get it');
// new debug UI connects, then asks for modules (becomes ready)
const newUI = mk('new'); services.set('wsConn', newUI);
deliverPending(services); assert.equal(newUI.got.length, 0, 'not ready yet');
newUI.isReady = true; deliverPending(services);
assert.equal(newUI.got.length, 1); assert.equal(newUI.got[0].payload.module, 'npm/@foxreis/tizentube');
deliverPending(services); assert.equal(newUI.got.length, 1, 'delivered once');
// 2) Other order: UI already ready when debugger connects -> immediate.
const ui3 = mk('ui3'); ui3.isReady = true; services.set('wsConn', ui3);
setPending({ type: 9, payload: null }, services); assert.equal(ui3.got.length, 1);
// 3) Ready flag but socket closed -> wait.
const ui4 = mk('ui4'); ui4.isReady = true; ui4.connection.readyState = 3; services.set('wsConn', ui4);
setPending({ type: 9, payload: null }, services); assert.equal(ui4.got.length, 0);
// 4) Expiry: an event nobody picked up within 60 s is dropped, not replayed on a later start.
const t0 = 1000000;
const ui5 = mk('ui5'); services.set('wsConn', ui5);
setPending({ type: 9, payload: { type: 'appControl' } }, services, t0);
ui5.isReady = true;
deliverPending(services, t0 + 61000);
assert.equal(ui5.got.length, 0, 'stale event must be dropped');
deliverPending(services, t0 + 62000);
assert.equal(ui5.got.length, 0, 'and stay dropped');
console.log('pendingLaunch: all checks passed');
