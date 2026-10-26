import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import { SettingsLayout } from '../components/ui.jsx';
import TBIcon from '../assets/tizenbrew-app-icon.svg';

export default function About() {
    const tizenVersion = tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version');
    const tvModel = tizen.systeminfo.getCapability('http://tizen.org/system/model_name');
    const appVersion = tizen.application.getCurrentApplication().appInfo.version;
    const { t } = useTranslation();
    // The service status the original header showed ("Service connected to the app." etc.).
    const status = useContext(GlobalStateContext).state.sharedData.state;

    return (
        <SettingsLayout active="about" focusNav>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
                <img src={TBIcon} alt="" style={{ width: '140px', height: '140px', marginRight: '36px' }} />
                <div>
                    <div style={{ fontSize: '52px' }}>TizenBrew</div>
                    <div className="tb-muted" style={{ fontSize: '30px', marginTop: '8px' }}>{t('tb.tagline')}</div>
                </div>
            </div>
            <div className="tb-info"><span>{t('tb.version')}</span><span className="tb-muted">{appVersion}</span></div>
            <div className="tb-info"><span>{t('tb.tizenVersion')}</span><span className="tb-muted">{tizenVersion}</span></div>
            <div className="tb-info"><span>{t('tb.tvModel')}</span><span className="tb-muted">{tvModel}</span></div>
            {status && <div className="tb-info"><span>{t('tb.status')}</span><span className="tb-muted">{t(status)}</span></div>}
        </SettingsLayout>
    )
}
