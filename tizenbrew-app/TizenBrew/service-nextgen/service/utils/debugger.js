"use strict";

const CDP = require('chrome-remote-interface');
const fetch = require('node-fetch');
const { Events } = require('./wsCommunication.js');
const { readConfig } = require('./configuration.js');
const { setPending } = require('./pendingLaunch.js');
const { fetchFixes } = require('./fixes.js');
const WebSocket = require('ws');

const modulesCache = new Map();

// Back returns to TizenBrew from app pages (see backKey.js); also added by the service to app pages.
const { PAGE_SCRIPT } = require('./backKey.js');

// Module code, cached per module *version* so a new release is picked up on the next launch.
function cacheKey(mdl) {
    return `${mdl.fullName}@${mdl.version || ''}`;
}

// Fetch a module's main file; an HTTP error page must not be injected (or cached) as module code.
function fetchModuleCode(mdl) {
    // npm modules: fetch the exact version the cache key names (an unversioned URL can briefly
    // serve another version). Pinned names (npm/x@1.2.3) and GitHub modules are used as they are.
    const pkg = mdl.fullName.indexOf('npm/') === 0 ? mdl.fullName.slice(4) : '';
    const pinned = pkg.lastIndexOf('@') > 0;
    const base = pkg && !pinned && mdl.version ? `${mdl.fullName}@${mdl.version}` : mdl.fullName;
    return fetch(`https://cdn.jsdelivr.net/${base}/${mdl.mainFile}`, { timeout: 15000 })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text();
        });
}

function startDebugging(port, queuedEvents, clientConn, ip, mdl, inDebug, appControlData, isAnotherApp, attempts) {
    if (!attempts) attempts = 1;
    if (!isAnotherApp) inDebug.tizenDebug = true;
    try {
        CDP({ port, host: ip, local: true }, (client) => {
            let earlyInjected = false;
            // This app's fixes from the fork's repo (fixes.js). Fetched when the app is injected (which
            // app that is isn't known yet when the debugger connects), once per app per session.
            let fixesFor = null;
            let fixesPromise = null;
            const getFixes = () => {
                if (!mdl || !mdl.name) return Promise.resolve('');
                if (fixesFor !== mdl.name) { fixesFor = mdl.name; fixesPromise = fetchFixes(mdl); }
                return fixesPromise;
            };
            let alerted = false; // show the failed-to-load message once, not once per frame
            client.Runtime.enable();
            client.Debugger.enable();
            // App modules (pages served from :8081/module/...) often ignore the Back key, which left the
            // user stuck (e.g. TizenGlow). Back returns to TizenBrew unless the app handled it itself.
            if (!isAnotherApp) {
                client.Page.enable();
                client.Page.addScriptToEvaluateOnNewDocument({ source: PAGE_SCRIPT, expression: PAGE_SCRIPT });
            }

            client.on('Runtime.executionContextCreated', (msg) => {
                if (mdl.packageType !== 'app' && !mdl.evaluateScriptOnDocumentStart && mdl.name !== '') {
                    const cache = modulesCache.get(cacheKey(mdl));
                    const runFixes = () => { getFixes().then(code => { if (code) client.Runtime.evaluate({ expression: code, contextId: msg.context.id }); }); };
                    if (cache) {
                        client.Runtime.evaluate({ expression: cache, contextId: msg.context.id });
                        runFixes();
                    } else {
                        fetchModuleCode(mdl).then(modFile => {
                            modulesCache.set(cacheKey(mdl), modFile);
                            client.Runtime.evaluate({ expression: modFile, contextId: msg.context.id });
                            runFixes();
                        }).catch(e => {
                            if (!alerted && (alerted = true)) client.Runtime.evaluate({ expression: `alert("Failed to load module: '${mdl.fullName}'. Please relaunch TizenBrew to try again.")`, contextId: msg.context.id });
                        });
                    }
                } else if (mdl.packageType !== 'app' && mdl.name !== '' && mdl.evaluateScriptOnDocumentStart && !earlyInjected) {
                    earlyInjected = true;
                    const cache = modulesCache.get(cacheKey(mdl));
                    // The module first, then its fixes (separate scripts: a broken fix can't break the module),
                    // and only then tell the UI to open the page.
                    const addAndLaunch = (modFile) => getFixes().then(code => {
                        client.Page.addScriptToEvaluateOnNewDocument({ expression: modFile });
                        if (code) client.Page.addScriptToEvaluateOnNewDocument({ expression: code });
                        sendClientInformation(clientConn, { type: Events.LaunchModule, payload: mdl.fullName });
                    });
                    if (cache) {
                        addAndLaunch(cache);
                    } else {
                        fetchModuleCode(mdl).then(modFile => {
                            modulesCache.set(cacheKey(mdl), modFile);
                            return addAndLaunch(modFile);
                        }).catch(e => {
                            sendClientInformation(clientConn, { type: Events.LaunchModule, payload: mdl.fullName });
                            client.Page.addScriptToEvaluateOnNewDocument({ expression: `alert("Failed to load module: '${mdl.fullName}'. Please relaunch TizenBrew to try again.")` });
                        });
                    }
                }
            });

            client.on('disconnect', () => {
                if (isAnotherApp) return;

                inDebug.tizenDebug = false;
                inDebug.webDebug = false;
                inDebug.rwiDebug = false;

                mdl.fullName = '';
                mdl.name = '';
                mdl.appPath = '';
                mdl.moduleType = '';
                mdl.packageType = '';
                mdl.serviceFile = '';
                mdl.mainFile = '';
            });

            if (!isAnotherApp) {
                // Held until the relaunched UI is ready (see pendingLaunch.js).
                let payload = null;
                if (appControlData && appControlData.launch) {
                    // The UI restarted in debug mode to open this app (it opens Home without restarting
                    // and only restarts when an app is opened). One-shot.
                    payload = { type: 'launch', module: appControlData.launch };
                    appControlData.launch = null;
                } else if (appControlData && appControlData.module) {
                    payload = {
                        type: 'appControl',
                        module: appControlData.module,
                        args: appControlData.args
                    };
                    // One-shot: don't replay this on the next normal launch.
                    appControlData.module = null;
                    appControlData.args = null;
                } else {
                    const config = readConfig();
                    if (config.autoLaunchModule) {
                        payload = { type: 'autolaunch', module: config.autoLaunchModule };
                    }
                }
                inDebug.webDebug = true;
                setPending({ type: Events.CanLaunchModules, payload }, clientConn);
            }
        }).on('error', (err) => {
            if (attempts >= 15) {
                if (!isAnotherApp) {
                    const conn = clientConn.get('wsConn');
                    if (conn) conn.send(conn.Event(Events.Error, `Failed to connect to the debugger on port ${port} (${(err && err.message) || err}).`));
                    inDebug.tizenDebug = false;
                    return;
                } else return;
            }
            attempts++;
            setTimeout(() => startDebugging(port, queuedEvents, clientConn, ip, mdl, inDebug, appControlData, isAnotherApp, attempts), 750)
        });
    } catch (e) {
        if (attempts >= 15) {
            if (!isAnotherApp) {
                const conn = clientConn.get('wsConn');
                if (conn) conn.send(conn.Event(Events.Error, `Failed to connect to the debugger on port ${port} (${(e && e.message) || e}).`));
                inDebug.tizenDebug = false;
                return;
            } else return;
        }
        attempts++;
        setTimeout(() => startDebugging(port, queuedEvents, clientConn, ip, mdl, inDebug, appControlData, isAnotherApp, attempts), 750)
        return;
    }
}

function sendClientInformation(clientConn, data, tries) {
    tries = tries || 0;
    const clientConnection = clientConn.get('wsConn');
    if ((clientConnection && clientConnection.connection && (clientConnection.connection.readyState !== WebSocket.OPEN && !clientConnection.isReady)) || !clientConnection) {
        if (tries >= 200) return; // ~10 s: nobody is listening any more
        return setTimeout(() => sendClientInformation(clientConn, data, tries + 1), 50);
    }
    setTimeout(() => {
        clientConnection.send(data);
    }, 500);
}

module.exports = startDebugging;