import { useEffect, useContext, useState, useRef } from 'react';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import { Events } from '../components/WebSocketClient.js';
import { useLocation } from 'preact-iso';
import { useTranslation } from 'react-i18next';
import { NavRow, ChoiceRow, RowGap, Note, SettingsPage, Dialog, Spinner, useTvFocus, cx, appLabel, isBroken, BASE } from '../components/ui.jsx';
import AppFace from '../components/ModuleIcon.jsx';
import { Warning } from '../components/icons.jsx';
import TBLogo from '../assets/tizenbrew-app-icon.svg';

export function LogoIcon() {
    return <img src={TBLogo} alt="" className="tb-big" style={{ width: '360px', height: '360px' }} />;
}

const mini = (m) => <AppFace module={m} width={52} height={52} radius={12} glyph={30} style={{ marginRight: '24px' }} />;

// Apps: every installed app (select one to remove it), and Add app.
export default function ModuleManager() {
    const { state } = useContext(GlobalStateContext);
    const loc = useLocation();
    const { t } = useTranslation();
    const modules = state?.sharedData?.modules || [];
    const config = state?.sharedData?.config;
    const [removing, setRemoving] = useState(null);

    function remove(module) {
        state.client.send({ type: Events.ModuleAction, payload: { action: 'remove', module: module.fullName } });
        // Don't leave a removed app set to open at start.
        if (config && config.autoLaunchModule === module.fullName) {
            state.client.send({ type: Events.ModuleAction, payload: { action: 'autolaunch', module: '' } });
            window.dispatch({ type: 'SET_CONFIG', payload: { ...config, autoLaunchModule: '' } });
        }
        state.client.send({ type: Events.GetModules, payload: true });
    }

    return (
        <SettingsPage title={t('tb.apps')} icon={<LogoIcon />} overlay={removing && (
            <Dialog title={t('apps.removeTitle', { name: appLabel(removing) })} body={t('apps.removeBody')}
                icon={<AppFace module={removing} width={96} height={96} radius={22} glyph={56} />}
                onClose={() => setRemoving(null)}
                actions={[
                    { label: t('tb.remove'), danger: true, onClick: () => remove(removing) },
                    { label: t('apps.cancel') }
                ]} />
        )}>
            {/* keyed on the count: after a removal the rows remount and the first one takes focus */}
            <div key={modules.length}>
                {modules.map((m, idx) => (
                    <NavRow key={m.fullName} autoFocus={idx === 0} start={mini(m)} label={appLabel(m)}
                        value={isBroken(m) ? t('tb.notLoaded') : m.version} onClick={() => setRemoving(m)} />
                ))}
                {modules.length > 0 && <RowGap />}
                <NavRow start={mini('add')} label={t('tb.addApp')} autoFocus={modules.length === 0}
                    onClick={() => loc.route(BASE + '/module-manager/add?type=npm&from=apps')} />
                <Note>{modules.length ? t('settings.appsNote') : t('apps.none')}</Note>
            </div>
        </SettingsPage>
    );
}

// The text field as a row: OK opens the TV keyboard; closing the keyboard adds the app.
function NameField({ value, onChange, onDone, placeholder, inputRef }) {
    // Moving the selection off the field closes the keyboard without adding anything.
    const { ref, focused, focusKey } = useTvFocus(true, false, {
        focusKey: 'name-field',
        onBlur: () => {
            if (inputRef.current && document.activeElement === inputRef.current) {
                window.tbInputBack = Date.now();
                inputRef.current.blur();
            }
        }
    });
    return (
        <div ref={ref} data-fk={focusKey} role="textbox" aria-label={placeholder}
            className={cx('tb-field', focused && 'focus')} onClick={() => inputRef.current && inputRef.current.focus()}>
            <input ref={inputRef} type="text" value={value} placeholder={placeholder} tabIndex={-1}
                onInput={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.keyCode === 13 || e.keyCode === 65376) {
                        // Done on the keyboard: this key must not also "press" the field again (main.jsx).
                        e.preventDefault();
                        e.stopPropagation();
                        window.tbInputDone = Date.now();
                        e.target.blur();
                    }
                }}
                onBlur={onDone} />
        </div>
    );
}

function AddModule() {
    const loc = useLocation();
    const { state } = useContext(GlobalStateContext);
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [status, setStatus] = useState(null); // null | 'adding' | { error }
    const pending = useRef(null);
    const timer = useRef(null);
    const inputRef = useRef(null);
    const isGitHub = loc.query.type === 'gh';
    const modules = state?.sharedData?.modules || [];

    // Open the keyboard right away, as before.
    useEffect(() => {
        const id = setTimeout(() => inputRef.current && inputRef.current.focus(), 150);
        return () => { clearTimeout(id); clearTimeout(timer.current); };
    }, []);

    // The new app arrived: go back (Home selects it), or explain and remove the broken entry.
    useEffect(() => {
        if (!pending.current) return;
        const mdl = modules.find(m => m.fullName === pending.current);
        if (!mdl) return;
        clearTimeout(timer.current);
        const id = pending.current;
        pending.current = null;
        if (isBroken(mdl)) {
            state.client.send({ type: Events.ModuleAction, payload: { action: 'remove', module: id } });
            state.client.send({ type: Events.GetModules, payload: false });
            setStatus({ error: t('add.notFound', { name: id.replace(/^(npm|gh)\//, ''), source: isGitHub ? 'GitHub' : 'NPM' }) });
        } else {
            window.tbFocusApp = id;
            window.tbGoBack();
        }
    }, [modules]);

    function submit() {
        // Keyboard closed with Back, or nothing typed: just stay.
        if (Date.now() - (window.tbInputBack || 0) < 600) return;
        const clean = name.trim().replace(/^https?:\/\/(www\.)?(github\.com|npmjs\.com\/package)\//i, '');
        if (!clean || status === 'adding') return;
        const id = (isGitHub ? 'gh/' : 'npm/') + clean;
        if (modules.some(m => m.fullName === id)) {
            setStatus({ error: t('add.already', { name: clean }) });
            return;
        }
        setStatus('adding');
        pending.current = id;
        state.client.send({ type: Events.ModuleAction, payload: { action: 'add', module: id } });
        state.client.send({ type: Events.GetModules, payload: true });
        timer.current = setTimeout(() => {
            pending.current = null;
            setStatus({ error: t('add.noAnswer') });
        }, 30000);
    }

    function setType(type) {
        if ((type === 'gh') === isGitHub) return;
        setStatus(null);
        loc.route(BASE + '/module-manager/add?type=' + type + (loc.query.from ? '&from=' + loc.query.from : ''), true);
    }

    return (
        <SettingsPage title={t('tb.addApp')} icon={<AppFace module="add" width={600} height={360} radius={40} glyph={160} className="tb-big" />}>
            <ChoiceRow label={t('add.fromNpm')} value={t('add.mostApps')} checked={!isGitHub} onClick={() => setType('npm')} />
            <ChoiceRow label={t('add.fromGithub')} value={t('moduleManager.addGHDesc')} checked={isGitHub} onClick={() => setType('gh')} />
            <RowGap />
            <NameField value={name} onChange={(v) => { setName(v); if (status && status.error) setStatus(null); }} onDone={submit}
                inputRef={inputRef} placeholder={isGitHub ? t('tb.ghPlaceholder') : t('tb.npmPlaceholder')} />
            {status === 'adding' && <p className="tb-note tb-note-busy" role="status"><Spinner size={30} /><span>{t('add.adding')}</span></p>}
            {status && status.error && <p className="tb-note tb-note-error" role="alert"><Warning size={30} /><span>{status.error}</span></p>}
            {!status && <Note>{isGitHub ? t('tb.ghHint') : t('tb.npmHint')}</Note>}
        </SettingsPage>
    );
}

export {
    AddModule
}
