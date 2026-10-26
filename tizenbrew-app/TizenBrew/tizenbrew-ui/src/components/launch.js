// Opening an app.
//
// Apps need TizenBrew in debug mode (that is how mods like TizenTube get into the page, and how Back
// returns from apps). Getting into debug mode means TizenBrew closes and the TV reopens it. Upstream did
// that at every start, so TizenBrew always opened, closed and opened again. Now Home opens directly, and
// the restart happens only when an app is opened: its splash stays up, TizenBrew restarts and opens it.
// A note in localStorage lets the restarted TizenBrew show the same splash from its first frame.
import { Events } from './WebSocketClient.js';
import { isBroken, appLabel } from './ui.jsx';

const HINT = 'tbOpening';
const HINT_MAX_AGE = 90000;

// The app being opened across the restart, as far as the splash needs it.
export function readOpeningHint() {
    try {
        const h = JSON.parse(localStorage.getItem(HINT) || 'null');
        if (h && Date.now() - h.t < HINT_MAX_AGE) return { fullName: h.fullName, name: h.name, appName: h.appName, keys: [] };
        if (h) localStorage.removeItem(HINT);
    } catch (e) { }
    return null;
}

export function clearOpeningHint() {
    try { localStorage.removeItem(HINT); } catch (e) { }
}

function saveOpeningHint(module) {
    try {
        localStorage.setItem(HINT, JSON.stringify({ fullName: module.fullName, name: module.name, appName: module.appName, t: Date.now() }));
    } catch (e) { }
}

// Open now if TizenBrew is already in debug mode, otherwise restart into it and open after.
export function openModule(module) {
    const dispatch = window.dispatch;
    const client = window.state && window.state.client;
    if (isBroken(module)) {
        dispatch({ type: 'SET_ERROR', payload: { message: 'errors.moduleNotFound', args: { moduleName: appLabel(module) }, disappear: true } });
        return;
    }
    if (!client) return;
    dispatch({ type: 'SET_OPENING', payload: module });
    if (window.tbNeedsDebug) {
        saveOpeningHint(module);
        client.relaunchFor(module);
        return;
    }
    clearOpeningHint();
    for (const key of module.keys || []) {
        try { tizen.tvinputdevice.registerKey(key); } catch (e) { }
    }
    client.send({ type: Events.LaunchModule, payload: module });
    if (!module.evaluateScriptOnDocumentStart) location.href = module.appPath;
}
