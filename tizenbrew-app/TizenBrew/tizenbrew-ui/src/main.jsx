import { render } from 'preact'
import './index.css'
import App from './app.jsx'
import { GlobalStateProvider } from './components/ClientContext.jsx'
import { init, setFocus } from '@noriginmedia/norigin-spatial-navigation';

init({ });

// After Back, make sure something is selected: a page that remounts focuses its own first item;
// if nothing has focus (e.g. the same page stayed mounted), pick the first item in the content.
function restoreFocus() {
    setTimeout(() => {
        if (document.querySelector('.focus')) return;
        const el = document.querySelector('.tb-main [data-fk], .tb-apps [data-fk], [data-fk]');
        if (el) setFocus(el.getAttribute('data-fk'));
    }, 150);
}

const HOME = '/tizenbrew-ui/dist/index.html';

// One step back, at most once per Back press: closing the TV keyboard with Back also blurs the
// field (Add app), and both used to navigate, which could leave Home out of the history (stuck).
// If there is nothing to go back to, go Home instead of doing nothing.
window.tbLastBack = 0;
window.tbGoBack = function () {
    const now = Date.now();
    if (now - window.tbLastBack < 500) return;
    window.tbLastBack = now;
    const before = location.href;
    history.back();
    restoreFocus();
    setTimeout(() => {
        if (location.href === before && location.pathname !== HOME) {
            history.replaceState(null, '', HOME);
            dispatchEvent(new PopStateEvent('popstate'));
            restoreFocus();
        }
    }, 400);
};

window.shouldDisableAutoLaunch = false;
window.addEventListener('keydown', (e) => {
    if (e.keyCode === 13) {
        document.querySelector('.focus')?.click();
    } else if (e.keyCode === 10009) {
        // Already handled (e.g. the keyboard just closed with Back): don't go back again or exit.
        if (Date.now() - window.tbLastBack < 500) return;
        if (location.pathname !== HOME) {
            window.tbGoBack();
        } else {
            tizen.application.getCurrentApplication().exit();
        }
    } else if (e.keyCode === 38) {
        window.shouldDisableAutoLaunch = true;
    }
});
try {
    if (localStorage.getItem('userAgent')) tizen.websetting.setUserAgentString(localStorage.getItem('userAgent'));
    tizen.tvinputdevice.registerKey("ColorF0Red");
    tizen.tvinputdevice.registerKey("ColorF1Green");
    tizen.tvinputdevice.registerKey("ColorF2Yellow");
    tizen.tvinputdevice.registerKey("ColorF3Blue");
} catch (e) {}

render(<GlobalStateProvider><App /></GlobalStateProvider>, document.getElementById('app'));