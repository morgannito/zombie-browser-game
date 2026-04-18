/**
 * SETTINGS MANAGER
 * Persist, migrate, and expose client settings via localStorage
 * @module SettingsManager
 * @version 1.0.0
 */

const SETTINGS_KEY = 'zbg:settings';
const SCHEMA_VERSION = 1;

const DEFAULTS = {
  version: SCHEMA_VERSION,
  audio: { masterVolume: 0.8, musicVolume: 0.5 },
  keybindings: { up: 'w', down: 's', left: 'a', right: 'd', reload: 'r' },
  theme: 'dark',
  magnetPickup: true
};

function migrate(stored) {
  if (!stored || stored.version === SCHEMA_VERSION) {
return stored;
}
  // v0 → v1: add theme field
  if (!stored.theme) {
stored.theme = DEFAULTS.theme;
}
  stored.version = SCHEMA_VERSION;
  return stored;
}

class SettingsManager {
  constructor() {
    this._data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return migrate(parsed) ?? structuredClone(DEFAULTS);
    } catch {
      return structuredClone(DEFAULTS);
    }
  }

  _save() {
    try {
 localStorage.setItem(SETTINGS_KEY, JSON.stringify(this._data));
} catch (e) {
 console.warn('[Settings] save failed:', e);
}
  }

  get(path) {
    return path.split('.').reduce((o, k) => o?.[k], this._data);
  }

  set(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => o[k] ??= {}, this._data);
    target[last] = value;
    this._save();
  }

  reset() {
    this._data = structuredClone(DEFAULTS);
    this._save();
  }

  // Convenience helpers
  getVolume(type = 'masterVolume') {
 return this.get(`audio.${type}`);
}
  setVolume(type, v) {
 this.set(`audio.${type}`, Math.max(0, Math.min(1, v)));
}

  getKeybindings() {
 return this._data.keybindings;
}
  setKeybinding(action, key) {
 this.set(`keybindings.${action}`, key.toLowerCase());
}
}

// Singleton
window.settingsManager = window.settingsManager ?? new SettingsManager();
