import { useContext, useState } from 'react';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import { Events } from '../components/WebSocketClient.js';
import { useLocation } from 'preact-iso';
import { useTranslation } from 'react-i18next';
import { NavRow, ChoiceRow, RowGap, Note, SettingsPage, appLabel, isBroken, BASE } from '../components/ui.jsx';
import AppFace from '../components/ModuleIcon.jsx';
import { Gear } from '../components/icons.jsx';
import { identityLabel } from './UserAgentSettings.jsx';

export function GearIcon() {
    return (
        <span className="tb-big" style={{ width: '600px', height: '360px', background: 'linear-gradient(180deg, #98989D 0%, #6C6C70 100%)' }}>
            <Gear size={190} />
        </span>
    );
}

export function BigApp({ module }) {
    return <AppFace module={module} width={600} height={360} radius={40} glyph={170} className="tb-big" />;
}

function nameOf(modules, fullName, t) {
    if (!fullName) return t('settings.none');
    const m = (modules || []).find(x => x.fullName === fullName);
    return m ? appLabel(m) : fullName.replace(/^(npm|gh)\//, '');
}

export function appVersion() {
    try { return tizen.application.getCurrentApplication().appInfo.version; } catch (e) { return ''; }
}

export default function Settings() {
    const { state } = useContext(GlobalStateContext);
    const loc = useLocation();
    const { t } = useTranslation();
    const shared = state.sharedData;
    const modules = shared.modules || [];
    const config = shared.config || {};
    // Back from a sub-page returns to the row you opened (Settings from Home starts at the top).
    const [note, setNote] = useState(window.tbSettingsRow || 'start');
    const focusRow = (key) => { window.tbSettingsRow = key; setNote(key); };
    const first = window.tbSettingsRow || 'start';
    const service = (config.autoLaunchServiceList || [])[0];

    const notes = {
        start: t('tb.holdUp'),
        service: t('settings.serviceNote'),
        identity: t('settings.identityNote'),
        apps: t('settings.appsNote'),
        about: t('settings.aboutNote')
    };

    return (
        <SettingsPage title={t('tb.settings')} icon={<GearIcon />}>
            <NavRow label={t('settings.autolaunch')} value={shared.config ? nameOf(modules, config.autoLaunchModule, t) : ''}
                autoFocus={first === 'start'} onFocused={() => focusRow('start')} onClick={() => loc.route(BASE + '/settings/change?type=autolaunch')} />
            <NavRow label={t('settings.autolaunchService')} value={shared.config ? nameOf(modules, service, t) : ''}
                autoFocus={first === 'service'} onFocused={() => focusRow('service')} onClick={() => loc.route(BASE + '/settings/change?type=autolaunchService')} />
            <NavRow label={t('settings.useragent')} value={identityLabel(t)}
                autoFocus={first === 'identity'} onFocused={() => focusRow('identity')} onClick={() => loc.route(BASE + '/settings/change-ua')} />
            <RowGap />
            <NavRow label={t('tb.apps')} value={t('settings.installed', { count: modules.length })}
                autoFocus={first === 'apps'} onFocused={() => focusRow('apps')} onClick={() => loc.route(BASE + '/module-manager')} />
            <NavRow label={t('tb.about')} value={appVersion()}
                autoFocus={first === 'about'} onFocused={() => focusRow('about')} onClick={() => loc.route(BASE + '/about')} />
            <Note>{notes[note]}</Note>
        </SettingsPage>
    );
}

// Choose the app (or background service) that starts with TizenBrew. Selecting applies it.
function Change() {
    const loc = useLocation();
    const { state, dispatch } = useContext(GlobalStateContext);
    const { t } = useTranslation();
    const isService = loc.query.type === 'autolaunchService';
    const shared = state.sharedData;
    const config = shared.config || { autoLaunchModule: '', autoLaunchServiceList: [] };
    const modules = (shared.modules || []).filter(m => !isBroken(m) && (!isService || m.serviceFile));
    const current = isService ? ((config.autoLaunchServiceList || [])[0] || '') : (config.autoLaunchModule || '');
    const currentModule = modules.find(m => m.fullName === current);
    // Start on the current choice; if it is gone (app removed), on the first row.
    const startOn = currentModule ? current : (current && modules.length ? modules[0].fullName : '');

    function choose(fullName) {
        state.client.send({ type: Events.ModuleAction, payload: { action: loc.query.type, module: fullName } });
        dispatch({
            type: 'SET_CONFIG',
            payload: isService
                ? { ...config, autoLaunchServiceList: fullName ? [fullName] : [] }
                : { ...config, autoLaunchModule: fullName }
        });
        // Let the check mark move, then return to Settings.
        setTimeout(() => window.tbGoBack(), 300);
    }

    const mini = (m) => <AppFace module={m} width={52} height={52} radius={12} glyph={30} style={{ marginRight: '24px' }} />;
    const spacer = <span style={{ width: '52px', marginRight: '24px', flexShrink: 0 }}></span>;

    return (
        <SettingsPage title={isService ? t('settings.autolaunchService') : t('settings.autolaunch')}
            icon={currentModule ? <BigApp module={currentModule} /> : <GearIcon />}>
            {modules.map((m, idx) => (
                <ChoiceRow key={m.fullName} label={appLabel(m)} start={mini(m)} checked={m.fullName === current}
                    autoFocus={m.fullName === startOn} onClick={() => choose(m.fullName)} />
            ))}
            <ChoiceRow label={isService ? t('settings.none') : t('settings.noneHome')} start={spacer} checked={!current}
                autoFocus={startOn === ''} onClick={() => choose('')} />
            <Note>{isService ? (modules.length ? t('settings.serviceNote') : t('settings.noServices')) : t('tb.holdUp')}</Note>
        </SettingsPage>
    );
}

export {
    Change
}
