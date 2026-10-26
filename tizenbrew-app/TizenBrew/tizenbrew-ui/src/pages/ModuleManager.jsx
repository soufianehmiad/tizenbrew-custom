import { useEffect, useContext, useState, useRef } from 'react';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import { Events } from '../components/WebSocketClient.js';
import { useLocation } from 'preact-iso';
import { useTranslation } from 'react-i18next';
import { Row, SettingsLayout, setBackdropTint, appLabel, NEUTRAL_TINT, BASE } from '../components/ui.jsx';
import ModuleIcon from '../components/ModuleIcon.jsx';

// Apps: every installed app (select one to remove it), plus ways to add more.
export default function ModuleManager() {
    const { state } = useContext(GlobalStateContext);
    const loc = useLocation();
    const { t } = useTranslation();
    const modules = state?.sharedData?.modules || [];

    function remove(module) {
        if (!confirm(t('moduleManager.confirmDelete', { packageName: appLabel(module) }))) return;
        state.client.send({ type: Events.ModuleAction, payload: { action: 'remove', module: module.fullName } });
        state.client.send({ type: Events.GetModules, payload: true });
    }

    return (
        <SettingsLayout active="apps">
            {/* keyed on the count: after a removal the rows remount and the first one takes focus */}
            <div key={modules.length}>
                {modules.map((module, idx) => (
                    <Row key={module.fullName} autoFocus={idx === 0}
                        start={<span style={{ marginRight: '26px', display: 'flex' }}><ModuleIcon module={module} size={64} /></span>}
                        label={appLabel(module)}
                        value={module.appName === 'Unknown Module' ? t('tb.notLoaded') : module.version}
                        action={t('tb.remove')}
                        onClick={() => remove(module)} />
                ))}
                <Row label={t('moduleManager.addNPM')} autoFocus={modules.length === 0} onClick={() => loc.route(BASE + '/module-manager/add?type=npm&from=apps')} />
                <Row label={t('moduleManager.addGH')} value={t('moduleManager.addGHDesc')} onClick={() => loc.route(BASE + '/module-manager/add?type=gh&from=apps')} />
            </div>
        </SettingsLayout>
    )
}

// Add app: the TV keyboard opens on the text field; closing it adds the app (same as upstream).
function AddModule() {
    const [name, setName] = useState('');
    const loc = useLocation();
    const { state } = useContext(GlobalStateContext);
    const { t } = useTranslation();
    const ref = useRef(null);
    const done = useRef(false);
    const isGitHub = loc.query.type === 'gh';

    useEffect(() => {
        setBackdropTint(NEUTRAL_TINT);
        ref.current.focus();
    }, [ref]);

    function submit() {
        if (done.current) return;
        done.current = true;
        if (name) {
            state.client.send({
                type: Events.ModuleAction,
                payload: { action: 'add', module: `${loc.query.type}/${name}` }
            });
        }
        state.client.send({ type: Events.GetModules, payload: true });
        // Show the Apps list. If we came from it, step back instead of stacking a second copy.
        if (loc.query.from === 'apps') history.back();
        else loc.route(BASE + '/module-manager', true);
    }

    return (
        <div>
            <h2 style={{ position: 'absolute', left: '485px', top: '330px', margin: 0, fontSize: '70px', fontWeight: 400 }}>{t('tb.addApp')}</h2>
            <div style={{ position: 'absolute', left: '485px', top: '460px' }}>
                <label htmlFor="pkg" style={{ position: 'absolute', left: '-9999px' }}>{t('tb.addApp')}</label>
                <input
                    id="pkg"
                    type="text"
                    ref={ref}
                    value={name}
                    className="tb-field"
                    onChange={(e) => setName(e.target.value)}
                    onBlur={submit}
                    placeholder={isGitHub ? t('tb.ghPlaceholder') : t('tb.npmPlaceholder')}
                />
            </div>
            <p className="tb-muted" style={{ position: 'absolute', left: '485px', top: '610px', margin: 0, fontSize: '30px' }}>
                {isGitHub ? t('tb.ghHint') : t('tb.npmHint')}
            </p>
        </div>
    )
}

export {
    AddModule
}
