import { LocationProvider, ErrorBoundary, Router, Route } from 'preact-iso';
import TBIcon from './assets/tizenbrew-app-icon.svg';
import Home from './pages/Home.jsx';
import ModuleManager, { AddModule } from './pages/ModuleManager.jsx';
import Header from './components/Header.jsx';
import { GlobalStateContext } from './components/ClientContext.jsx';
import { useEffect, useContext } from 'react';
import Client from './components/WebSocketClient.js';
import Settings, { Change } from './pages/Settings.jsx';
import About from './pages/About.jsx';
import './components/i18n.js';
import UserAgentSettings from './pages/UserAgentSettings.jsx';
import ModuleIcon, { moduleSplash } from './components/ModuleIcon.jsx';
import { Spinner, setBackdropTint, NEUTRAL_TINT } from './components/ui.jsx';
import { useTranslation } from 'react-i18next';

// The interface is laid out at 1920x1080; scale it to whatever viewport the TV reports.
function fitScreen() {
  const el = document.querySelector('.tb-screen');
  if (!el) return;
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  el.style.transform = Math.abs(scale - 1) < 0.001 ? '' : `scale(${scale})`;
}

export default function App() {
  const context = useContext(GlobalStateContext);
  const { t } = useTranslation();
  window.dispatch = context.dispatch;
  window.state = context.state;
  const shared = context.state.sharedData;

  useEffect(() => {
    if (shared.error.disappear) {
      setTimeout(() => {
        context.dispatch({
          type: 'SET_ERROR',
          payload: {
            message: null,
            disappear: false
          }
        });
      }, 5000);
    }
  }, [shared.error.disappear]);

  useEffect(() => {
    fitScreen();
    window.addEventListener('resize', fitScreen);
    setBackdropTint(NEUTRAL_TINT);
    if (!window.setClient) {
      startService(context);
      window.setClient = true;
    }
  }, []);

  // If an app fails to open, don't leave the opening screen up forever.
  useEffect(() => {
    if (!shared.opening) return;
    const timer = setTimeout(() => context.dispatch({ type: 'SET_OPENING', payload: null }), 20000);
    return () => clearTimeout(timer);
  }, [shared.opening]);

  // Start-up screen until the app list arrives (an autolaunch follows right after),
  // unless an error needs to be read.
  const starting = !shared.modules && !shared.error.message;
  const opening = shared.opening;

  return (
    <ErrorBoundary>
      <LocationProvider>
        <div className="tb-screen">
          <div id="tb-backdrop" className="tb-backdrop" aria-hidden="true"></div>
          <Header />
          {shared.error.message && (
            <div className="tb-error" role="alert">{/\s/.test(shared.error.message) ? shared.error.message : t(shared.error.message, shared.error.args)}</div>
          )}
          <Router>
            <Route component={Home} path="/tizenbrew-ui/dist/index.html" />
            <Route component={ModuleManager} path="/tizenbrew-ui/dist/index.html/module-manager" />
            <Route component={AddModule} path="/tizenbrew-ui/dist/index.html/module-manager/add" />
            <Route component={Settings} path="/tizenbrew-ui/dist/index.html/settings" />
            <Route component={Change} path="/tizenbrew-ui/dist/index.html/settings/change" />
            <Route component={UserAgentSettings} path="/tizenbrew-ui/dist/index.html/settings/change-ua" />
            <Route component={About} path="/tizenbrew-ui/dist/index.html/about" />
          </Router>
          {opening && (
            // Like the app's own launch screen: its logo on a plain dark background, nothing else.
            <div className="tb-overlay" style={{ background: moduleSplash(opening) ? moduleSplash(opening).bg : '#000000' }}>
              {moduleSplash(opening)
                ? <img src={moduleSplash(opening).img} alt="" style={{ width: moduleSplash(opening).width + 'px', display: 'block' }} />
                : <ModuleIcon module={opening} size={230} />}
            </div>
          )}
          {!opening && starting && (
            <div className="tb-overlay">
              <img src={TBIcon} className="tb-overlay-logo" alt="" />
              <Spinner />
            </div>
          )}
        </div>
      </LocationProvider>
    </ErrorBoundary>
  );
}


function startService(context) {
  const testWS = new WebSocket('ws://localhost:8081');

  testWS.onerror = () => {
    const pkgId = tizen.application.getCurrentApplication().appInfo.packageId;

    const serviceId = pkgId + ".StandaloneService";

    tizen.application.launchAppControl(
      new tizen.ApplicationControl("http://tizen.org/appcontrol/operation/service"),
      serviceId,
      function () {
        context.dispatch({
          type: 'SET_STATE',
          payload: 'service.started'
        });

        window.location.reload();
      },
      function (e) {
        alert("Launch Service failed: " + e.message);
      }
    );
  }

  testWS.onopen = () => {
    context.dispatch({
      type: 'SET_STATE',
      payload: 'service.alreadyRunning'
    });

    context.dispatch({
      type: 'SET_CLIENT',
      payload: new Client(context)
    });

  }
}