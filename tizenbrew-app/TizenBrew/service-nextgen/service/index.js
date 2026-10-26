"use strict";

module.exports.onStart = function () {
    console.log('Service started');
    // Last-resort safety net: log instead of letting one bad request or module kill the service.
    process.on('uncaughtException', (e) => console.error('TizenBrew service error:', e && (e.stack || e)));
    process.on('unhandledRejection', (e) => console.error('TizenBrew service rejection:', e && (e.stack || e)));
    const adbhost = require('adbhost');
    const express = require('express');
    const fetch = require('node-fetch');
    const path = require('path');
    const { readConfig, writeConfig } = require('./utils/configuration.js');
    const loadModules = require('./utils/moduleLoader.js');
    const startDebugging = require('./utils/debugger.js');
    const { deliverPending } = require('./utils/pendingLaunch.js');
    const startService = require('./utils/serviceLauncher.js');
    const { Connection, Events } = require('./utils/wsCommunication.js');
    let WebSocket;
    if (process.version === 'v4.4.3') {
        WebSocket = require('ws-old');
    } else {
        WebSocket = require('ws-new');
    }


    const app = express();
    let deviceIP;
    const isTizen3 = tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version').startsWith('3.0');

    // HTTP Proxy for modules 
    // Only installed modules are proxied, and errors get a status instead of crashing the service.
    app.all('*', (req, res) => {
        if (req.url.startsWith('/module/')) {
            const splittedUrl = req.url.split('/');
            const encodedModuleName = splittedUrl[2];
            let moduleName;
            try {
                moduleName = decodeURIComponent(encodedModuleName);
            } catch (e) {
                return res.status(400).end();
            }
            if (readConfig().modules.indexOf(moduleName) === -1) return res.status(403).end();
            const filePath = req.url.replace(`/module/${encodedModuleName}/`, '');
            fetch(`https://cdn.jsdelivr.net/${moduleName}/${filePath}`, { timeout: 15000 })
                .then(fetchRes => {
                    res.status(fetchRes.status);
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    // Type from the file extension, as upstream did: jsDelivr serves .html as text/plain.
                    const base = path.basename(filePath.split('?')[0]);
                    const ext = base.indexOf('.') > 0 ? base.split('.').pop() : '';
                    if (ext) res.type(ext);
                    else if (fetchRes.headers.get('content-type')) res.setHeader('Content-Type', fetchRes.headers.get('content-type'));
                    fetchRes.body.on('error', () => res.destroy());
                    fetchRes.body.pipe(res);
                })
                .catch(() => {
                    if (!res.headersSent) res.status(502).end();
                    else res.destroy();
                });
        } else {
            res.send(deviceIP);
        }
    });

    // Only TizenBrew's own pages may drive the service: websites shown on the TV must not be able
    // to add modules or run module code. The TizenBrew UI is always the first page to connect (it is
    // what starts this service), so its origin (file://, "null", ...) is remembered and only that one,
    // plus app pages served from this service on :8081, is accepted afterwards.
    let uiOrigin = null;
    function allowedOrigin(origin) {
        if (!origin) return true;                          // not a browser page
        if (/^https?:\/\//i.test(origin)) return /^https?:\/\/(127\.0\.0\.1|localhost):8081$/i.test(origin);
        if (uiOrigin === null) {
            uiOrigin = origin;
            console.log('TizenBrew UI origin:', origin);
        }
        return origin === uiOrigin;
    }
    const httpServer = app.listen(8081, "127.0.0.1");
    httpServer.on('error', (e) => {
        console.error('TizenBrew HTTP server error:', e && e.message);
        // Port taken: exit (as an upstream crash would) instead of staying alive but unreachable.
        if (e && e.code === 'EADDRINUSE') process.exit(1);
    });
    const wsServer = new WebSocket.Server({
        server: httpServer,
        verifyClient: (info) => allowedOrigin(info.origin || (info.req && info.req.headers.origin))
    });
    wsServer.on('error', (e) => console.error('TizenBrew WebSocket server error:', e && e.message));

    let adbClient;
    let canLaunchInDebug = null;
    // Asks the TV whether Developer Mode points at the TV itself (Host PC IP 127.0.0.1).
    // Right after the TV starts, its settings API (port 8001) refuses connections on 127.0.0.1 for a
    // while, so each try also asks the TV's own network address, and failures are retried for up to
    // ~2 minutes (upstream retried forever). The UI shows its start-up spinner meanwhile. The reason
    // for a "no" is kept in debugProblem so the UI can show it.
    const os = require('os');
    const DEBUG_CHECK_TRIES = Number(process.env.TIZENBREW_DEBUGCHECK_TRIES) || 120;
    let debugProblem = '';
    let adbFailure = null;   // { time, message } when the TV's debug bridge refused us
    function settingsApiUrls() {
        const urls = ['http://127.0.0.1:8001/api/v2/'];
        const nets = os.networkInterfaces();
        Object.keys(nets).forEach(name => (nets[name] || []).forEach(n => {
            if (n.family === 'IPv4' && !n.internal && n.address.indexOf('169.254.') !== 0) urls.push(`http://${n.address}:8001/api/v2/`);
        }));
        return urls;
    }
    function askSettingsApi(urls, i, lastError) {
        if (i >= urls.length) return Promise.reject(lastError);
        return fetch(urls[i], { timeout: 3000 }).then(res => res.json())
            .catch(e => askSettingsApi(urls, i + 1, lastError || e));
    }
    let debugCheck = null;   // one check at a time; concurrent askers share it
    function checkCanLaunchInDebug() {
        if (debugCheck) return debugCheck;
        const attempt = (tries) => askSettingsApi(settingsApiUrls(), 0)
            .then(json => {
                const d = (json && json.device) || {};
                canLaunchInDebug = (d.developerIP === '127.0.0.1' || d.developerIP === '1.0.0.127') && d.developerMode === '1';
                debugProblem = canLaunchInDebug ? '' :
                    `The TV reports Developer Mode ${d.developerMode === '1' ? 'on' : 'off'} and Host PC IP ${d.developerIP || '(empty)'}.`;
                return canLaunchInDebug;
            })
            .catch(e => {
                if (tries + 1 < DEBUG_CHECK_TRIES) return new Promise(r => setTimeout(r, 1000)).then(() => attempt(tries + 1));
                canLaunchInDebug = false;
                debugProblem = `The TV did not answer the Developer Mode check (${e && e.message}).`;
                return false;
            });
        debugCheck = attempt(0);
        debugCheck.then(() => { debugCheck = null; });
        return debugCheck;
    }
    checkCanLaunchInDebug();
    const inDebug = {
        tizenDebug: false,
        webDebug: false,
        rwiDebug: false
    };

    const services = new Map();
    const queuedEvents = [];
    let modulesCache = null;

    const currentModule = {
        name: '',
        appPath: '',
        moduleType: '',
        packageType: '',
        serviceFile: ''
    };

    const appControlData = {
        module: null,
        args: null,
        // fullName of the app to open once the UI has restarted in debug mode (ReLaunchInDebug).
        launch: null
    };

    // Newest load wins (two loads can finish out of order); an overtaken load follows the newest.
    // modulesLoadedAt lets a fresh UI pick up module updates (see GetModules).
    let loadSeq = 0;
    let latestLoad = null;
    let modulesLoadedAt = 0;
    function reloadModules() {
        const seq = ++loadSeq;
        const load = loadModules().then(modules => {
            if (seq !== loadSeq) return latestLoad;
            // Keep a previously good entry if its refresh failed (slow network), instead of losing it.
            const previous = modulesCache || [];
            modules = modules.map(m => {
                if (!m.failed) return m;
                const good = previous.find(p => p.fullName === m.fullName && !p.failed);
                return good || m;
            });
            modulesCache = modules;
            modulesLoadedAt = Date.now();
            return modules;
        });
        latestLoad = load;
        return load;
    }
    function findModule(fullName) {
        return (modulesCache || []).find(m => m.fullName === fullName);
    }

    const modulesReady = reloadModules().then(modules => {
        // The UI stores one fullName (upstream expected an array of names, so this never ran).
        readConfig().autoLaunchServiceList.forEach(entry => {
            const service = modules.find(m => m.fullName === entry || m.name === entry);
            if (service && service.serviceFile && !service.failed) startService(service, services);
        });
        return modules;
    }).catch(e => {
        console.error('TizenBrew module load failed:', e && e.message);
        return modulesCache || [];
    });


    function createAdbConnection(ip, mdl) {
        deviceIP = ip;
        if (adbClient) {
            if (!adbClient._stream) {
                adbClient._stream.removeAllListeners('connect');
                adbClient._stream.removeAllListeners('error');
                adbClient._stream.removeAllListeners('close');
            }
        }

        adbClient = adbhost.createConnection({ host: '127.0.0.1', port: 26101 });
        let gotPort = false;

        adbClient._stream.on('connect', () => {
            console.log('ADB connection established');
            //Launch app
            const tbPackageId = tizen.application.getAppInfo().packageId;
            const shellCmd = adbClient.createStream(`shell:0 debug ${tbPackageId}.TizenBrewStandalone${isTizen3 ? ' 0' : ''}`);
            shellCmd.on('data', function dataIncoming(data) {
                const dataString = data.toString();
                if (dataString.includes('debug')) {
                    gotPort = true;
                    const port = Number(dataString.substr(dataString.indexOf(':') + 1, 6).replace(' ', ''));
                    startDebugging(port, queuedEvents, services, ip, mdl, inDebug, appControlData, false);
                    setTimeout(() => adbClient._stream.end(), 1000);
                }
            });
        });

        adbClient._stream.on('error', (e) => {
            console.log('ADB connection error. ' + e);
            if (gotPort) return;   // an error after the relaunch worked doesn't matter
            // The UI has already closed itself: reopen it and tell it why debug mode failed
            // (upstream just left TizenBrew closed).
            adbFailure = { time: Date.now(), message: String(e && e.message || e) };
            queuedEvents.push({ type: Events.Error, payload: `The TV's debug bridge refused TizenBrew (${adbFailure.message}). Check Host PC IP is 127.0.0.1, then hold the power button until the Samsung logo.` });
            try {
                tizen.application.launch(tizen.application.getAppInfo().packageId + '.TizenBrewStandalone');
            } catch (err) { }
        });
        adbClient._stream.on('close', () => {
            console.log('ADB connection closed.');
        });
    }


    wsServer.on('connection', (ws) => {
        const wsConn = new Connection(ws);
        for (const event of queuedEvents) {
            wsConn.send(event);
            queuedEvents.splice(queuedEvents.indexOf(event), 1);
        }
        services.set('wsConn', wsConn);
        // A closed UI must not receive the autolaunch event (pendingLaunch.js).
        ws.on('close', () => { wsConn.isReady = false; });
        ws.on('error', (e) => console.error('TizenBrew WebSocket error:', e && e.message));
        ws.on('message', (message) => {
            let msg;
            try {
                msg = JSON.parse(message)
            } catch (e) {
                return wsConn.send(wsConn.Event(Events.Error, `Invalid JSON: ${message}`));
            }
            if (!msg || typeof msg !== 'object') {
                return wsConn.send(wsConn.Event(Events.Error, 'Invalid message.'));
            }

            const { type, payload } = msg;

            try {
            switch (type) {
                case Events.AppControlData: {
                    // e.g. casting from the phone. On a cold start the module list may still be
                    // loading (upstream crashed here), so wait for it.
                    const pkg = payload && payload.package;
                    if (typeof pkg !== 'string') return wsConn.send(wsConn.Event(Events.Error, 'App Control module not found.'));
                    const shortName = pkg.substring(pkg.indexOf('/') + 1);
                    const args = payload.args;
                    (modulesCache ? Promise.resolve(modulesCache) : modulesReady).then(modules => {
                        const module = (modules || []).find(m => (m.name === shortName || m.fullName === pkg) && !m.failed);
                        if (!module) {
                            return wsConn.send(wsConn.Event(Events.Error, 'App Control module not found.'));
                        }
                        appControlData.module = module;
                        appControlData.args = args;
                        wsConn.send(wsConn.Event(Events.AppControlData, null));
                    });
                    break;
                }
                case Events.GetDebugStatus: {
                    wsConn.send(wsConn.Event(Events.GetDebugStatus, inDebug));
                    break;
                }
                case Events.CanLaunchInDebug: {
                    // Answer with a fresh check: the Host PC IP may have just been changed.
                    // After a debug-bridge failure in the last minute, say no (avoids a relaunch loop).
                    if (adbFailure && Date.now() - adbFailure.time < 60000) {
                        wsConn.send(wsConn.Event(Events.CanLaunchInDebug, false));
                        wsConn.send(wsConn.Event(Events.Error, `The TV's debug bridge refused TizenBrew (${adbFailure.message}). Check Host PC IP is 127.0.0.1, then hold the power button until the Samsung logo.`));
                        break;
                    }
                    checkCanLaunchInDebug().then(value => {
                        wsConn.send(wsConn.Event(Events.CanLaunchInDebug, value));
                        // Show the actual reason (the UI's own message is generic).
                        if (!value && debugProblem) wsConn.send(wsConn.Event(Events.Error, `${debugProblem} TizenBrew needs Developer Mode on with Host PC IP 127.0.0.1, then hold the power button until the Samsung logo.`));
                    });
                    break;
                }
                case Events.ReLaunchInDebug: {
                    // Newer UIs say which app to open after the restart; only installed apps are accepted.
                    const launch = payload && typeof payload.launch === 'string' ? findModule(payload.launch) : null;
                    appControlData.launch = launch && !launch.failed ? launch.fullName : null;
                    setTimeout(() => {
                        createAdbConnection(payload && payload.tvIP, currentModule);
                    }, 1000);
                    break;
                }
                case Events.GetModules: {
                    wsConn.isReady = true;
                    services.set('wsConn', wsConn);

                    // Reload when asked, or when an earlier download failed (e.g. Wi-Fi not up yet at boot).
                    const hasFailed = modulesCache && modulesCache.some(m => m.failed);
                    // A UI's first request also refreshes a list older than 5 minutes, so module
                    // updates (e.g. a new TizenTube) apply on the next launch.
                    const stale = !wsConn.askedModules && modulesCache && Date.now() - modulesLoadedAt > 5 * 60 * 1000;
                    wsConn.askedModules = true;
                    if (payload || hasFailed || stale) {
                        reloadModules().then(modules => {
                            wsConn.send(wsConn.Event(Events.GetModules, modules));
                            deliverPending(services);
                        });
                    } else {
                        wsConn.send(wsConn.Event(Events.GetModules, modulesCache));
                        // Modules still loading: the UI asks again, and we deliver then.
                        if (modulesCache) deliverPending(services);
                    }
                    break;
                }
                case Events.LaunchModule: {
                    // Use our own copy of the module, never the one in the message.
                    const mdl = findModule(payload && payload.fullName);
                    if (!mdl) return wsConn.send(wsConn.Event(Events.Error, 'Module not found.'));
                    currentModule.fullName = mdl.fullName;
                    currentModule.version = mdl.version;
                    currentModule.name = mdl.name;
                    currentModule.appPath = mdl.appPath;
                    currentModule.moduleType = mdl.moduleType;
                    currentModule.packageType = mdl.packageType;
                    currentModule.serviceFile = mdl.serviceFile;

                    if (mdl.packageType === 'app') {
                        // Upstream cleared inDebug here, so coming back from an app made TizenBrew relaunch
                        // itself (close + reopen). The debug session survives the navigation; if it really
                        // drops, the debugger's 'disconnect' handler clears inDebug.
                        // App pages get no script: don't keep the last mod's (e.g. TizenTube's) file to inject.
                        currentModule.mainFile = '';
                        currentModule.tizenAppId = '';
                        currentModule.evaluateScriptOnDocumentStart = false;
                    } else {
                        currentModule.mainFile = mdl.mainFile;
                        currentModule.tizenAppId = mdl.tizenAppId;
                        currentModule.evaluateScriptOnDocumentStart = mdl.evaluateScriptOnDocumentStart;
                    }

                    if (mdl.serviceFile) {
                        if (services.has(mdl.fullName)) {
                            if (services.get(mdl.fullName).hasCrashed) {
                                services.delete(mdl.fullName);
                                startService(mdl, services);
                            }
                        } else startService(mdl, services);
                    }
                    break;
                }
                case Events.StartService: {
                    const mdl = findModule(payload && payload.fullName);
                    if (!mdl || !mdl.serviceFile) return wsConn.send(wsConn.Event(Events.Error, 'Module not found.'));
                    if (services.has(mdl.fullName)) {
                        if (services.get(mdl.fullName).hasCrashed) {
                            services.delete(mdl.fullName);
                            startService(mdl, services);
                        }
                    } else startService(mdl, services);
                    break;
                }
                case Events.GetServiceStatuses: {
                    const serviceList = [];
                    for (const map of services) {
                        serviceList.push({
                            name: map[0],
                            hasCrashed: map[1].hasCrashed,
                            error: map[1].error
                        });
                    }
                    wsConn.send(wsConn.Event(Events.GetServiceStatuses, serviceList));
                    break;
                }
                case Events.ModuleAction: {
                    const { action, module } = payload;

                    const config = readConfig();
                    switch (action) {
                        case 'add': {
                            const index = config.modules.findIndex(m => m === module);
                            if (index === -1) {
                                config.modules.push(module);
                                if (!writeConfig(config)) wsConn.send(wsConn.Event(Events.Error, 'Could not save TizenBrew settings.'));
                            }
                            break;
                        }
                        case 'remove': {
                            const index = config.modules.findIndex(m => m === module);
                            if (index !== -1) {
                                config.modules.splice(index, 1);
                                if (!writeConfig(config)) wsConn.send(wsConn.Event(Events.Error, 'Could not save TizenBrew settings.'));
                            }
                            break;
                        }
                        case 'autolaunch': {
                            config.autoLaunchModule = module;
                            if (!writeConfig(config)) wsConn.send(wsConn.Event(Events.Error, 'Could not save TizenBrew settings.'));
                            break;
                        }
                        case 'autolaunchService': {
                            config.autoLaunchServiceList = module;
                            if (!writeConfig(config)) wsConn.send(wsConn.Event(Events.Error, 'Could not save TizenBrew settings.'));
                            break;
                        }
                    }
                    break;
                }
                case Events.GetConfig: {
                    // The current choices, for Settings to show.
                    const config = readConfig();
                    wsConn.send(wsConn.Event(Events.GetConfig, {
                        autoLaunchModule: config.autoLaunchModule,
                        autoLaunchServiceList: config.autoLaunchServiceList
                    }));
                    break;
                }
                case Events.Ready: {
                    wsConn.isReady = true;
                    services.set('wsConn', wsConn);
                    deliverPending(services);
                    break;
                }
                default: {
                    wsConn.send(wsConn.Event(Events.Error, 'Invalid event type.'));
                    break;
                }
            }
            } catch (e) {
                // A bad payload used to throw here and stop the whole service.
                console.error('TizenBrew request failed:', e && (e.stack || e));
                wsConn.send(wsConn.Event(Events.Error, 'Request failed.'));
            }
        });
    });
}
