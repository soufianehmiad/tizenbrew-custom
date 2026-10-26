import { useState } from 'react';
import { ChoiceRow, Note, SettingsPage, Dialog } from '../components/ui.jsx';
import { Globe } from '../components/icons.jsx';
import { useTranslation } from 'react-i18next';

// The identity (User-Agent) apps see. Some apps work better when they think they are on another TV.
const UA_2017 = 'Mozilla/5.0 (LINUX; Tizen/3.0/2017.1.0) Cobalt/9.lts-gold (unlike Gecko) gles Evergreen/1.0.0 Starboard/9, Samsung_TV_KANTM_2017/T-MDEUC-1420.0 (Samsung, UE50MU7000, Wired)';
const UA_2021 = 'Mozilla/5.0 (LINUX; Tizen/6.0/2021.1.3) Cobalt/21.lts.4.302899-gold (unlike Gecko) v8/7.7.299.8-jit gles Evergreen/1.4.3 Starboard/12, Samsung_TV_NIKEM2_2021/T-NKM2AKUC-2111.1 (Samsung, QN55Q80AAFXZA, Wired)';

function thisTvModel() {
    try { return tizen.systeminfo.getCapability('http://tizen.org/system/model_name'); } catch (e) { return ''; }
}

// Built from this TV's own details (needs the TV's local settings API).
function thisTvUserAgent() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'http://127.0.0.1:8001/api/v2/', false);
    xhr.send();
    const apiData = JSON.parse(xhr.responseText);
    const firmware = tizen.systeminfo.getCapability('http://tizen.org/custom/sw_version');
    const model = thisTvModel();
    const chipsetModel = apiData.device.model.split('_')[1];
    return `${window.navigator.userAgent}, _TV_${chipsetModel}/${firmware} (Samsung, ${model}, Wired)`;
}

function currentId() {
    let ua = null;
    try { ua = localStorage.getItem('userAgent'); } catch (e) { }
    if (!ua) return 'default';
    if (ua === UA_2017) return '2017';
    if (ua === UA_2021) return '2021';
    return 'tv';
}

export function identityLabel(t) {
    return { default: t('settings.default'), '2017': t('settings.ua2017'), '2021': t('settings.ua2021'), tv: t('settings.uaThisTv') }[currentId()];
}

export function GlobeIcon() {
    return (
        <span className="tb-big" style={{ width: '600px', height: '360px', background: 'linear-gradient(180deg, #64D2FF 0%, #0A84FF 100%)' }}>
            <Globe size={180} />
        </span>
    );
}

export default function UserAgentSettings() {
    const { t } = useTranslation();
    const [id, setId] = useState(currentId());
    const [dialog, setDialog] = useState(null); // 'restart' | 'failed'

    function choose(next) {
        if (next === id) return;
        try {
            if (next === 'default') localStorage.removeItem('userAgent');
            else localStorage.setItem('userAgent', next === '2017' ? UA_2017 : next === '2021' ? UA_2021 : thisTvUserAgent());
        } catch (e) {
            setDialog('failed');
            return;
        }
        setId(next);
        setDialog('restart');
    }

    const options = [
        { id: 'default', label: t('settings.default') },
        { id: '2017', label: t('settings.ua2017'), value: t('settings.worksOnTizen', { version: 3 }) },
        { id: '2021', label: t('settings.ua2021'), value: t('settings.worksOnTizen', { version: 6 }) },
        { id: 'tv', label: t('settings.uaThisTv'), value: thisTvModel() }
    ];
    const startId = currentId();

    return (
        <SettingsPage title={t('settings.useragent')} icon={<GlobeIcon />} overlay={<>
            {dialog === 'restart' && (
                <Dialog title={t('settings.uaRestartTitle')} body={t('settings.uaRestartBody')} onClose={() => setDialog(null)}
                    actions={[
                        { label: t('settings.closeNow'), onClick: () => { try { tizen.application.getCurrentApplication().exit(); } catch (e) { } } },
                        { label: t('settings.later') }
                    ]} />
            )}
            {dialog === 'failed' && (
                <Dialog title={t('settings.uaFailedTitle')} body={t('settings.uaFailedBody')} onClose={() => setDialog(null)}
                    actions={[{ label: t('settings.ok') }]} />
            )}
        </>}>
            {options.map(o => (
                <ChoiceRow key={o.id} label={o.label} value={o.value} checked={o.id === id}
                    autoFocus={o.id === startId} onClick={() => choose(o.id)} />
            ))}
            <Note>{t('settings.identityNote')}</Note>
        </SettingsPage>
    );
}
