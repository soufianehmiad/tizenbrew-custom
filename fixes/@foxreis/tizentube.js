// TizenBrew fix for TizenTube (loaded by TizenBrew right after TizenTube; see service utils/fixes.js).
//
// "Enable High Quality Thumbnails" makes TizenTube ask YouTube for each video's 640x480 thumbnail
// (sddefault.jpg). Older and low-resolution videos don't have one: YouTube then answers with a grey
// "no image" placeholder (HTTP 404, 120x90), which ends up on screen. This swaps those for the
// 480x360 thumbnail (hqdefault.jpg), which every video has. Videos that have the HD thumbnail keep it.
// Videos found without one are remembered, so next time they are swapped before anything shows.
(function () {
    'use strict';
    if (window.__tizenbrewThumbFix) return;
    window.__tizenbrewThumbFix = true;

    // i.ytimg.com/vi/<id>/sddefault.jpg (also the larger sizes, in case TizenTube switches to them)
    var HD = /^(https?:\/\/i\.ytimg\.com\/vi(?:_webp)?\/([\w-]{6,})\/)(sddefault|maxresdefault|hq720)(\.(?:jpg|webp))/;
    var STORE = 'tizenbrew-thumbfix-missing';
    var missing = {};   // video id -> no HD thumbnail (kept across launches)
    var good = {};      // video id -> HD thumbnail exists (this session)
    var waiting = {};   // video id -> callbacks while it is being checked
    var log = function () { if (window.__tizenbrewThumbFixDebug) console.log.apply(console, ['thumbfix:'].concat([].slice.call(arguments))); };

    try {
        JSON.parse(localStorage.getItem(STORE) || '[]').forEach(function (id) { missing[id] = 1; });
    } catch (e) { }

    function remember(id) {
        missing[id] = 1;
        try {
            var ids = Object.keys(missing);
            if (ids.length > 3000) ids = ids.slice(ids.length - 3000);
            localStorage.setItem(STORE, JSON.stringify(ids));
        } catch (e) { }
    }

    function fallback(url) {
        return url.replace(HD, function (all, base, id, size, ext) { return base + 'hqdefault' + ext; });
    }

    // Load the HD thumbnail once off-screen; the placeholder is 120 px wide (or fails as a 404).
    function check(url, id, swap) {
        if (good[id]) return;
        if (missing[id]) { swap(); return; }
        if (waiting[id]) { waiting[id].push(swap); return; }
        waiting[id] = [swap];
        var img = new Image();
        var finish = function (isMissing) {
            var list = waiting[id] || [];
            delete waiting[id];
            if (!isMissing) { good[id] = 1; return; }
            remember(id);
            log('no HD thumbnail for', id);
            for (var i = 0; i < list.length; i++) list[i]();
        };
        img.onload = function () { finish(img.naturalWidth <= 120); };
        img.onerror = function () { finish(true); };
        img.src = url;
    }

    // YouTube's TV interface draws thumbnails as inline background images (ytlr-thumbnail-details).
    function fixElement(el) {
        var bg = el.style && el.style.backgroundImage;
        if (!bg || bg.indexOf('i.ytimg.com') < 0) return;
        var m = bg.match(/url\(["']?([^"')]+)["']?\)/);
        if (!m) return;
        var url = m[1];
        var hd = url.match(HD);
        if (!hd) return;
        check(url, hd[2], function () {
            if ((el.style.backgroundImage || '').indexOf(url) >= 0) el.style.backgroundImage = 'url("' + fallback(url) + '")';
        });
    }

    function scan(node) {
        if (!node || node.nodeType !== 1) return;
        fixElement(node);
        var list = node.querySelectorAll('[style*="i.ytimg.com"]');
        for (var i = 0; i < list.length; i++) fixElement(list[i]);
    }

    function start() {
        new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.type === 'attributes') fixElement(m.target);
                else for (var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]);
            }
        }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
        scan(document.documentElement);
    }

    try {
        if (document.documentElement) start();
        else document.addEventListener('DOMContentLoaded', start);
    } catch (e) {
        console.error('TizenBrew thumbnail fix:', e);
    }
})();
