import { useEffect, useState, useContext } from 'preact/hooks';
import { GlobalStateContext } from './ClientContext.jsx';
import { useLocation } from 'preact-iso';
import { cx, useTvFocus, BASE } from './ui.jsx';
import { Gear } from './icons.jsx';
import { useTranslation } from 'react-i18next';

function clockText() {
    const now = new Date();
    const pad = (n) => (n < 10 ? '0' : '') + n;
    return pad(now.getHours()) + ':' + pad(now.getMinutes());
}

// Round Settings button by the clock (Home only). Its name shows under it when selected.
function SettingsButton({ takeFocus }) {
    const loc = useLocation();
    const { t } = useTranslation();
    const { ref, focused, focusSelf, focusKey } = useTvFocus(false, true, { focusKey: 'gear' });
    useEffect(() => {
        if (takeFocus) focusSelf();
    }, [takeFocus]);
    return (
        <div className="tb-gear-wrap">
            <div ref={ref} data-fk={focusKey} role="button" aria-label={t('tb.settings')}
                onClick={() => { window.tbSettingsRow = 'start'; loc.route(BASE + '/settings'); }} className={cx('tb-gear', focused && 'focus')}>
                <Gear size={34} />
            </div>
            {focused && <span className="tb-gear-label">{t('tb.settings')}</span>}
        </div>
    );
}

// Top right: Settings (on Home) and the clock.
export default function Header() {
    const loc = useLocation();
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
            {/* If start-up fails there are no app tiles: focus Settings so the remote isn't stuck. */}
            {onHome && <SettingsButton takeFocus={!shared.modules && !!shared.error.message} />}
            <span className="tb-clock">{clock}</span>
        </header>
    );
}
