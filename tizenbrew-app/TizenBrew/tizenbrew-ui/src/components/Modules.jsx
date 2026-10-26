import { useEffect, useContext } from 'react';
import { useLocation } from 'preact-iso';
import { GlobalStateContext } from './ClientContext.jsx';
import { Events } from './WebSocketClient.js';
import ModuleIcon, { moduleTile } from './ModuleIcon.jsx';
import { cx, useTvFocus, appLabel, BASE } from './ui.jsx';
import { useTranslation } from 'react-i18next';

// Scroll the row so the selected tile sits in the second slot (the first one while at the start),
// so it never ends up under the faded right edge.
function keepInSecondSlot(el) {
  const row = el && el.parentElement;
  if (!row) return;
  const slot = el.offsetWidth + 32;
  const left = Math.max(0, el.offsetLeft - 120 - slot);
  if (row.scrollTo) row.scrollTo({ left, behavior: 'smooth' }); else row.scrollLeft = left;
}

function AppTile({ module, state, autoFocus }) {
  const { ref, focused, focusKey } = useTvFocus(autoFocus, true);

  useEffect(() => {
    if (!focused) return;
    keepInSecondSlot(ref.current);
  }, [focused]);

  function open() {
    // Failed downloads have nothing to open (and opening them reloaded TizenBrew).
    if (module.failed || (!module.appPath && !module.evaluateScriptOnDocumentStart)) {
      window.dispatch({ type: 'SET_ERROR', payload: { message: 'errors.moduleNotFound', args: { moduleName: module.fullName }, disappear: true } });
      return;
    }
    for (const key of module.keys) {
      tizen.tvinputdevice.registerKey(key);
    }
    state.client.send({ type: Events.LaunchModule, payload: module });
    window.dispatch({ type: 'SET_OPENING', payload: module });
    if (!module.evaluateScriptOnDocumentStart) {
      location.href = module.appPath;
    }
  }

  return (
    // No visible name: the logo says which app it is (the name stays for screen readers).
    <div ref={ref} data-fk={focusKey} onClick={open} className={cx('tb-app', focused && 'focus')} aria-label={appLabel(module)} role="button">
      <span className="tb-tile" style={{ background: moduleTile(module).bg }}>
        <ModuleIcon module={module} size={moduleTile(module).size || undefined} plain />
      </span>
    </div>
  );
}

function AddTile({ autoFocus }) {
  const loc = useLocation();
  const { t } = useTranslation();
  const { ref, focused, focusKey } = useTvFocus(autoFocus, true);

  useEffect(() => {
    if (!focused) return;
    keepInSecondSlot(ref.current);
  }, [focused]);

  return (
    <div ref={ref} data-fk={focusKey} onClick={() => loc.route(BASE + '/module-manager/add?type=npm')} className={cx('tb-app', focused && 'focus')} aria-label={t('tb.addApp')} role="button">
      <span className="tb-tile tb-tile-add">
        <svg aria-hidden="true" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.3" stroke-linecap="round"><path d="M12 4.5v15M4.5 12h15"></path></svg>
      </span>
    </div>
  );
}

export default function Modules() {
  const { state } = useContext(GlobalStateContext);
  const modules = state?.sharedData?.modules;

  if (!modules) return null; // the start-up screen covers this moment

  return (
    <section className="tb-apps" aria-label="Apps">
      {modules.map((module, idx) => (
        <AppTile key={module.fullName} module={module} state={state} autoFocus={idx === 0} />
      ))}
      <AddTile autoFocus={modules.length === 0} />
    </section>
  );
}
