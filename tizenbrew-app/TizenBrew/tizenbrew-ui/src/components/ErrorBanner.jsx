// A problem, said plainly: what happened and what to do. On Home it takes the caption's place.
import { useTranslation } from 'react-i18next';
import { Warning } from './icons.jsx';

// Known messages get a short title; anything else (raw text from the service) shows as the body.
const TITLES = {
    'errors.debuggingNotEnabled': 'errors.debuggingTitle',
    'errors.moduleNotFound': 'errors.openTitle',
    'errors.serviceDidntConnectYet': 'errors.waitTitle',
    'errors.crashedServices': 'errors.servicesTitle',
    'home.addFailed': 'errors.addTitle'
};

export default function ErrorBanner({ error, className }) {
    const { t } = useTranslation();
    const msg = error.message;
    const isKey = !/\s/.test(msg);
    const titleKey = isKey && TITLES[msg];
    const title = titleKey ? t(titleKey) : t('errors.genericTitle');
    const body = msg === 'errors.debuggingNotEnabled' ? t('errors.debuggingFix') : (isKey ? t(msg, error.args) : msg);
    return (
        <div className={className || 'tb-banner'} role="alert">
            <span className="tb-banner-icon"><Warning size={44} /></span>
            <span className="tb-banner-text">
                <span className="tb-banner-title">{title}</span>
                <span className="tb-banner-body">{body}</span>
            </span>
        </div>
    );
}
