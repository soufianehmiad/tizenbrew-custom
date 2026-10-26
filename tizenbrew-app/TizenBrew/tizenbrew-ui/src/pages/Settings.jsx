import { useContext } from 'react';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import { Events } from '../components/WebSocketClient.js';
import { useLocation } from 'preact-iso';
import { useTranslation } from 'react-i18next';
import { Row, SettingsLayout, appLabel, BASE } from '../components/ui.jsx';
import ModuleIcon from '../components/ModuleIcon.jsx';

export default function Settings() {
    const { state } = useContext(GlobalStateContext);
    const loc = useLocation();
    const { t } = useTranslation();
    const noModules = () => state.sharedData.modules?.length === 0;

    return (
        <SettingsLayout active="settings">
            <Row label={t('settings.autolaunch')} autoFocus onClick={() => {
                if (noModules()) return alert(t('settings.noModules'));
                loc.route(BASE + '/settings/change?type=autolaunch');
            }} />
            <Row label={t('settings.autolaunchService')} onClick={() => {
                if (noModules()) return alert(t('settings.noModules'));
                loc.route(BASE + '/settings/change?type=autolaunchService');
            }} />
            <Row label={t('settings.useragent')} onClick={() => loc.route(BASE + '/settings/change-ua')} />
        </SettingsLayout>
    )
}

// Choose the app (or background service) that starts with TizenBrew.
function Change() {
    const loc = useLocation();
    const { state } = useContext(GlobalStateContext);
    const { t } = useTranslation();
    const isService = loc.query.type === 'autolaunchService';
    const modules = (state?.sharedData?.modules || []).filter(m => !isService || m.serviceFile);

    function choose(module) {
        state.client.send({
            type: Events.ModuleAction,
            payload: { action: loc.query.type, module: module ? module.fullName : '' }
        });
        // This page is always opened from Settings: go back to it rather than adding a history entry.
        history.back();
    }

    return (
        <SettingsLayout active="settings" title={isService ? t('settings.autolaunchService') : t('settings.autolaunch')}>
            {modules.map((module, idx) => (
                <Row key={module.fullName} autoFocus={idx === 0}
                    start={<span style={{ marginRight: '26px', display: 'flex' }}><ModuleIcon module={module} size={64} /></span>}
                    label={appLabel(module)}
                    value={module.version}
                    onClick={() => {
                        if (confirm(t('settings.enableAutolaunchPrompt', { packageName: appLabel(module) }))) choose(module);
                    }} />
            ))}
            <Row label={t('settings.disableAutolaunch')} autoFocus={modules.length === 0} noChevron onClick={() => {
                if (confirm(t('settings.disableAutolaunchPrompt'))) choose(null);
            }} />
        </SettingsLayout>
    )
}

export {
    Change
}
