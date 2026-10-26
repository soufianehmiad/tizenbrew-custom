import { useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import { InfoRow, SettingsPage } from '../components/ui.jsx';
import { LogoIcon } from './ModuleManager.jsx';
import { appVersion } from './Settings.jsx';

function cap(key) {
    try { return tizen.systeminfo.getCapability(key); } catch (e) { return ''; }
}

// Short status words instead of the service's full sentences.
const STATUS = {
    'service.connected': 'about.connected',
    'service.alreadyRunning': 'about.running',
    'service.started': 'about.starting'
};

export default function About() {
    const { t } = useTranslation();
    const status = useContext(GlobalStateContext).state.sharedData.state;
    // Nothing to select here; an invisible anchor keeps the remote working (Back returns).
    const { ref, focusSelf } = useFocusable({ focusKey: 'about-anchor' });
    useEffect(() => { focusSelf(); }, []);

    return (
        <SettingsPage title={t('tb.about')} icon={<LogoIcon />}>
            <div ref={ref} className="tb-about-head">
                <div className="tb-about-name">TizenBrew</div>
                <div className="tb-about-tagline">{t('tb.tagline')}</div>
            </div>
            <InfoRow label={t('tb.version')} value={appVersion()} />
            <InfoRow label={t('tb.tizenVersion')} value={cap('http://tizen.org/feature/platform.version')} />
            <InfoRow label={t('tb.tvModel')} value={cap('http://tizen.org/system/model_name')} />
            {status && <InfoRow label={t('tb.status')} value={STATUS[status] ? t(STATUS[status]) : t(status)} />}
        </SettingsPage>
    );
}
