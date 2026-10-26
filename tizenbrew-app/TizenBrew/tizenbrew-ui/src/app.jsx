import { LocationProvider, ErrorBoundary, Router, Route, useLocation } from 'preact-iso';
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
import AppFace, { moduleSplash } from './components/ModuleIcon.jsx';
import ErrorBanner from './components/ErrorBanner.jsx';
import { Spinner, BASE } from './components/ui.jsx';
import { clearOpeningHint } from './components/launch.js';

// The interface is laid out at 1920x1080; scale it to the TV's viewport. From the width only: the
// on-screen keyboard makes the viewport shorter, and scaling by height shrank the whole screen.
function fitScreen() {
  const el = document.querySelector('.tb-screen');
  if (!el) return;
  const scale = window.innerWidth / 1920;
  el.style.transform = Math.abs(scale - 1) < 0.001 ? '' : `scale(${scale})`;
}

// Errors: on Home the banner takes the caption's place (Home draws it); elsewhere it sits at the bottom.
function PageError({ error }) {
  const loc = useLocation();
  const onHome = loc.path === BASE || loc.path === BASE + '/';
  if (!error.message || onHome) return null;
  return <ErrorBanner error={error} className="tb-banner tb-banner-toast" />;
}

export default function App() {
  const context = useContext(GlobalStateContext);
  window.dispatch = context.dispatch;
  window.state = context.state;
  const shared = context.state.sharedData;

  useEffect(() => {
    if (shared.error.disappear) {
      const timer = setTimeout(() => {
        context.dispatch({ type: 'SET_ERROR', payload: { message: null, disappear: false } });
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [shared.error.disappear, shared.error.message]);

  useEffect(() => {
    fitScreen();
    window.addEventListener('resize', fitScreen);
    // index.html shows the same start screen before the code loads; now ours is up, remove it.
    const boot = document.getElementById('tb-boot');
    if (boot) boot.parentNode.removeChild(boot);
    if (!window.setClient) {
      startService(context);
      window.setClient = true;
    }
  }, []);

  // If an app fails to open, don't leave the opening screen up forever.
  useEffect(() => {
    if (!shared.opening) return;
    const timer = setTimeout(() => { clearOpeningHint(); context.dispatch({ type: 'SET_OPENING', payload: null }); }, 25000);
    return () => clearTimeout(timer);
  }, [shared.opening]);

  // Start-up screen until the app list arrives (an autolaunch follows right after),
  // unless an error needs to be read.
  const starting = !shared.modules && !shared.error.message;
  const opening = shared.opening;
  const splash = opening && moduleSplash(opening);

  return (
    <ErrorBoundary>
      <LocationProvider>
        <div className="tb-screen">
          <Router>
            <Route component={Home} path="/tizenbrew-ui/dist/index.html" />
            <Route component={ModuleManager} path="/tizenbrew-ui/dist/index.html/module-manager" />
            <Route component={AddModule} path="/tizenbrew-ui/dist/index.html/module-manager/add" />
            <Route component={Settings} path="/tizenbrew-ui/dist/index.html/settings" />
            <Route component={Change} path="/tizenbrew-ui/dist/index.html/settings/change" />
            <Route component={UserAgentSettings} path="/tizenbrew-ui/dist/index.html/settings/change-ua" />
            <Route component={About} path="/tizenbrew-ui/dist/index.html/about" />
          </Router>
          <Header />
          <PageError error={shared.error} />
          {opening && (
            // Like the app's own launch screen: its logo on a plain dark background, nothing else.
            <div className="tb-overlay" style={{ background: splash ? splash.bg : '#141416' }}>
              {splash
                ? <img src={splash.img} alt="" style={{ width: splash.width + 'px', display: 'block' }} />
                : <AppFace module={opening} width={504} height={303} radius={34} glyph={140} />}
            </div>
          )}
          {!opening && starting && (
            <div className="tb-overlay tb-overlay-start" role="status">
              <img src={TBIcon} className="tb-overlay-logo" alt="TizenBrew" />
              <Spinner size={56} />
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
        context.dispatch({ type: 'SET_ERROR', payload: { message: 'Launch Service failed: ' + e.message, disappear: false } });
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
