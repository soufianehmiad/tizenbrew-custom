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

window.shouldDisableAutoLaunch = false;
window.addEventListener('keydown', (e) => {
    if (e.keyCode === 13) {
        document.querySelector('.focus')?.click();
    } else if (e.keyCode === 10009) {
        if (location.pathname !== '/tizenbrew-ui/dist/index.html') {
            history.back();
            restoreFocus();
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