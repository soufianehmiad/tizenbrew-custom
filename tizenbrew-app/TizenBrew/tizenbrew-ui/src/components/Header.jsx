import { useEffect, useState, useContext } from 'preact/hooks';
import { GlobalStateContext } from './ClientContext.jsx';
import { useLocation } from 'preact-iso';
import { cx, useTvFocus, BASE } from './ui.jsx';
import { useTranslation } from 'react-i18next';

function clockText() {
    const now = new Date();
    const pad = (n) => (n < 10 ? '0' : '') + n;
    return pad(now.getHours()) + ':' + pad(now.getMinutes());
}

function SettingsButton({ takeFocus }) {
    const loc = useLocation();
    const { t } = useTranslation();
    const { ref, focused, focusSelf, focusKey } = useTvFocus(false);
    useEffect(() => {
        if (takeFocus) focusSelf();
    }, [takeFocus]);
    return (
        <div ref={ref} data-fk={focusKey} onClick={() => loc.route(BASE + '/settings')} className={cx('tb-pill', focused && 'focus')}>
            <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>{t('tb.settings')}</span>
        </div>
    );
}

// Top bar: "TizenBrew" title, clock, and (on the home screen) a Settings button.
export default function Header() {
    const loc = useLocation();
    // If start-up fails there are no app tiles: focus Settings so the remote isn't stuck.
    const context = useContext(GlobalStateContext);
    const shared = context.state.sharedData;
    const [clock, setClock] = useState(clockText());
    useEffect(() => {
        const timer = setInterval(() => setClock(clockText()), 15000);
        return () => clearInterval(timer);
    }, []);
    const onHome = loc.path === BASE || loc.path === BASE + '/';

    return (
        <header className="tb-top">
            <h1 className="tb-title">TizenBrew</h1>
            <div className="tb-top-right">
                <span className="tb-clock">{clock}</span>
                {onHome && <SettingsButton takeFocus={!shared.modules && !!shared.error.message} />}
            </div>
        </header>
    );
}
