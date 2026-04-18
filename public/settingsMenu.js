/**
 * @file settingsMenu.js
 * @description Persistent settings menu: audio, graphics, controls, accessibility, themes.
 * Settings are saved under the key {@link SETTINGS_KEY} in localStorage.
 * Schema version is tracked at {@link SCHEMA_VERSION} – bump and add a case to
 * {@link migrateSettings} whenever the shape changes.
 *
 * Public API:
 *   open()            — show the menu (restores last active tab)
 *   close()           — hide the menu
 *   apply()           — save + apply + close
 *   reset()           — revert to defaults and save
 *   getSettings()     → currentSettings object (live reference)
 *   applyTheme(theme) — 'dark' | 'neon' | 'retro'
 *   destroy()         — remove all document-level listeners
 */

/** @constant {string} localStorage key for game settings */
const SETTINGS_KEY = 'zombie-game-settings';

/** @constant {number} Current schema version – increment on breaking shape changes */
const SCHEMA_VERSION = 2;

/**
 * Migrate stored settings from an older schema version to the current one.
 * Add a new `case` here whenever SCHEMA_VERSION is bumped.
 * @param {object} stored - Raw parsed object from localStorage
 * @returns {object} Migrated settings object at SCHEMA_VERSION
 */
function migrateSettings(stored) {
  const v = stored._version ?? 1;

  // v1 → v2: add controls + accessibility blocks, add graphics.weatherEffects
  if (v < 2) {
    stored.controls    = stored.controls    ?? { azerty: false };
    stored.accessibility = stored.accessibility ?? {
      reduceScreenShake: false,
      reduceFlashEffects: false,
      largeHudText: false,
      showZombieOutlines: false
    };
    if (stored.graphics) {
      stored.graphics.weatherEffects = stored.graphics.weatherEffects ?? false;
      stored.graphics.customCursor   = stored.graphics.customCursor   ?? true;
    }
    stored._version = 2;
  }

  return stored;
}

/**
 * Try to write a value to localStorage, swallowing quota errors gracefully.
 * @param {string} key
 * @param {string} value
 * @returns {boolean} true on success
 */
function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    // DOMException: QuotaExceededError
    console.warn('[Settings] localStorage write failed (quota?):', e);
    return false;
  }
}

class SettingsMenu {
  constructor() {
    this.settingsKey = SETTINGS_KEY;

    /** @type {object} Default settings shape (also used as v2 template) */
    this.defaultSettings = {
      _version: SCHEMA_VERSION,
      audio: { master: 70, music: 50, sfx: 80 },
      graphics: {
        quality: 'medium',
        particles: true,
        screenShake: true,
        blood: true,
        customCursor: true,
        weatherEffects: false
      },
      controls: { azerty: false },
      accessibility: {
        reduceScreenShake: false,
        reduceFlashEffects: false,
        largeHudText: false,
        showZombieOutlines: false
      }
    };

    this.THEME_KEY = 'pref_theme';

    this.currentSettings = this.loadSettings();
    this.applyTheme(localStorage.getItem(this.THEME_KEY) || 'dark');
    this.init();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /** @private Wait for DOM readiness then wire up all listeners. */
  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
    } else {
      this.setupEventListeners();
    }
  }

  /** @private Attach all DOM event listeners. */
  setupEventListeners() {
    this._bindOpenClose();
    this._bindTabs();
    this._bindControls();
    this._initSkinPalette();
    this._bindFooterButtons();
    this.showSettingsButton();
    this.applySettings();
  }

  /**
   * Remove all document-level event listeners attached by this instance.
   * Call when tearing down between game sessions.
   */
  destroy() {
    if (this._onKeydown) {
      document.removeEventListener('keydown', this._onKeydown);
      this._onKeydown = null;
    }
  }

  // ── Private binding helpers ──────────────────────────────────────────────

  /** @private Bind open / close / overlay / ESC. */
  _bindOpenClose() {
    const settingsBtn    = document.getElementById('settings-btn');
    const settingsMenu   = document.getElementById('settings-menu');
    const closeBtn       = document.getElementById('settings-close-btn');
    const overlay        = document.querySelector('.settings-overlay');

    if (settingsBtn) settingsBtn.addEventListener('click', () => this.open());
    if (closeBtn)    closeBtn.addEventListener('click',   () => this.close());
    if (overlay)     overlay.addEventListener('click',    () => this.close());

    this._onKeydown = (e) => {
      if (e.key === 'Escape' && settingsMenu && settingsMenu.style.display === 'block') {
        this.close();
      }
    };
    document.addEventListener('keydown', this._onKeydown);
  }

  /** @private Bind tab-switcher buttons. */
  _bindTabs() {
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });
  }

  /** @private Bind sliders, toggles, and selects inside the panel. */
  _bindControls() {
    document.querySelectorAll('.slider').forEach(slider => {
      slider.addEventListener('input', (e) => this.updateSlider(e.target));
    });

    document.querySelectorAll('.toggle-switch input').forEach(toggle => {
      toggle.addEventListener('change', (e) => this.updateToggle(e.target));
    });

    document.querySelectorAll('.settings-select').forEach(select => {
      select.addEventListener('change', (e) => this.updateSelect(e.target));
    });
  }

  /** @private Bind Apply and Reset footer buttons. */
  _bindFooterButtons() {
    const applyBtn = document.getElementById('settings-apply-btn');
    const resetBtn = document.getElementById('settings-reset-btn');
    if (applyBtn) applyBtn.addEventListener('click', () => this.apply());
    if (resetBtn) resetBtn.addEventListener('click', () => this.reset());
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Make the settings gear button visible. */
  showSettingsButton() {
    const btn = document.getElementById('settings-btn');
    if (btn) btn.style.display = 'flex';
  }

  /** Open the settings menu, restoring the last active tab. */
  open() {
    const menu = document.getElementById('settings-menu');
    if (menu) {
      menu.style.display = 'block';
      const lastTab = localStorage.getItem('settings-last-tab') || 'audio';
      this.switchTab(lastTab);
    }
  }

  /** Close the settings menu. */
  close() {
    const menu = document.getElementById('settings-menu');
    if (menu) menu.style.display = 'none';
  }

  /**
   * Save, apply, and close the settings menu.
   * Shows a confirmation toast if ToastManager is available.
   */
  apply() {
    this.saveSettings();
    this.applySettings();
    this.close();

    if (typeof ToastManager !== 'undefined') {
      const msg = (typeof I18n !== 'undefined' ? I18n.t('settings.saved') : 'Paramètres sauvegardés');
      ToastManager.show({ message: msg, type: '✓', duration: 'success' });
    }
  }

  /**
   * Revert all settings to factory defaults, apply, save, and refresh the UI.
   * Also resets TutorialOverlay completion state if available.
   */
  reset() {
    this.currentSettings = JSON.parse(JSON.stringify(this.defaultSettings));
    this.saveSettings();
    this.applySettings();
    this.updateUI();

    if (typeof TutorialOverlay !== 'undefined') TutorialOverlay.reset();

    if (typeof ToastManager !== 'undefined') {
      const msg = (typeof I18n !== 'undefined' ? I18n.t('settings.reset') : 'Paramètres réinitialisés');
      ToastManager.show({ message: msg, type: '🔄', duration: 'info' });
    }
  }

  /**
   * Activate the given tab by name, persisting the choice in localStorage.
   * @param {string} tabName - Tab identifier (e.g. 'audio', 'graphics')
   */
  switchTab(tabName) {
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    document.querySelectorAll('.settings-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `settings-${tabName}`);
    });

    localStorage.setItem('settings-last-tab', tabName);
  }

  /**
   * Synchronise a range slider's visible value label and update currentSettings.
   * @param {HTMLInputElement} slider
   */
  updateSlider(slider) {
    const display = slider.parentElement.querySelector('.slider-value');
    if (display) display.textContent = `${slider.value}%`;

    const val = parseInt(slider.value);
    if      (slider.id === 'volume-master') this.currentSettings.audio.master = val;
    else if (slider.id === 'volume-music')  this.currentSettings.audio.music  = val;
    else if (slider.id === 'volume-sfx')    this.currentSettings.audio.sfx    = val;
  }

  /**
   * Handle a toggle switch change event and update currentSettings.
   * @param {HTMLInputElement} toggle
   */
  updateToggle(toggle) {
    this._updateGraphicsToggle(toggle) ||
    this._updateControlsToggle(toggle) ||
    this._updateAccessibilityToggle(toggle);
  }

  /**
   * Handle a select dropdown change and update currentSettings.
   * @param {HTMLSelectElement} select
   */
  updateSelect(select) {
    if (select.id === 'graphics-quality') {
      this.currentSettings.graphics.quality = select.value;
    } else if (select.id === 'ui-theme' || select.id === 'ui-theme-interface') {
      this.applyTheme(select.value);
      const otherId = select.id === 'ui-theme' ? 'ui-theme-interface' : 'ui-theme';
      const other = document.getElementById(otherId);
      if (other) other.value = select.value;
    }
  }

  /**
   * Return a live reference to the current settings object.
   * @returns {object}
   */
  getSettings() {
    return this.currentSettings;
  }

  // ── Private toggle helpers ───────────────────────────────────────────────

  /**
   * @private Handle graphics-section toggles.
   * @param {HTMLInputElement} toggle
   * @returns {boolean} true if the toggle was handled
   */
  _updateGraphicsToggle(toggle) {
    const g = this.currentSettings.graphics ??= {};
    switch (toggle.id) {
    case 'particles-toggle':
      g.particles = toggle.checked;
      return true;
    case 'screen-shake-toggle':
      g.screenShake = toggle.checked;
      return true;
    case 'blood-toggle':
      g.blood = toggle.checked;
      return true;
    case 'custom-cursor-toggle':
      g.customCursor = toggle.checked;
      if (window.CursorManager) window.CursorManager.setEnabled(toggle.checked);
      return true;
    case 'magnet-pickup-toggle':
      g.magnetPickup = toggle.checked;
      return true;
    case 'weather-effects-toggle':
      g.weatherEffects = toggle.checked;
      return true;
    default:
      return false;
    }
  }

  /**
   * @private Handle controls-section toggles.
   * @param {HTMLInputElement} toggle
   * @returns {boolean} true if the toggle was handled
   */
  _updateControlsToggle(toggle) {
    if (toggle.id !== 'azerty-toggle') return false;
    (this.currentSettings.controls ??= {}).azerty = toggle.checked;
    return true;
  }

  /**
   * @private Handle accessibility-section toggles.
   * @param {HTMLInputElement} toggle
   * @returns {boolean} true if the toggle was handled
   */
  _updateAccessibilityToggle(toggle) {
    const a = this.currentSettings.accessibility ??= {};
    switch (toggle.id) {
    case 'reduce-screen-shake-toggle': a.reduceScreenShake  = toggle.checked; return true;
    case 'reduce-flash-toggle':        a.reduceFlashEffects = toggle.checked; return true;
    case 'large-hud-toggle':           a.largeHudText       = toggle.checked; return true;
    case 'zombie-outlines-toggle':     a.showZombieOutlines = toggle.checked; return true;
    default: return false;
    }
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  /**
   * Load settings from localStorage, running schema migration as needed.
   * Falls back to defaults on parse error or missing data.
   * @returns {object} Migrated settings at the current schema version
   */
  loadSettings() {
    try {
      const raw = localStorage.getItem(this.settingsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        return migrateSettings(parsed);
      }
    } catch (err) {
      console.warn('[Settings] Failed to load settings:', err);
    }
    return JSON.parse(JSON.stringify(this.defaultSettings));
  }

  /**
   * Persist currentSettings to localStorage.
   * Swallows QuotaExceededError and logs a warning instead of crashing.
   */
  saveSettings() {
    safeLocalStorageSet(this.settingsKey, JSON.stringify(this.currentSettings));
  }

  // ── Apply ────────────────────────────────────────────────────────────────

  /**
   * Apply all currentSettings to the running game and DOM.
   * Called automatically on open and after load/reset.
   */
  applySettings() {
    this.applyAudioSettings();
    this.applyGraphicsSettings();
    this._applyControlsSettings();
    this._applyMagnetPickupSetting();
    this.updateUI();
  }

  /** @private Propagate audio settings to AudioSystem (if present). */
  applyAudioSettings() {
    const { master, music, sfx } = this.currentSettings.audio;
    if (window.AudioSystem) {
      window.AudioSystem.setMasterVolume(master / 100);
      window.AudioSystem.setMusicVolume(music / 100);
      window.AudioSystem.setSFXVolume(sfx / 100);
    }
  }

  /**
   * Apply all graphics settings (quality preset, toggles, accessibility, cursor, weather).
   * Splits into focused helpers to stay under 25 lines.
   */
  applyGraphicsSettings() {
    const g = this.currentSettings.graphics;

    if (!window.gameSettings) window.gameSettings = {};

    window.gameSettings.graphicsQuality    = g.quality;
    window.gameSettings.particlesEnabled   = g.particles;
    window.gameSettings.screenShakeEnabled = g.screenShake;
    window.gameSettings.bloodEnabled       = g.blood;

    this._applyAccessibilitySettings();
    this._applyQualityPreset(g.quality);

    const customCursor = g.customCursor ?? true;
    window.gameSettings.customCursor = customCursor;
    if (window.CursorManager) window.CursorManager.setEnabled(customCursor);

    const weatherEffects = g.weatherEffects ?? false;
    window.gameSettings.weatherEffects = weatherEffects;
    if (window.weatherRenderer) window.weatherRenderer.setEnabled(weatherEffects);
  }

  /**
   * @private Write accessibility flags to window.gameSettings and toggle HUD class.
   */
  _applyAccessibilitySettings() {
    const a = this.currentSettings.accessibility || {};
    window.gameSettings.reduceScreenShake  = a.reduceScreenShake  ?? false;
    window.gameSettings.reduceFlashEffects = a.reduceFlashEffects ?? false;
    window.gameSettings.showZombieOutlines = a.showZombieOutlines ?? false;

    const statsEl = document.getElementById('stats');
    if (statsEl) statsEl.classList.toggle('hud-large-text', a.largeHudText ?? false);
  }

  /**
   * @private Set particle / shadow limits according to the quality preset.
   * @param {'low'|'medium'|'high'|'ultra'} quality
   */
  _applyQualityPreset(quality) {
    const presets = {
      low:    { maxParticles: 50,  shadowQuality: 'off'    },
      medium: { maxParticles: 100, shadowQuality: 'low'    },
      high:   { maxParticles: 200, shadowQuality: 'medium' },
      ultra:  { maxParticles: 500, shadowQuality: 'high'   }
    };
    const preset = presets[quality] || presets.medium;
    window.gameSettings.maxParticles  = preset.maxParticles;
    window.gameSettings.shadowQuality = preset.shadowQuality;
  }

  /**
   * @private Propagate AZERTY flag to window.gameSettings and SettingsManager.
   */
  _applyControlsSettings() {
    const azerty = this.currentSettings.controls?.azerty ?? false;
    if (window.gameSettings) window.gameSettings.azerty = azerty;
    if (window.settingsManager) window.settingsManager.set('controls.azerty', azerty);
  }

  /** @private Propagate magnetPickup setting to SettingsManager. */
  _applyMagnetPickupSetting() {
    const magnetPickup = this.currentSettings.graphics?.magnetPickup ?? true;
    if (window.settingsManager) window.settingsManager.set('magnetPickup', magnetPickup);
  }

  // ── UI sync ──────────────────────────────────────────────────────────────

  /**
   * Synchronise all UI controls (sliders, toggles, selects) with currentSettings.
   * Broken into section helpers to stay under 25 lines each.
   */
  updateUI() {
    this._syncAudioSliders();
    this._syncGraphicsToggles();
    this._syncThemeSelects();
    this._syncAccessibilityToggles();
    this._syncControlsToggles();
  }

  /** @private Sync audio volume sliders. */
  _syncAudioSliders() {
    [
      ['volume-master', this.currentSettings.audio.master],
      ['volume-music',  this.currentSettings.audio.music],
      ['volume-sfx',    this.currentSettings.audio.sfx]
    ].forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) { el.value = val; this.updateSlider(el); }
    });
  }

  /** @private Sync graphics section toggles and quality select. */
  _syncGraphicsToggles() {
    const g = this.currentSettings.graphics;
    const pairs = [
      ['particles-toggle',      g.particles],
      ['screen-shake-toggle',   g.screenShake],
      ['blood-toggle',          g.blood],
      ['custom-cursor-toggle',  g.customCursor   ?? true],
      ['magnet-pickup-toggle',  g.magnetPickup   ?? true],
      ['weather-effects-toggle',g.weatherEffects ?? false]
    ];
    pairs.forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.checked = val;
    });

    const qualityEl = document.getElementById('graphics-quality');
    if (qualityEl) qualityEl.value = g.quality;
  }

  /** @private Sync both theme selects to persisted theme. */
  _syncThemeSelects() {
    const theme = localStorage.getItem(this.THEME_KEY) || 'dark';
    ['ui-theme', 'ui-theme-interface'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = theme;
    });
  }

  /** @private Sync accessibility toggles. */
  _syncAccessibilityToggles() {
    const a = this.currentSettings.accessibility || {};
    [
      ['reduce-screen-shake-toggle', a.reduceScreenShake  ?? false],
      ['reduce-flash-toggle',        a.reduceFlashEffects ?? false],
      ['large-hud-toggle',           a.largeHudText       ?? false],
      ['zombie-outlines-toggle',     a.showZombieOutlines ?? false]
    ].forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.checked = val;
    });
  }

  /** @private Sync controls-section toggles. */
  _syncControlsToggles() {
    const el = document.getElementById('azerty-toggle');
    if (el) el.checked = this.currentSettings.controls?.azerty ?? false;
  }

  // ── Theme ────────────────────────────────────────────────────────────────

  /**
   * Switch the UI theme by toggling CSS classes on <html> and <body>.
   * Persists the choice to localStorage under {@link SettingsMenu#THEME_KEY}.
   * @param {'dark'|'neon'|'retro'} theme
   */
  applyTheme(theme) {
    const classes = ['theme-dark', 'theme-neon', 'theme-retro'];
    document.documentElement.classList.remove(...classes);
    document.body.classList.remove(...classes);
    document.documentElement.classList.add(`theme-${theme}`);
    document.body.classList.add(`theme-${theme}`);
    safeLocalStorageSet(this.THEME_KEY, theme);
  }

  // ── Skin palette ─────────────────────────────────────────────────────────

  /** @private Bind skin-colour palette buttons and restore saved selection. */
  _initSkinPalette() {
    const palette = document.getElementById('skin-color-palette');
    if (!palette) return;

    const saved = localStorage.getItem('pref_skin') || 'cyan';

    palette.querySelectorAll('.skin-color-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === saved);

      btn.addEventListener('click', () => {
        palette.querySelectorAll('.skin-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        safeLocalStorageSet('pref_skin', btn.dataset.color);
        const er = window.gameEngine?.renderer?.entityRenderer;
        if (er) er._playerBodyCache.clear();
      });
    });
  }
}

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
  window.gameSettingsMenu = new SettingsMenu();
}
