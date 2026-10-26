// Home: the selected app's photo and name on top, "Your apps" and "Get more apps" below.
import { useEffect, useContext, useState, useRef } from 'react';
import { useLocation } from 'preact-iso';
import { setFocus, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation';
import { GlobalStateContext } from './ClientContext.jsx';
import { Events } from './WebSocketClient.js';
import AppFace, { appLook, CURATED } from './ModuleIcon.jsx';
import { cx, useTvFocus, appLabel, isBroken, BASE, Spinner } from './ui.jsx';
import { Plus, Offline } from './icons.jsx';
import ErrorBanner from './ErrorBanner.jsx';
import { openModule } from './launch.js';
import { useTranslation } from 'react-i18next';

const BIG = { w: 336, h: 202, gap: 56, radius: 22, glyph: 94 };
const SMALL = { w: 280, h: 168, gap: 44, radius: 20, glyph: 78 };
const ROW_WIDTH = 1728; // 1920 minus the 96px margins

// ---------- Backdrop: photo of the selected app, cross-faded ----------
function scene(look) {
    if (look.photo) return { key: look.photo, photo: look.photo, blur: look.blur, pos: look.pos };
    const [c1, c2] = look.wash;
    return { key: c1 + c2, wash: `radial-gradient(1300px 820px at 72% 18%, ${c1} 0%, rgba(0,0,0,0) 70%), radial-gradient(1100px 760px at 18% 92%, ${c2} 0%, rgba(0,0,0,0) 70%)` };
}

function Backdrop({ look }) {
    const next = scene(look);
    const [layers, setLayers] = useState([next]);
    useEffect(() => {
        setLayers(ls => ls[ls.length - 1].key === next.key ? ls : ls.slice(-1).concat(next));
        const t = setTimeout(() => setLayers(ls => ls.slice(-1)), 450);
        return () => clearTimeout(t);
    }, [next.key]);
    return (
        <div className="tb-home-bg" aria-hidden="true">
            {layers.map((s, i) => (
                <div key={s.key} className={cx('tb-scene', i > 0 && 'tb-fade-in')}>
                    {s.photo ? (<>
                        <div className="tb-scene-blur" style={{ backgroundImage: `url(${s.blur})` }}></div>
                        <div className="tb-scene-photo" style={{ backgroundImage: `url(${s.photo})`, backgroundPosition: s.pos }}></div>
                    </>) : (
                        <div className="tb-scene-wash" style={{ background: s.wash + ', #141416' }}></div>
                    )}
                </div>
            ))}
            <div className="tb-scrim"></div>
        </div>
    );
}

// ---------- Rows ----------
// Scrolls sideways so the selected tile stays fully on screen (second slot once the row has moved).
function TileRow({ label, size, items, render, extra }) {
    const [index, setIndex] = useState(0);
    const step = size.w + size.gap;
    const total = items.length * step - size.gap + (extra ? extra.width + size.gap : 0);
    const offset = Math.max(0, Math.min(Math.max(0, index - 1) * step, total - ROW_WIDTH));
    return (
        <section className="tb-row-block" aria-label={label}>
            <h2 className="tb-row-title">{label}</h2>
            <div className="tb-tiles-clip">
                <div className="tb-tiles" role="list" style={{ transform: `translateX(-${offset}px)` }}>
                    {items.map((item, i) => render(item, i, () => setIndex(i)))}
                    {extra && extra.node}
                </div>
            </div>
        </section>
    );
}

function Tile({ module, size, focusKey, autoFocus, onSelect, onFocused, label }) {
    const { ref, focused, focusKey: fk } = useTvFocus(autoFocus, true, { focusKey, onFocus: onFocused });
    return (
        <div ref={ref} data-fk={fk} role="listitem" aria-label={label} onClick={onSelect}
            className={cx('tb-tile', focused && 'focus')}
            style={{ width: size.w + 'px', height: size.h + 'px', marginRight: size.gap + 'px', borderRadius: size.radius + 'px' }}>
            <AppFace module={module} width={size.w} height={size.h} radius={size.radius} glyph={size.glyph} />
        </div>
    );
}

function OfflinePanel() {
    const { t } = useTranslation();
    return (
        <div className="tb-offline" role="status">
            <Offline size={56} />
            <span>
                <span className="tb-offline-title">{t('home.offlineTitle')}</span>
                <span className="tb-offline-text">{t('home.offlineText')}</span>
            </span>
        </div>
    );
}

// ---------- Caption ----------
function Caption({ title, line, pill }) {
    return (
        <section className={cx('tb-caption', pill && 'with-pill')}>
            <h1 className="tb-caption-title">{title}</h1>
            {line && <p className="tb-caption-line">{line}</p>}
            {pill}
        </section>
    );
}

function appLine(module, t) {
    const look = appLook(module);
    if (isBroken(module)) return t('home.broken');
    if (look.lineKey) return t(look.lineKey);
    return module.description || '';
}

// ---------- Home ----------
export default function Modules() {
    const { state, dispatch } = useContext(GlobalStateContext);
    const { t } = useTranslation();
    const loc = useLocation();
    const shared = state.sharedData;
    const modules = shared.modules;
    const [selected, setSelected] = useState(null); // { kind: 'app' | 'more' | 'add', module }
    const [adding, setAdding] = useState(null);     // fullName being added from "Get more apps"
    const [online, setOnline] = useState(navigator.onLine !== false);
    const addTimer = useRef(null);

    useEffect(() => {
        const on = () => setOnline(true), off = () => setOnline(false);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, []);

    // An app added from "Get more apps" arrived: select it, or explain why it didn't.
    useEffect(() => {
        if (!adding || !modules) return;
        const mdl = modules.find(m => m.fullName === adding);
        if (!mdl) return;
        clearTimeout(addTimer.current);
        setAdding(null);
        if (isBroken(mdl)) {
            state.client.send({ type: Events.ModuleAction, payload: { action: 'remove', module: mdl.fullName } });
            state.client.send({ type: Events.GetModules, payload: false });
            dispatch({ type: 'SET_ERROR', payload: { message: 'home.addFailed', args: { name: appLabel(CURATED.find(c => c.fullName === adding) || mdl) }, disappear: true } });
        } else {
            setTimeout(() => { const k = 'app:' + mdl.fullName; if (doesFocusableExist(k)) setFocus(k); }, 50);
        }
    }, [modules, adding]);

    if (!modules) {
        // Start-up failed before the app list arrived: only the problem and the Settings button.
        return shared.error.message ? (<>
            <Backdrop look={appLook('add')} />
            <ErrorBanner error={shared.error} />
        </>) : null;
    }

    const installed = new Set(modules.map(m => m.fullName));
    const more = CURATED.filter(c => !installed.has(c.fullName));
    const justAdded = window.tbFocusApp;
    const firstKey = justAdded && installed.has(justAdded) ? 'app:' + justAdded : null;

    // Opens it, restarting into debug mode first if needed (launch.js).
    const open = openModule;

    function add(item) {
        if (adding) return;
        setAdding(item.fullName);
        state.client.send({ type: Events.ModuleAction, payload: { action: 'add', module: item.fullName } });
        state.client.send({ type: Events.GetModules, payload: true });
        // No answer at all (service busy): stop showing "Adding" after a while.
        addTimer.current = setTimeout(() => setAdding(null), 30000);
    }

    // What the top half shows.
    const sel = selected || (modules.length ? { kind: 'app', module: modules[0] } : { kind: 'add' });
    let look, caption;
    if (sel.kind === 'add') {
        look = appLook('add');
        caption = modules.length
            ? <Caption title={t('tb.addApp')} line={t('home.addLine')} />
            : <Caption title={t('home.welcome')} line={t('home.welcomeLine')} />;
    } else if (sel.kind === 'more') {
        look = appLook(sel.module);
        const busy = adding === sel.module.fullName;
        caption = <Caption title={sel.module.appName} line={t(appLook(sel.module).lineKey)}
            pill={<span className="tb-pill">{busy ? <Spinner size={26} /> : <Plus size={22} />}<span>{busy ? t('home.adding') : t('home.pressToAdd')}</span></span>} />;
    } else {
        look = appLook(sel.module);
        caption = <Caption title={appLabel(sel.module)} line={appLine(sel.module, t)} />;
    }
    if (shared.error.message) caption = <ErrorBanner error={shared.error} />;

    const moreRow = (
        <TileRow label={t('home.getMore')} size={SMALL}
            items={online ? ['add'].concat(more) : ['add']}
            extra={online ? null : { width: 1012, node: <OfflinePanel key="offline" /> }}
            render={(item, i, onIdx) => item === 'add'
                ? <Tile key="add" module="add" size={SMALL} focusKey="add" label={t('tb.addApp')} autoFocus={!modules.length}
                    onFocused={() => { onIdx(); setSelected({ kind: 'add' }); }}
                    onSelect={() => loc.route(BASE + '/module-manager/add?type=npm')} />
                : <Tile key={item.fullName} module={item} size={SMALL} focusKey={'more:' + item.fullName} label={item.appName}
                    onFocused={() => { onIdx(); setSelected({ kind: 'more', module: item }); }}
                    onSelect={() => add(item)} />} />
    );

    return (<>
        <Backdrop look={look} />
        {caption}
        <div className={cx('tb-rows', !modules.length && 'tb-rows-empty')}>
            {modules.length > 0 && (
                <TileRow label={t('home.yourApps')} size={BIG} items={modules}
                    render={(m, i, onIdx) => (
                        <Tile key={m.fullName} module={m} size={BIG} focusKey={'app:' + m.fullName} label={appLabel(m)}
                            autoFocus={firstKey ? firstKey === 'app:' + m.fullName : i === 0}
                            onFocused={() => { onIdx(); window.tbFocusApp = null; setSelected({ kind: 'app', module: m }); }}
                            onSelect={() => open(m)} />
                    )} />
            )}
            {moreRow}
        </div>
    </>);
}
