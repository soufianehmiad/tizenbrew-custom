import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resources from './i18nResources.js';

// Initialise right away (synchronously) so the very first screen already has its text.
// Upstream initialised only inside the async Tizen LOCALE callback, so anything drawn before
// that callback showed raw keys (e.g. "tb.holdUp") and some parts never refreshed.
i18n
  .use(initReactI18next)
  .init({
    lng: (navigator.language || 'en').replace(/(\-.*)/g, ''),
    fallbackLng: 'en',
    resources,
    initImmediate: false,
    interpolation: {
      escapeValue: false,
    }
  });

// Then switch to the TV's own language once it is known (re-renders every translated component).
try {
  tizen.systeminfo.getPropertyValue("LOCALE", function (locale) {
    const lng = locale.language.replace(/(\_.*)/g, '');
    if (lng && lng !== i18n.language) i18n.changeLanguage(lng);
  }, function (_) { });
} catch (e) { }

export default i18n;
