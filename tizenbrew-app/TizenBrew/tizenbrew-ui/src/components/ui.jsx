// Shared building blocks for the TV interface. Every focusable element gets the "focus"
// class when selected: main.jsx clicks document.querySelector('.focus') on the OK key.
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useEffect } from 'react';
import { useLocation } from 'preact-iso';
import { useTranslation } from 'react-i18next';

export const BASE = '/tizenbrew-ui/dist/index.html';

// Display name for an app. Modules that failed to load all come back as "Unknown Module",
// so show their package name instead to tell them apart.
export function appLabel(module) {
    if (!module) return '';
    if (module.appName === 'Unknown Module') return module.fullName || module.name;
    return module.appName || module.name;
}

export function cx(...classes) {
    return classes.filter(Boolean).join(' ');
}

// useFocusable plus optional first focus and keeping the item on screen
// (noScroll: the caller scrolls itself, like the home row).
export function useTvFocus(autoFocus, noScroll) {
    const f = useFocusable();
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

// Background light tinted by the selected app ("r,g,b").
export function setBackdropTint(rgb) {
    const el = document.getElementById('tb-backdrop');
    if (!el) return;
    el.style.background =
        `radial-gradient(45% 55% at 20% 70%, rgba(${rgb},0.28), rgba(${rgb},0) 70%),` +
        `radial-gradient(40% 50% at 75% 85%, rgba(${rgb},0.16), rgba(${rgb},0) 70%)`;
}
export const NEUTRAL_TINT = '110,130,175';

export function Chevron({ back }) {
    return (
        <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d={back ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}></path>
        </svg>
    );
}

export function Spinner() {
    return (
        <svg className="tb-spinner" aria-hidden="true" width="120" height="120" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2.5"></circle>
            <path d="M25 5 A20 20 0 0 1 45 25" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round"></path>
        </svg>
    );
}

// A settings-style row: label on the left, optional icon/value and a chevron on the right.
// action: a word shown instead of the chevron when selecting the row does something right away (e.g. Remove).
export function Row({ label, start, value, icon, action, onClick, autoFocus, noChevron }) {
    const { ref, focused, focusKey } = useTvFocus(autoFocus);
    return (
        <div ref={ref} data-fk={focusKey} onClick={onClick} className={cx('tb-row', focused && 'focus')}>
            <span className="tb-row-start">{start}<span className="tb-row-label">{label}</span></span>
            <span className="tb-row-end">
                {icon && <img src={icon} className="tb-row-icon" alt="" />}
                {value && <span>{value}</span>}
                {action ? <span className="tb-row-action">{action}</span> : !noChevron && <Chevron />}
            </span>
        </div>
    );
}

const NAV_ICONS = {
    settings: (
        <svg aria-hidden="true" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
    ),
    apps: (
        <svg aria-hidden="true" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3.5" y="3.5" width="7" height="7" rx="2"></rect><rect x="13.5" y="3.5" width="7" height="7" rx="2"></rect>
            <rect x="3.5" y="13.5" width="7" height="7" rx="2"></rect><path d="M17 14v6M14 17h6"></path>
        </svg>
    ),
    about: (
        <svg aria-hidden="true" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4M12 8h.01"></path>
        </svg>
    )
};

function NavItem({ id, label, active, autoFocus }) {
    const loc = useLocation();
    const { ref, focused, focusKey } = useTvFocus(autoFocus);
    const routes = { settings: '/settings', apps: '/module-manager', about: '/about' };
    // Side-menu hops replace the history entry, so Back always returns to Home in one press.
    const go = () => { if (!active) loc.route(BASE + routes[id], true); };
    return (
        <div ref={ref} data-fk={focusKey} onClick={go}
            className={cx('tb-nav', active && 'active', focused && 'focus')}>
            {NAV_ICONS[id]}<span>{label}</span>
        </div>
    );
}

// Side menu + content column, used by Settings, Apps (remove/add) and About.
export function SettingsLayout({ active, title, children, focusNav }) {
    const { t } = useTranslation();
    useEffect(() => { setBackdropTint(NEUTRAL_TINT); }, []);
    return (
        <div>
            <nav className="tb-side" aria-label="Settings sections">
                <NavItem id="settings" label={t('tb.settings')} active={active === 'settings'} autoFocus={focusNav && active === 'settings'} />
                <NavItem id="apps" label={t('tb.apps')} active={active === 'apps'} autoFocus={focusNav && active === 'apps'} />
                <NavItem id="about" label={t('tb.about')} active={active === 'about'} autoFocus={focusNav && active === 'about'} />
            </nav>
            <div className="tb-divider" aria-hidden="true"></div>
            <main className="tb-main">
                {title && <h2 className="tb-heading">{title}</h2>}
                {children}
            </main>
        </div>
    );
}
