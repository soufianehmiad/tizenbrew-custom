// Icons for apps (modules). Modules don't ship icons, so known ones are matched by package
// name and shown with their official logo; anything else gets a coloured letter tile.
import youtubeIcon from '../assets/youtube-icon.svg'; // official, play button from gstatic.com/youtube/img/branding (vector)
import youtubeLogo from '../assets/youtube-logo-dark.svg'; // official, gstatic.com/youtube/img/branding (dark-mode logo)
import jellyfinIcon from '../assets/jellyfin.svg'; // official, github.com/jellyfin/jellyfin-ux
import stremioIcon from '../assets/stremio.png';   // official, web.stremio.com manifest
import { NEUTRAL_TINT } from './ui.jsx';

const KNOWN = [
    // splash: what the app's own TV app shows while it starts (TizenTube opens like the YouTube app).
    // tile: Home screen tile colour and logo size. YouTube's icon sits on YouTube red, so only its white
    // play triangle shows, as on YouTube's own tiles.
    { match: /^@foxreis\/tizentube$/i, icon: youtubeIcon, tint: '255,0,51', size: 260, tile: { bg: '#FF0000', size: 150 }, splash: { img: youtubeLogo, width: 440, bg: '#0F0F0F' } },
    { match: /jellyfin/i, icon: jellyfinIcon, tint: '170,92,195', size: 236, tile: { bg: '#101828', size: 150 } },
    { match: /stremio/i, icon: stremioIcon, tint: '123,91,245', size: 248, tile: { bg: '#2A1E5C', size: 160 } }
];

const COLORS = ['37,99,235', '124,58,237', '219,39,119', '234,88,12', '22,163,74', '8,145,178'];

function known(module) {
    return KNOWN.find(k => k.match.test((module && module.name) || ''));
}

function letterColor(module) {
    const name = (module && (module.appName || module.name)) || '?';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return COLORS[hash % COLORS.length];
}

export function moduleIcon(module) {
    const k = known(module);
    return k ? k.icon : null;
}

export function moduleSplash(module) {
    const k = known(module);
    return k && k.splash ? k.splash : null;
}

// Home screen tile: flat square in the app's colour (letter tiles: their letter colour).
export function moduleTile(module) {
    const k = known(module);
    if (k && k.tile) return k.tile;
    return { bg: `rgb(${module ? letterColor(module) : NEUTRAL_TINT})`, size: 0 };
}

export function moduleTint(module) {
    const k = known(module);
    return k ? k.tint : (module ? letterColor(module) : NEUTRAL_TINT);
}

export default function ModuleIcon({ module, size, plain }) {
    const k = known(module);
    if (k) {
        const s = size || k.size;
        return <img src={k.icon} alt="" style={{ width: s + 'px', height: s + 'px', objectFit: 'contain', display: 'block' }} />;
    }
    const name = (module && (module.appName || module.name)) || '?';
    // plain: just the letter, for a tile that already has the colour.
    return (
        <span className={plain ? 'tb-letter tb-letter-plain' : 'tb-letter'} style={plain ? null : { background: `rgb(${letterColor(module)})` }}>
            {name.trim().charAt(0).toUpperCase()}
        </span>
    );
}
