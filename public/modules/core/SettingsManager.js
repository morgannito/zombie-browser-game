/**
 * @file SettingsManager.js
 * @description Persist, migrate, and expose client settings via localStorage.
 * Schema versioning: bump {@link SCHEMA_VERSION} and add a migration block in
 * {@link migrate} when the settings shape changes.
 * @module SettingsManager
 * @version 2.0.0
 */

/** @constant {string} localStorage key */
const SETTINGS_KEY = 'zbg:settings';

/** @constant {number} Current schema version – increment on breaking changes */
const SCHEMA_VERSION = 2;

/**
 * @typedef {object} AudioSettings
 * @property {number} masterVolume - 0–1
 * @property {number} musicVolume  - 0–1
 */

/**
 * @typedef {object} KeybindingsSettings
 * @property {string} up     - Key code string
 * @property {string} down
 * @property {string} left
 * @property {string} right
 * @property {string} reload
 */

/**
 * @typedef {object} ControlsSettings
 * @property {boolean} azerty - Whether AZERTY keyboard layout is active
 */

/**
 * @typedef {object} ZbgSettings
 * @property {number}           version
 * @property {AudioSettings}    audio
 * @property {KeybindingsSettings} keybindings
 * @property {ControlsSettings} controls
 * @property {string}           theme
 * @property {boolean}          magnetPickup
 * @property {boolean}          parallax
 */

/** @type {ZbgSettings} */
const DEFAULTS = {
  version: SCHEMA_VERSION,
  audio: { masterVolume: 0.8, musicVolume: 0.5 },
  keybindings: { up: 'w', down: 's', left: 'a', right: 'd', reload: 'r' },
  controls: { azerty: false },
  theme: 'dark',
  magnetPickup: true,
  parallax: true
};

/**
 * Migrate stored settings to the current schema version.
 * Non-destructive: only adds missing fields, never removes existing data.
 * @param {object|null} stored - Parsed localStorage object (may be null)
 * @returns {ZbgSettings} Settings at {@link SCHEMA_VERSION}
 */
function migrate(stored) {
  if (!stored) return structuredClone(DEFAULTS);

  const v = stored.version ?? 1;

  // v1 → v2: add controls block
  if (v < 2) {
    stored.controls = stored.controls ?? { azerty: false };
    stored.version = 2;
  }

  // Future: add more cases here, e.g.:
  // if (v < 3) { stored.newField = ...; stored.version = 3; }

  return stored;
}

/**
 * Write a value to localStorage, returning false on QuotaExceededError
 * instead of throwing.
 * @param {string} key
 * @param {string} value
 * @returns {boolean}
 */
function safeLSSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn('[SettingsManager] localStorage write failed (quota?):', e);
    return false;
  }
}

class SettingsManager {
  constructor() {
    /** @type {ZbgSettings} */
    this._data = this._load();
  }

  /**
   * Load and migrate settings from localStorage.
   * Falls back to defaults on parse errors.
   * @private
   * @returns {ZbgSettings}
   */
  _load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const migrated = migrate(parsed);
      // Persist migrated data so next load is clean
      safeLSSet(SETTINGS_KEY, JSON.stringify(migrated));
      return migrated;
    } catch {
      return structuredClone(DEFAULTS);
    }
  }

  /**
   * Persist current settings to localStorage.
   * Swallows QuotaExceededError gracefully.
   * @private
   */
  _save() {
    safeLSSet(SETTINGS_KEY, JSON.stringify(this._data));
  }

  /**
   * Get a setting by dot-path (e.g. `'audio.masterVolume'`).
   * @param {string} path
   * @returns {*}
   */
  get(path) {
    return path.split('.').reduce((o, k) => o?.[k], this._data);
  }

  /**
   * Set a setting by dot-path and persist immediately.
   * Intermediate objects are created automatically.
   * @param {string} path
   * @param {*} value
   */
  set(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => o[k] ??= {}, this._data);
    target[last] = value;
    this._save();
  }

  /**
   * Reset all settings to factory defaults and persist.
   */
  reset() {
    this._data = structuredClone(DEFAULTS);
    this._save();
  }

  // ── Convenience helpers ─────────────────────────────────────────────────

  /**
   * Get a named volume level (0–1).
   * @param {'masterVolume'|'musicVolume'} [type='masterVolume']
   * @returns {number}
   */
  getVolume(type = 'masterVolume') {
    return this.get(`audio.${type}`);
  }

  /**
   * Set a named volume level, clamped to [0, 1].
   * @param {'masterVolume'|'musicVolume'} type
   * @param {number} v
   */
  setVolume(type, v) {
    this.set(`audio.${type}`, Math.max(0, Math.min(1, v)));
  }

  /**
   * Get the full keybindings map.
   * @returns {KeybindingsSettings}
   */
  getKeybindings() {
    return this._data.keybindings;
  }

  /**
   * Bind an action to a key (stored lowercase).
   * @param {string} action
   * @param {string} key
   */
  setKeybinding(action, key) {
    this.set(`keybindings.${action}`, key.toLowerCase());
  }
}

// Singleton
window.settingsManager = window.settingsManager ?? new SettingsManager();
