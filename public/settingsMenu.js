/**
 * Settings Menu Management
 * Handles settings UI, persistence, and application
 */

class SettingsMenu {
  constructor() {
    this.settingsKey = 'zombie-game-settings';
    this.defaultSettings = {
      audio: {
        master: 70,
        music: 50,
        sfx: 80
      },
      graphics: {
        quality: 'medium',
        particles: true,
        screenShake: true,
        blood: true,
        customCursor: true
      },
      controls: {
        azerty: false
      },
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

  init() {
    // Wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
    } else {
      this.setupEventListeners();
    }
  }

  setupEventListeners() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsMenu = document.getElementById('settings-menu');
    const settingsCloseBtn = document.getElementById('settings-close-btn');
    const settingsOverlay = document.querySelector('.settings-overlay');

    // Open settings
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.open());
    }

    // Close settings
    if (settingsCloseBtn) {
      settingsCloseBtn.addEventListener('click', () => this.close());
    }

    if (settingsOverlay) {
      settingsOverlay.addEventListener('click', () => this.close());
    }

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && settingsMenu && settingsMenu.style.display === 'block') {
        this.close();
      }
    });

    // Tab switching
    const tabs = document.querySelectorAll('.settings-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Slider updates
    const sliders = document.querySelectorAll('.slider');
    sliders.forEach(slider => {
      slider.addEventListener('input', (e) => this.updateSlider(e.target));
    });

    // Toggle switches
    const toggles = document.querySelectorAll('.toggle-switch input');
    toggles.forEach(toggle => {
      toggle.addEventListener('change', (e) => this.updateToggle(e.target));
    });

    // Select dropdowns
    const selects = document.querySelectorAll('.settings-select');
    selects.forEach(select => {
      select.addEventListener('change', (e) => this.updateSelect(e.target));
    });

    // Footer buttons
    const applyBtn = document.getElementById('settings-apply-btn');
    const resetBtn = document.getElementById('settings-reset-btn');

    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.apply());
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.reset());
    }

    // Show settings button when game starts
    this.showSettingsButton();

    // Load and apply saved settings
    this.applySettings();
  }

  showSettingsButton() {
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.style.display = 'flex';
    }
  }

  open() {
    const settingsMenu = document.getElementById('settings-menu');
    if (settingsMenu) {
      settingsMenu.style.display = 'block';
      const lastTab = localStorage.getItem('settings-last-tab') || 'audio';
      this.switchTab(lastTab);
    }
  }

  close() {
    const settingsMenu = document.getElementById('settings-menu');
    if (settingsMenu) {
      settingsMenu.style.display = 'none';
    }
  }

  switchTab(tabName) {
    // Update tab buttons
    const tabs = document.querySelectorAll('.settings-tab');
    tabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update tab content
    const contents = document.querySelectorAll('.settings-tab-content');
    contents.forEach(content => {
      if (content.id === `settings-${tabName}`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });

    // Persist last opened tab
    localStorage.setItem('settings-last-tab', tabName);
  }

  updateSlider(slider) {
    const valueDisplay = slider.parentElement.querySelector('.slider-value');
    if (valueDisplay) {
      valueDisplay.textContent = `${slider.value}%`;
    }

    // Update settings object
    if (slider.id === 'volume-master') {
      this.currentSettings.audio.master = parseInt(slider.value);
    } else if (slider.id === 'volume-music') {
      this.currentSettings.audio.music = parseInt(slider.value);
    } else if (slider.id === 'volume-sfx') {
      this.currentSettings.audio.sfx = parseInt(slider.value);
    }
  }

  updateToggle(toggle) {
    // Update settings object
    if (toggle.id === 'particles-toggle') {
      this.currentSettings.graphics.particles = toggle.checked;
    } else if (toggle.id === 'screen-shake-toggle') {
      this.currentSettings.graphics.screenShake = toggle.checked;
    } else if (toggle.id === 'blood-toggle') {
      this.currentSettings.graphics.blood = toggle.checked;
    } else if (toggle.id === 'custom-cursor-toggle') {
      this.currentSettings.graphics.customCursor = toggle.checked;
      if (window.CursorManager) window.CursorManager.setEnabled(toggle.checked);
    } else if (toggle.id === 'azerty-toggle') {
      if (!this.currentSettings.controls) this.currentSettings.controls = {};
      this.currentSettings.controls.azerty = toggle.checked;
    } else if (toggle.id === 'reduce-screen-shake-toggle') {
      if (!this.currentSettings.accessibility) this.currentSettings.accessibility = {};
      this.currentSettings.accessibility.reduceScreenShake = toggle.checked;
    } else if (toggle.id === 'reduce-flash-toggle') {
      if (!this.currentSettings.accessibility) this.currentSettings.accessibility = {};
      this.currentSettings.accessibility.reduceFlashEffects = toggle.checked;
    } else if (toggle.id === 'large-hud-toggle') {
      if (!this.currentSettings.accessibility) this.currentSettings.accessibility = {};
      this.currentSettings.accessibility.largeHudText = toggle.checked;
    } else if (toggle.id === 'zombie-outlines-toggle') {
      if (!this.currentSettings.accessibility) this.currentSettings.accessibility = {};
      this.currentSettings.accessibility.showZombieOutlines = toggle.checked;
    } else if (toggle.id === 'magnet-pickup-toggle') {
      if (!this.currentSettings.graphics) this.currentSettings.graphics = {};
      this.currentSettings.graphics.magnetPickup = toggle.checked;
    }
  }

  updateSelect(select) {
    // Update settings object
    if (select.id === 'graphics-quality') {
      this.currentSettings.graphics.quality = select.value;
    } else if (select.id === 'ui-theme' || select.id === 'ui-theme-interface') {
      this.applyTheme(select.value);
      // Sync both selects
      const other = document.getElementById(select.id === 'ui-theme' ? 'ui-theme-interface' : 'ui-theme');
      if (other) other.value = select.value;
    }
  }

  apply() {
    this.saveSettings();
    this.applySettings();
    this.close();

    // Show confirmation toast (if ToastManager exists)
    if (typeof ToastManager !== 'undefined') {
      ToastManager.show({ message: (typeof I18n !== 'undefined' ? I18n.t('settings.saved') : 'Paramètres sauvegardés'), type: '✓', duration: 'success' });
    }
  }

  reset() {
    this.currentSettings = JSON.parse(JSON.stringify(this.defaultSettings));
    this.applySettings();
    this.updateUI();

    // Reset tutorial overlay completion flag
    if (typeof TutorialOverlay !== 'undefined') {
      TutorialOverlay.reset();
    }

    // Show confirmation toast
    if (typeof ToastManager !== 'undefined') {
      ToastManager.show({ message: (typeof I18n !== 'undefined' ? I18n.t('settings.reset') : 'Paramètres réinitialisés'), type: '🔄', duration: 'info' });
    }
  }

  updateUI() {
    // Update audio sliders
    const masterSlider = document.getElementById('volume-master');
    const musicSlider = document.getElementById('volume-music');
    const sfxSlider = document.getElementById('volume-sfx');

    if (masterSlider) {
      masterSlider.value = this.currentSettings.audio.master;
      this.updateSlider(masterSlider);
    }

    if (musicSlider) {
      musicSlider.value = this.currentSettings.audio.music;
      this.updateSlider(musicSlider);
    }

    if (sfxSlider) {
      sfxSlider.value = this.currentSettings.audio.sfx;
      this.updateSlider(sfxSlider);
    }

    // Update graphics toggles
    const particlesToggle = document.getElementById('particles-toggle');
    const screenShakeToggle = document.getElementById('screen-shake-toggle');
    const bloodToggle = document.getElementById('blood-toggle');

    if (particlesToggle) {
      particlesToggle.checked = this.currentSettings.graphics.particles;
    }

    if (screenShakeToggle) {
      screenShakeToggle.checked = this.currentSettings.graphics.screenShake;
    }

    if (bloodToggle) {
      bloodToggle.checked = this.currentSettings.graphics.blood;
    }

    // Update graphics quality select
    const qualitySelect = document.getElementById('graphics-quality');
    if (qualitySelect) {
      qualitySelect.value = this.currentSettings.graphics.quality;
    }

    // Update theme selects
    const currentTheme = localStorage.getItem(this.THEME_KEY) || 'dark';
    const themeSelect = document.getElementById('ui-theme');
    if (themeSelect) themeSelect.value = currentTheme;
    const themeSelectIface = document.getElementById('ui-theme-interface');
    if (themeSelectIface) themeSelectIface.value = currentTheme;

    // Update custom cursor toggle
    const customCursorToggle = document.getElementById('custom-cursor-toggle');
    if (customCursorToggle) {
      customCursorToggle.checked = this.currentSettings.graphics.customCursor ?? true;
    }

    // Update magnet pickup toggle
    const magnetToggle = document.getElementById('magnet-pickup-toggle');
    if (magnetToggle) {
      magnetToggle.checked = this.currentSettings.graphics.magnetPickup ?? true;
    }

    // Update AZERTY toggle
    const azertyToggle = document.getElementById('azerty-toggle');
    if (azertyToggle) {
      azertyToggle.checked = this.currentSettings.controls?.azerty ?? false;
    }

    // Update accessibility toggles
    const a11y = this.currentSettings.accessibility || {};
    const reduceShakeToggle = document.getElementById('reduce-screen-shake-toggle');
    if (reduceShakeToggle) reduceShakeToggle.checked = a11y.reduceScreenShake ?? false;
    const reduceFlashToggle = document.getElementById('reduce-flash-toggle');
    if (reduceFlashToggle) reduceFlashToggle.checked = a11y.reduceFlashEffects ?? false;
    const largeHudToggle = document.getElementById('large-hud-toggle');
    if (largeHudToggle) largeHudToggle.checked = a11y.largeHudText ?? false;
    const zombieOutlinesToggle = document.getElementById('zombie-outlines-toggle');
    if (zombieOutlinesToggle) zombieOutlinesToggle.checked = a11y.showZombieOutlines ?? false;
  }

  applySettings() {
    // Apply audio settings
    this.applyAudioSettings();

    // Apply graphics settings
    this.applyGraphicsSettings();

    // Apply control settings (AZERTY flag for InputManager)
    const azerty = this.currentSettings.controls?.azerty ?? false;
    if (window.gameSettings) window.gameSettings.azerty = azerty;
    // Propagate to SettingsManager if present
    if (window.settingsManager) window.settingsManager.set('controls.azerty', azerty);

    // Propagate magnet pickup setting
    const magnetPickup = this.currentSettings.graphics?.magnetPickup ?? true;
    if (window.settingsManager) window.settingsManager.set('magnetPickup', magnetPickup);

    // Update UI to reflect settings
    this.updateUI();
  }

  applyAudioSettings() {
    // Note: Actual audio implementation would integrate with audioSystem.js
    // For now, we just store the settings
    const { master, music, sfx } = this.currentSettings.audio;

    // Apply to global audio system if it exists
    if (window.AudioSystem) {
      window.AudioSystem.setMasterVolume(master / 100);
      window.AudioSystem.setMusicVolume(music / 100);
      window.AudioSystem.setSFXVolume(sfx / 100);
    }
  }

  applyGraphicsSettings() {
    // Apply graphics quality
    const { quality, particles, screenShake, blood } = this.currentSettings.graphics;

    // Store in global settings for renderer access
    if (!window.gameSettings) {
      window.gameSettings = {};
    }

    window.gameSettings.graphicsQuality = quality;
    window.gameSettings.particlesEnabled = particles;
    window.gameSettings.screenShakeEnabled = screenShake;
    window.gameSettings.bloodEnabled = blood;

    // Accessibility settings
    const a11y = this.currentSettings.accessibility || {};
    window.gameSettings.reduceScreenShake = a11y.reduceScreenShake ?? false;
    window.gameSettings.reduceFlashEffects = a11y.reduceFlashEffects ?? false;
    window.gameSettings.showZombieOutlines = a11y.showZombieOutlines ?? false;

    // Large HUD text: toggle CSS class on #stats
    const statsEl = document.getElementById('stats');
    if (statsEl) {
      if (a11y.largeHudText) {
        statsEl.classList.add('hud-large-text');
      } else {
        statsEl.classList.remove('hud-large-text');
      }
    }

    const customCursor = this.currentSettings.graphics.customCursor ?? true;
    window.gameSettings.customCursor = customCursor;
    if (window.CursorManager) window.CursorManager.setEnabled(customCursor);

    // Apply quality presets
    switch (quality) {
    case 'low':
      window.gameSettings.maxParticles = 50;
      window.gameSettings.shadowQuality = 'off';
      break;
    case 'medium':
      window.gameSettings.maxParticles = 100;
      window.gameSettings.shadowQuality = 'low';
      break;
    case 'high':
      window.gameSettings.maxParticles = 200;
      window.gameSettings.shadowQuality = 'medium';
      break;
    case 'ultra':
      window.gameSettings.maxParticles = 500;
      window.gameSettings.shadowQuality = 'high';
      break;
    }
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem(this.settingsKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.warn('Failed to load settings:', err);
    }
    return JSON.parse(JSON.stringify(this.defaultSettings));
  }

  saveSettings() {
    try {
      localStorage.setItem(this.settingsKey, JSON.stringify(this.currentSettings));
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }

  getSettings() {
    return this.currentSettings;
  }

  applyTheme(theme) {
    const classes = ['theme-dark', 'theme-neon', 'theme-retro'];
    document.documentElement.classList.remove(...classes);
    document.body.classList.remove(...classes);
    document.documentElement.classList.add(`theme-${theme}`);
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem(this.THEME_KEY, theme);
  }
}

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
  window.gameSettingsMenu = new SettingsMenu();
}
