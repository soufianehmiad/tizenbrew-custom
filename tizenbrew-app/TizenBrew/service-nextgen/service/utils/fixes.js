"use strict";

// Small fixes for apps (modules), kept in this fork's GitHub repo under fixes/<module name>.js and
// injected right after the module itself, e.g. fixes/@foxreis/tizentube.js. They are fetched at every
// launch, so a fix reaches the TV without reinstalling TizenBrew.
// A missing file means "no fix"; a fetch problem falls back to the last copy seen in this session,
// and never delays the app by more than a few seconds or stops it from opening.
const fetch = require('node-fetch');

const FIXES_BASE = process.env.TIZENBREW_FIXES_URL ||
    'https://raw.githubusercontent.com/soufianehmiad/tizenbrew-custom/main/fixes/';
const lastGood = new Map();

function fixesUrl(mdl) {
    return FIXES_BASE + String(mdl.name || '').split('/').map(encodeURIComponent).join('/') + '.js';
}

function fetchFixes(mdl) {
    if (!mdl || !mdl.name) return Promise.resolve('');
    return fetch(fixesUrl(mdl), { timeout: 4000 })
        .then(res => {
            if (res.status === 404) { lastGood.delete(mdl.name); return ''; }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text().then(code => { lastGood.set(mdl.name, code); return code; });
        })
        .catch(e => {
            console.error('TizenBrew fixes: could not load for', mdl.name, e && e.message);
            return lastGood.get(mdl.name) || '';
        });
}

module.exports = { fetchFixes, fixesUrl };
