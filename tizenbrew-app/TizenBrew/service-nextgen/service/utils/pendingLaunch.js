"use strict";

// Holds the "what to open after the debug relaunch" event (autolaunch / app control)
// until the relaunched UI is ready for it.
//
// Upstream pushed it to whichever UI socket connected last. During the relaunch that is
// often the old UI that is just exiting, so the event was lost and autolaunch failed
// (github.com/reisxd/TizenBrew/issues/151). A UI only counts as ready once it has asked
// for the module list, which only the relaunched UI does.

// Expire it so an undelivered launch (e.g. the UI crashed) doesn't fire on some later start.
const MAX_AGE_MS = 60000;

let pending = null;
let pendingSince = 0;

function setPending(event, services, now) {
    pending = event;
    pendingSince = now || Date.now();
    deliverPending(services, now);
}

function deliverPending(services, now) {
    if (!pending) return;
    if ((now || Date.now()) - pendingSince > MAX_AGE_MS) {
        pending = null;
        return;
    }
    const conn = services.get('wsConn');
    if (!conn || !conn.isReady || conn.connection.readyState !== 1 /* OPEN */) return;
    const event = pending;
    pending = null;
    conn.send(event);
}

module.exports = { setPending, deliverPending };
