// Opening an app.
//
// Mods (scripts added to a website, like the TizenTube module) need TizenBrew in debug mode, and getting
// into debug mode means TizenBrew closes and the TV reopens it. Upstream did that at every start. Now:
// - TizenTube opens the standalone TizenTube app when it is installed (plain app switch);
// - app modules (TizenGlow, Jellyfin...) open directly: the service adds the Back key fix to their pages;
// - only a mod restarts TizenBrew, behind its splash, and a note in localStorage lets the restarted
//   TizenBrew show the same splash from its first frame.
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

// The standalone TizenTube app (reisxd/TizenTube "TizenTube Cobalt", installed with Apps2Samsung):
// YouTube's own TV engine with TizenTube built in. When it's on the TV, the TizenTube tile opens it:
// a plain app switch, no debug mode, no restart.
const TIZENTUBE_APP = 'xvvl3S1TT1.TizenTubeStandalone';
const isTizenTube = (module) => /^(npm\/)?@foxreis\/tizentube$/i.test(module.fullName || module.name || '');

function hasApp(appId) {
    try { tizen.application.getAppInfo(appId); return true; } catch (e) { return false; }
}

// Only mods (scripts added to a website, like the TizenTube module) need debug mode. App pages get
// the Back key fix from the service as it serves them, so they open directly.
const needsDebug = (module) => module.packageType !== 'app';

// Open now if possible, otherwise restart into debug mode and open after.
export function openModule(module) {
    if (isTizenTube(module) && hasApp(TIZENTUBE_APP)) {
        clearOpeningHint();
        try {
            tizen.application.launch(TIZENTUBE_APP, null, () => openModuleInBrew(module));
            return;
        } catch (e) { /* fall back to the module */ }
    }
    openModuleInBrew(module);
}

function openModuleInBrew(module) {
    const dispatch = window.dispatch;
    const client = window.state && window.state.client;
    if (isBroken(module)) {
        dispatch({ type: 'SET_ERROR', payload: { message: 'errors.moduleNotFound', args: { moduleName: appLabel(module) }, disappear: true } });
        return;
    }
    if (!client) return;
    dispatch({ type: 'SET_OPENING', payload: module });
    if (window.tbNeedsDebug && needsDebug(module)) {
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
