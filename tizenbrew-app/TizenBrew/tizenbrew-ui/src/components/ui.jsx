// Shared building blocks for the TV interface. Every focusable element gets the "focus"
// class when selected: main.jsx clicks document.querySelector('.focus') on the OK key.
import { useFocusable, FocusContext, setFocus, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { useEffect, useRef } from 'react';
import { Check } from './icons.jsx';
import tubeBlur from '../assets/shelf-tube-blur.png';

export const BASE = '/tizenbrew-ui/dist/index.html';

// Display name for an app. Modules that failed to load all come back as "Unknown Module",
// so show their package name instead to tell them apart.
export function appLabel(module) {
    if (!module) return '';
    if (module.appName === 'Unknown Module') return module.name || module.fullName;
    return module.appName || module.name;
}

// A module that can't be opened: its download failed or it isn't a TizenBrew module.
export function isBroken(module) {
    return !module || module.failed || module.appName === 'Unknown Module' || (!module.appPath && !module.evaluateScriptOnDocumentStart);
}

export function cx(...classes) {
    return classes.filter(Boolean).join(' ');
}

// useFocusable plus optional first focus and keeping the item on screen
// (noScroll: the caller scrolls itself, like the Home rows).
export function useTvFocus(autoFocus, noScroll, config) {
    const f = useFocusable(config || {});
    useEffect(() => {
        if (autoFocus) f.focusSelf();
    }, []);
    useEffect(() => {
        if (!noScroll && f.focused && f.ref.current && f.ref.current.scrollIntoView) {
            f.ref.current.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }, [f.focused]);
    return f;
}

// Back key: a dialog (or anything else) can take over Back while it is open.
const backHandlers = [];
export function handleBackOverride() {
    if (!backHandlers.length) return false;
    backHandlers[backHandlers.length - 1]();
    return true;
}
function useBackOverride(fn) {
    const ref = useRef(fn);
    ref.current = fn;
    useEffect(() => {
        const h = () => ref.current();
        backHandlers.push(h);
        return () => { const i = backHandlers.indexOf(h); if (i >= 0) backHandlers.splice(i, 1); };
    }, []);
}

export function Chevron() {
    return (
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" className="tb-chevron">
            <path d="M9 5l7 7-7 7"></path>
        </svg>
    );
}

export function Spinner({ size = 56 }) {
    return (
        <svg className="tb-spinner" aria-hidden="true" width={size} height={size} viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="21" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="4"></circle>
            <path d="M25 4 a21 21 0 0 1 21 21" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"></path>
        </svg>
    );
}

// Settings rows. The selected row turns white and lifts slightly.
function useRow(autoFocus, onFocused) {
    return useTvFocus(autoFocus, false, { onFocus: () => onFocused && onFocused() });
}

export function NavRow({ label, value, start, onClick, autoFocus, onFocused, danger }) {
    const { ref, focused, focusKey } = useRow(autoFocus, onFocused);
    return (
        <div ref={ref} data-fk={focusKey} onClick={onClick} role="button" className={cx('tb-row', focused && 'focus')}>
            <span className="tb-row-start">{start}<span className="tb-row-label" style={danger ? { color: focused ? '#D70015' : '#FF6961' } : null}>{label}</span></span>
            <span className="tb-row-end">{value != null && value !== '' && <span className="tb-row-value">{value}</span>}<Chevron /></span>
        </div>
    );
}

export function ChoiceRow({ label, checked, start, value, onClick, autoFocus, onFocused }) {
    const { ref, focused, focusKey } = useRow(autoFocus, onFocused);
    return (
        <div ref={ref} data-fk={focusKey} onClick={onClick} role="radio" aria-checked={checked ? 'true' : 'false'}
            className={cx('tb-row', focused && 'focus')}>
            <span className="tb-row-start">{start}<span className="tb-row-label">{label}</span></span>
            <span className="tb-row-end">
                {value && <span className="tb-row-value">{value}</span>}
                <span className={cx('tb-check', checked && 'on')}><Check size={30} /></span>
            </span>
        </div>
    );
}

export function InfoRow({ label, value }) {
    return (
        <div className="tb-row tb-row-info">
            <span className="tb-row-label">{label}</span>
            <span className="tb-row-value">{value}</span>
        </div>
    );
}

export function RowGap() {
    return <div className="tb-row-gap" aria-hidden="true"></div>;
}

export function Note({ children, role }) {
    return <p className="tb-note" role={role}>{children}</p>;
}

// Settings-style page: centred title, the page's big icon on the left, rows on the right.
// The backdrop is the dimmed, blurred photo from Home so it reads as the same place.
// overlay: a dialog, drawn over the whole page (the rows column clips its content).
export function SettingsPage({ title, icon, children, overlay }) {
    return (
        <div className="tb-page">
            <div className="tb-page-bg" aria-hidden="true" style={{ backgroundImage: `url(${tubeBlur})` }}></div>
            <h1 className="tb-page-title">{title}</h1>
            <div className="tb-page-icon" aria-hidden="true">{icon}</div>
            <div className="tb-page-rows">{children}</div>
            {overlay}
        </div>
    );
}

// A question with buttons. Keeps the remote inside it and closes on Back; focus returns to
// whatever was selected before it opened.
function DialogButton({ label, danger, onClick, autoFocus }) {
    const { ref, focused, focusKey } = useTvFocus(autoFocus, true);
    return (
        <div ref={ref} data-fk={focusKey} onClick={onClick} role="button"
            className={cx('tb-dialog-btn', danger && 'danger', focused && 'focus')}>{label}</div>
    );
}

export function Dialog({ title, body, icon, actions, onClose }) {
    const before = useRef(getCurrentFocusKey());
    const { ref, focusKey } = useFocusable({ isFocusBoundary: true, trackChildren: true, focusable: true });
    useBackOverride(close);
    function close() {
        onClose();
        const key = before.current;
        setTimeout(() => { try { if (key) setFocus(key); } catch (e) { } }, 0);
    }
    return (
        <FocusContext.Provider value={focusKey}>
            <div className="tb-dim" aria-hidden="true"></div>
            <div ref={ref} className="tb-dialog" role="alertdialog" aria-label={title}>
                {icon && <div className="tb-dialog-icon">{icon}</div>}
                <h2 className="tb-dialog-title">{title}</h2>
                {body && <p className="tb-dialog-body">{body}</p>}
                <div className="tb-dialog-actions">
                    {actions.map((a, i) => (
                        <DialogButton key={a.label} label={a.label} danger={a.danger} autoFocus={i === 0}
                            onClick={() => { if (a.keepOpen) a.onClick(); else { close(); a.onClick && a.onClick(); } }} />
                    ))}
                </div>
            </div>
        </FocusContext.Provider>
    );
}
