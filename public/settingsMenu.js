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
        blood: true
      }
    };

    this.currentSettings = this.loadSettings();
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
    }
  }

  updateSelect(select) {
    // Update settings object
    if (select.id === 'graphics-quality') {
      this.currentSettings.graphics.quality = select.value;
    }
  }

  apply() {
    this.saveSettings();
    this.applySettings();
    this.close();

    // Show confirmation toast (if ToastManager exists)
    if (typeof ToastManager !== 'undefined') {
      ToastManager.show('Paramètres sauvegardés', '✓', 'success');
    }
  }

  reset() {
    this.currentSettings = JSON.parse(JSON.stringify(this.defaultSettings));
    this.applySettings();
    this.updateUI();

    // Show confirmation toast
    if (typeof ToastManager !== 'undefined') {
      ToastManager.show('Paramètres réinitialisés', '🔄', 'info');
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
  }

  applySettings() {
    // Apply audio settings
    this.applyAudioSettings();

    // Apply graphics settings
    this.applyGraphicsSettings();

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
}

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
  window.gameSettingsMenu = new SettingsMenu();
}
