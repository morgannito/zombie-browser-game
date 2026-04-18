/**
 * i18n - Internationalization helper
 * Supports runtime language switch without reload.
 * Persists locale in localStorage (settings key).
 */

const I18n = (() => {
  const STORAGE_KEY = 'gameSettings';
  const LOCALE_KEY = 'locale';
  const FALLBACK = 'en';

  let _locale = FALLBACK;
  const _dicts = {};
  const _listeners = [];

  async function _load(lang) {
    if (_dicts[lang]) {
return;
}
    const res = await fetch(`/modules/i18n/${lang}.json`);
    if (!res.ok) {
throw new Error(`i18n: failed to load ${lang}`);
}
    _dicts[lang] = await res.json();
  }

  function _persist(lang) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const settings = raw ? JSON.parse(raw) : {};
      settings[LOCALE_KEY] = lang;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (_) { /* ignore storage errors */ }
  }

  function _readPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw)[LOCALE_KEY] || null) : null;
    } catch (_) {
 return null;
}
  }

  async function init(defaultLang) {
    const saved = _readPersisted();
    const lang = saved || defaultLang || FALLBACK;
    await _load(FALLBACK);
    if (lang !== FALLBACK) {
await _load(lang).catch(() => {});
}
    _locale = lang;
  }

  async function setLocale(lang) {
    if (!_dicts[lang]) {
await _load(lang);
}
    _locale = lang;
    _persist(lang);
    _listeners.forEach(fn => fn(lang));
  }

  function t(key) {
    return (_dicts[_locale] && _dicts[_locale][key])
      || (_dicts[FALLBACK] && _dicts[FALLBACK][key])
      || key;
  }

  function onLocaleChange(fn) {
 _listeners.push(fn);
}
  function getLocale() {
 return _locale;
}

  return { init, setLocale, t, onLocaleChange, getLocale };
})();

if (typeof module !== 'undefined') {
module.exports = I18n;
}
