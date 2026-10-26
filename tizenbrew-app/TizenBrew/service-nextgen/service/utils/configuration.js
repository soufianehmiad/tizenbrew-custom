"use strict";

const fs = require('fs');

// TIZENBREW_CONFIG only exists for tests on a PC; the TV always uses the shared path.
const CONFIG_PATH = process.env.TIZENBREW_CONFIG || '/home/owner/share/tizenbrewConfig.json';

function defaults() {
    return {
        modules: ["npm/@foxreis/tizentube"],
        autoLaunchServiceList: [],
        autoLaunchModule: '',
    };
}

function readConfig() {
    if (!fs.existsSync(CONFIG_PATH)) return defaults();
    let raw;
    try {
        raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        const config = Object.assign(defaults(), JSON.parse(raw));
        // Normalise shapes older UIs or hand edits may have stored.
        if (!Array.isArray(config.modules)) config.modules = defaults().modules;
        config.autoLaunchServiceList = [].concat(config.autoLaunchServiceList || []).filter(Boolean);
        if (typeof config.autoLaunchModule !== 'string') config.autoLaunchModule = '';
        return config;
    } catch (e) {
        // A damaged file used to stop the service from starting at all. Keep a copy and carry on.
        console.error('TizenBrew config unreadable, using defaults:', e && e.message);
        try { if (raw !== undefined) fs.writeFileSync(CONFIG_PATH + '.broken', raw); } catch (_) { }
        return defaults();
    }
}

function writeConfig(config) {
    // Write a temporary file and rename it, so a power cut can't leave half a file behind.
    const tmp = CONFIG_PATH + '.tmp';
    try {
        fs.writeFileSync(tmp, JSON.stringify(config, null, 4));
        fs.renameSync(tmp, CONFIG_PATH);
        return true;
    } catch (e) {
        console.error('TizenBrew config could not be saved:', e && e.message);
        return false;
    }
}

module.exports = {
    readConfig,
    writeConfig,
    CONFIG_PATH
};
