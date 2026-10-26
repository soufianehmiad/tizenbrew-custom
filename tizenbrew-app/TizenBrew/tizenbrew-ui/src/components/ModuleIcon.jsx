// What each app looks like: tile colours, glyph, the photo behind it on Home, and its splash.
// Modules don't ship artwork, so known ones are matched by package name; any other app gets
// its first letter on a graphite tile and a neutral backdrop.
import youtubeLogo from '../assets/youtube-logo-dark.svg'; // official, gstatic.com/youtube/img/branding (dark-mode logo)
import tubePhoto from '../assets/shelf-tube.jpg';       // Unsplash licence (photo-1478720568477)
import tubeBlur from '../assets/shelf-tube-blur.png';
import glowPhoto from '../assets/shelf-glow.jpg';       // Unsplash licence (photo-1757206022907)
import glowBlur from '../assets/shelf-glow-blur.png';
import { Play, Bulb, Plus, Jellyfin, Twitch } from './icons.jsx';
import { appLabel } from './ui.jsx';

const KNOWN = [
    {
        match: /^(npm\/)?@foxreis\/tizentube$/i, glyph: Play, scale: 1, lineKey: 'apps.tizentube',
        face: 'linear-gradient(180deg, #FF453A 0%, #D70015 100%)',
        photo: tubePhoto, blur: tubeBlur, pos: '50% 46%',
        splash: { img: youtubeLogo, width: 440, bg: '#0F0F0F' }
    },
    {
        match: /tizenglow/i, glyph: Bulb, scale: 1.08, lineKey: 'apps.tizenglow',
        face: 'linear-gradient(135deg, #FF9F0A 0%, #FF375F 50%, #BF5AF2 100%)',
        photo: glowPhoto, blur: glowBlur, pos: '50% 40%'
    },
    {
        match: /jellyfin/i, glyph: Jellyfin, scale: 1.04, lineKey: 'apps.jellyfin',
        face: 'linear-gradient(180deg, #1DB4E8 0%, #0090C8 100%)', wash: ['#00A4DC', '#AA5CC3']
    },
    {
        match: /twitch|twizen/i, glyph: Twitch, scale: 1, lineKey: 'apps.twitch',
        face: 'linear-gradient(180deg, #A06BFF 0%, #7B33F0 100%)', wash: ['#9146FF', '#5A2DB8']
    }
];

const UNKNOWN = { face: 'linear-gradient(180deg, #7C7C82 0%, #5A5A60 100%)', wash: ['#8E8E93', '#3A3A3C'] };
export const ADD_APP = { face: 'linear-gradient(180deg, #48484A 0%, #3A3A3C 100%)', glyph: Plus, scale: 0.86, wash: ['#3E7BFA', '#1B3F99'] };

// Apps offered under "Get more apps". Only apps with public source code; each line says why.
export const CURATED = [
    // Automated build of the official Jellyfin TV app (github.com/mibmo/jellyfin-tizen-npm-publish). No background service.
    { fullName: 'npm/@mibmo/jellyfin-tizen', name: '@mibmo/jellyfin-tizen', appName: 'Jellyfin' },
    // github.com/GForceWeb/smarttv-twitch-hls, based on the long-running SmartTwitchTV project.
    { fullName: 'npm/@gforceweb/smarttv-twitch-hls', name: '@gforceweb/smarttv-twitch-hls', appName: 'Twitch' }
];

function known(module) {
    const id = (module && (module.fullName || module.name)) || '';
    return KNOWN.find(k => k.match.test(id) || k.match.test((module && module.name) || ''));
}

// Everything the interface needs to draw an app.
export function appLook(module) {
    if (module === 'add') return ADD_APP;
    return known(module) || UNKNOWN;
}

export function moduleSplash(module) {
    const k = known(module);
    return k && k.splash ? k.splash : null;
}

// The coloured face of an app: tiles on Home, small icons in lists, the big icon on pages.
// w/h in px; the glyph is sized from the shorter side.
export function AppFace({ module, width, height, radius, glyph, style, className }) {
    const look = appLook(module);
    const g = Math.round((glyph || Math.min(width, height) * 0.46) * (look.scale || 1));
    const name = (module && module !== 'add' && appLabel(module)) || '?';
    const Glyph = look.glyph;
    return (
        <span aria-hidden="true" className={className} style={Object.assign({
            width: width + 'px', height: height + 'px', borderRadius: (radius == null ? 22 : radius) + 'px',
            background: look.face, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FFFFFF', flexShrink: 0
        }, style)}>
            {Glyph ? <Glyph size={g} /> : <span style={{ fontSize: Math.round(g * 1.02) + 'px', fontWeight: 600, lineHeight: 1 }}>{name.replace(/^@[^/]+\//, '').trim().charAt(0).toUpperCase()}</span>}
        </span>
    );
}

export default AppFace;
