"use strict";

// App modules (pages served from :8081/module/...) often ignore the Back key, which left the user
// stuck (e.g. TizenGlow). This script returns to TizenBrew unless the app handled Back itself.
// Registered first on window (bubble phase), it checks after all other handlers ran (setTimeout 0)
// whether the app used Back (preventDefault).
//
// It reaches the page two ways: added to app pages as the service serves them (index.js; no debug
// mode needed, so opening an app doesn't restart TizenBrew), and through the debugger when TizenBrew
// is in debug mode (debugger.js). The flag makes sure it runs once.
const BACK_TO_TIZENBREW = `(function () {
    if (window.__tbBackFix) return;
    if (location.host !== '127.0.0.1:8081' || location.pathname.indexOf('/module/') !== 0) return;
    window.__tbBackFix = true;
    window.addEventListener('keydown', function (e) {
        if (e.keyCode !== 10009) return;
        setTimeout(function () {
            if (e.defaultPrevented) return;
            if (history.length > 1) history.back();
            else location.href = 'file:///tizenbrew-ui/dist/index.html';
        }, 0);
    });
})();`;

// Put the script at the very start of an HTML page (before the app's own scripts).
function addBackKey(html) {
    const tag = '<script>' + BACK_TO_TIZENBREW + '</script>';
    const head = html.match(/<head(\s[^>]*)?>/i);   // not <header>
    if (head) return html.replace(head[0], head[0] + tag);
    const htmlTag = html.match(/<html(\s[^>]*)?>/i);
    if (htmlTag) return html.replace(htmlTag[0], htmlTag[0] + tag);
    return tag + html;
}

module.exports = { BACK_TO_TIZENBREW, addBackKey };
