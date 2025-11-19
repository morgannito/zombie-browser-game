/**
 * PERFORMANCE SETTINGS SYSTEM
 * Manages performance modes and immersive UI for mobile
 * @version 1.0.0
 */

/* ============================================
   PERFORMANCE SETTINGS MANAGER
   ============================================ */

class PerformanceSettingsManager {
  constructor() {
    this.settings = {
      performanceMode: 'normal', // 'normal' or 'performance'
      resolutionScale: 1.0, // 1.0 = full resolution, 0.75 = 75%
      targetFPS: 60, // 60 or 30
      particlesEnabled: true,
      gridEnabled: true,
      shadowsEnabled: true,
      immersiveMode: false, // Hide non-essential UI
      minimapPosition: 'right', // 'right', 'left', 'hidden'
      fullscreenEnabled: false, // Fullscreen mode
      minimapSize: 'medium', // 'small', 'medium', 'large' (mobile only)
      minimapOpacity: 0.8 // 0.3 to 1.0
    };

    this.currentFPS = 60;
    this.frameCount = 0;
    this.lastFPSUpdate = Date.now();
    this.fpsHistory = [];
    this.autoAdjust = true;

    this.loadSettings();
    this.createUI();
    this.startFPSMonitoring();
  }

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    try {
      const saved = localStorage.getItem('zombieGamePerformanceSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = { ...this.settings, ...parsed };
        this.applySettings();
      }
    } catch (e) {
      console.warn('Failed to load performance settings:', e);
    }
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    try {
      localStorage.setItem('zombieGamePerformanceSettings', JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save performance settings:', e);
    }
  }

  /**
   * Create the settings UI
   */
  createUI() {
    // Settings button (gear icon)
    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'settings-btn';
    settingsBtn.innerHTML = '⚙️';
    settingsBtn.title = 'Paramètres';
    settingsBtn.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 1001;
      background: rgba(0, 0, 0, 0.8);
      border: 2px solid #00ff00;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      font-size: 24px;
      cursor: pointer;
      transition: all 0.3s ease;
      backdrop-filter: blur(5px);
    `;

    (window.eventListenerManager ? window.eventListenerManager.add(settingsBtn, 'mouseenter', () : (window.eventListenerManager ? window.eventListenerManager.add(settingsBtn, 'mouseenter', ()) : settingsBtn.addEventListener('mouseenter', ())) => {
      settingsBtn.style.transform = 'scale(1.1) rotate(90deg)';
      settingsBtn.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.5)';
    });

    (window.eventListenerManager ? window.eventListenerManager.add(settingsBtn, 'mouseleave', () : (window.eventListenerManager ? window.eventListenerManager.add(settingsBtn, 'mouseleave', ()) : settingsBtn.addEventListener('mouseleave', ())) => {
      settingsBtn.style.transform = 'scale(1) rotate(0deg)';
      settingsBtn.style.boxShadow = 'none';
    });

    (window.eventListenerManager ? window.eventListenerManager.add(settingsBtn, 'click', () => this.toggleSettingsPanel()) : (window.eventListenerManager ? window.eventListenerManager.add(settingsBtn, 'click', () => this.toggleSettingsPanel())) : settingsBtn.addEventListener('click', () => this.toggleSettingsPanel())));

    document.body.appendChild(settingsBtn);

    // Settings panel
    this.createSettingsPanel();

    // FPS counter
    this.createFPSCounter();

    // Immersive mode toggle button (for mobile)
    this.createImmersiveModeButton();

    // Fullscreen toggle button
    this.createFullscreenButton();

    // Minimap toggle button (for mobile)
    this.createMinimapToggleButton();

    // Listen for fullscreen changes (e.g., when user presses ESC)
    this.setupFullscreenListeners();
  }

  /**
   * Create the settings panel
   */
  createSettingsPanel() {
    const panel = document.createElement('div');
    panel.id = 'performance-settings-panel';
    panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1002;
      background: rgba(10, 10, 30, 0.98);
      border: 3px solid #00ff00;
      border-radius: 15px;
      padding: 20px;
      width: min(90%, 400px);
      max-height: 80vh;
      overflow-y: auto;
      display: none;
      backdrop-filter: blur(10px);
      box-shadow: 0 0 30px rgba(0, 255, 0, 0.5);
    `;

    panel.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #00ff00; margin: 0 0 10px 0; font-size: 24px;">⚙️ PARAMÈTRES</h2>
        <div id="fps-display-panel" style="color: #ffd700; font-size: 14px; margin-bottom: 10px;">
          FPS: <span id="current-fps">60</span> | Moyenne: <span id="avg-fps">60</span>
        </div>
      </div>

      <div class="settings-section">
        <h3 style="color: #ffd700; font-size: 18px; margin-bottom: 15px;">🚀 Mode Performance</h3>

        <div class="setting-item">
          <label style="color: #fff; display: block; margin-bottom: 5px;">
            <input type="radio" name="perfMode" value="normal" ${this.settings.performanceMode === 'normal' ? 'checked' : ''}>
            Mode Normal (Qualité maximale)
          </label>
          <label style="color: #fff; display: block; margin-bottom: 10px;">
            <input type="radio" name="perfMode" value="performance" ${this.settings.performanceMode === 'performance' ? 'checked' : ''}>
            Mode Performance (Optimisé pour appareils bas de gamme)
          </label>
        </div>

        <div class="setting-item" style="margin-top: 15px;">
          <label style="color: #fff; display: block; margin-bottom: 5px;">
            Résolution: <span id="resolution-value">${Math.round(this.settings.resolutionScale * 100)}%</span>
          </label>
          <input type="range" id="resolution-slider" min="50" max="100" value="${this.settings.resolutionScale * 100}"
                 style="width: 100%;">
          <p style="color: #aaa; font-size: 12px; margin: 5px 0 0 0;">
            Réduire la résolution améliore les performances
          </p>
        </div>

        <div class="setting-item" style="margin-top: 15px;">
          <label style="color: #fff; display: block; margin-bottom: 5px;">
            FPS Cible:
          </label>
          <label style="color: #fff; display: block;">
            <input type="radio" name="targetFPS" value="60" ${this.settings.targetFPS === 60 ? 'checked' : ''}>
            60 FPS (Fluide)
          </label>
          <label style="color: #fff; display: block; margin-bottom: 10px;">
            <input type="radio" name="targetFPS" value="30" ${this.settings.targetFPS === 30 ? 'checked' : ''}>
            30 FPS (Économie d'énergie)
          </label>
        </div>

        <div class="setting-item" style="margin-top: 15px;">
          <label style="color: #fff; display: block; margin-bottom: 10px;">
            <input type="checkbox" id="auto-adjust-checkbox" ${this.autoAdjust ? 'checked' : ''}>
            Ajustement automatique des performances
          </label>
          <p style="color: #aaa; font-size: 12px; margin: 0;">
            Ajuste automatiquement la qualité si les FPS chutent
          </p>
        </div>
      </div>

      <div class="settings-section" style="margin-top: 20px;">
        <h3 style="color: #ffd700; font-size: 18px; margin-bottom: 15px;">🖥️ Affichage</h3>

        <div class="setting-item">
          <label style="color: #fff; display: block; margin-bottom: 10px;">
            <input type="checkbox" id="fullscreen-checkbox" ${this.settings.fullscreenEnabled ? 'checked' : ''}>
            Mode Plein Écran
          </label>
          <p style="color: #aaa; font-size: 12px; margin: 0 0 15px 0;">
            Lance le jeu en plein écran pour une meilleure immersion
          </p>
        </div>

        <div class="setting-item">
          <label style="color: #fff; display: block; margin-bottom: 10px;">
            <input type="checkbox" id="immersive-mode-checkbox" ${this.settings.immersiveMode ? 'checked' : ''}>
            Mode Immersif (Masquer UI non-essentielle)
          </label>
        </div>

        <div class="setting-item" style="margin-top: 15px;">
          <label style="color: #fff; display: block; margin-bottom: 5px;">
            Position de la Minimap:
          </label>
          <select id="minimap-position-select" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.5); color: #fff; border: 2px solid #00ff00; border-radius: 5px;">
            <option value="right" ${this.settings.minimapPosition === 'right' ? 'selected' : ''}>Droite</option>
            <option value="left" ${this.settings.minimapPosition === 'left' ? 'selected' : ''}>Gauche</option>
            <option value="hidden" ${this.settings.minimapPosition === 'hidden' ? 'selected' : ''}>Masquée</option>
          </select>
        </div>

        <div class="setting-item" style="margin-top: 15px;">
          <label style="color: #fff; display: block; margin-bottom: 5px;">
            Taille Minimap (Mobile):
          </label>
          <select id="minimap-size-select" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.5); color: #fff; border: 2px solid #00ff00; border-radius: 5px;">
            <option value="small" ${this.settings.minimapSize === 'small' ? 'selected' : ''}>Petite (50px)</option>
            <option value="medium" ${this.settings.minimapSize === 'medium' ? 'selected' : ''}>Moyenne (80px)</option>
            <option value="large" ${this.settings.minimapSize === 'large' ? 'selected' : ''}>Grande (120px)</option>
          </select>
        </div>

        <div class="setting-item" style="margin-top: 15px;">
          <label style="color: #fff; display: block; margin-bottom: 5px;">
            Opacité Minimap: <span id="minimap-opacity-value">${Math.round(this.settings.minimapOpacity * 100)}%</span>
          </label>
          <input type="range" id="minimap-opacity-slider" min="30" max="100" value="${this.settings.minimapOpacity * 100}"
                 style="width: 100%;">
          <p style="color: #aaa; font-size: 12px; margin: 5px 0 0 0;">
            Ajustez la transparence de la minimap
          </p>
        </div>
      </div>

      <div class="settings-section" style="margin-top: 20px;">
        <h3 style="color: #ffd700; font-size: 18px; margin-bottom: 15px;">🎨 Effets Visuels</h3>

        <div class="setting-item">
          <label style="color: #fff; display: block; margin-bottom: 10px;">
            <input type="checkbox" id="particles-checkbox" ${this.settings.particlesEnabled ? 'checked' : ''}>
            Particules
          </label>
          <label style="color: #fff; display: block; margin-bottom: 10px;">
            <input type="checkbox" id="grid-checkbox" ${this.settings.gridEnabled ? 'checked' : ''}>
            Grille
          </label>
        </div>
      </div>

      <div style="margin-top: 20px; text-align: center;">
        <button id="apply-settings-btn" style="
          background: linear-gradient(135deg, #00ff00, #00cc00);
          color: #000;
          border: none;
          padding: 12px 30px;
          font-size: 16px;
          font-weight: bold;
          border-radius: 8px;
          cursor: pointer;
          margin-right: 10px;
          transition: all 0.3s ease;
        ">Appliquer</button>
        <button id="close-settings-btn" style="
          background: rgba(100, 100, 100, 0.8);
          color: #fff;
          border: none;
          padding: 12px 30px;
          font-size: 16px;
          font-weight: bold;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
        ">Fermer</button>
      </div>
    `;

    document.body.appendChild(panel);

    // Event listeners
    document.getElementById('apply-settings-btn').addEventListener('click', () => {
      this.updateSettingsFromUI();
      this.applySettings();
      this.saveSettings();
      this.hideSettingsPanel();
    });

    document.getElementById('close-settings-btn').addEventListener('click', () => {
      this.hideSettingsPanel();
    });

    // Real-time resolution slider update
    document.getElementById('resolution-slider').addEventListener('input', (e) => {
      document.getElementById('resolution-value').textContent = e.target.value + '%';
    });

    // Real-time minimap opacity slider update
    document.getElementById('minimap-opacity-slider').addEventListener('input', (e) => {
      document.getElementById('minimap-opacity-value').textContent = e.target.value + '%';
    });

    // Performance mode presets
    document.querySelectorAll('input[name="perfMode"]').forEach(radio => {
      (window.eventListenerManager ? window.eventListenerManager.add(radio, 'change', (e) : (window.eventListenerManager ? window.eventListenerManager.add(radio, 'change', (e)) : radio.addEventListener('change', (e))) => {
        if (e.target.value === 'performance') {
          document.getElementById('resolution-slider').value = 75;
          document.getElementById('resolution-value').textContent = '75%';
          document.querySelector('input[name="targetFPS"][value="30"]').checked = true;
          document.getElementById('particles-checkbox').checked = false;
          document.getElementById('grid-checkbox').checked = false;
        } else {
          document.getElementById('resolution-slider').value = 100;
          document.getElementById('resolution-value').textContent = '100%';
          document.querySelector('input[name="targetFPS"][value="60"]').checked = true;
          document.getElementById('particles-checkbox').checked = true;
          document.getElementById('grid-checkbox').checked = true;
        }
      });
    });
  }

  /**
   * Create FPS counter
   */
  createFPSCounter() {
    const counter = document.createElement('div');
    counter.id = 'fps-counter';
    counter.style.cssText = `
      position: fixed;
      top: 70px;
      right: 10px;
      z-index: 1001;
      background: rgba(0, 0, 0, 0.8);
      border: 2px solid #ffd700;
      border-radius: 8px;
      padding: 8px 12px;
      color: #ffd700;
      font-family: monospace;
      font-size: 14px;
      font-weight: bold;
      backdrop-filter: blur(5px);
      display: none;
    `;
    counter.innerHTML = 'FPS: <span id="fps-value">60</span>';
    document.body.appendChild(counter);
  }

  /**
   * Create immersive mode toggle button (mobile)
   */
  createImmersiveModeButton() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return;

    const btn = document.createElement('button');
    btn.id = 'immersive-mode-btn';
    btn.innerHTML = '🎬';
    btn.title = 'Mode Immersif';
    btn.style.cssText = `
      position: fixed;
      top: 70px;
      right: 10px;
      z-index: 1001;
      background: rgba(0, 0, 0, 0.8);
      border: 2px solid #00ffff;
      border-radius: 50%;
      width: 45px;
      height: 45px;
      font-size: 20px;
      cursor: pointer;
      transition: all 0.3s ease;
      backdrop-filter: blur(5px);
    `;

    (window.eventListenerManager ? window.eventListenerManager.add(btn, 'click', () : (window.eventListenerManager ? window.eventListenerManager.add(btn, 'click', ()) : btn.addEventListener('click', ())) => {
      this.settings.immersiveMode = !this.settings.immersiveMode;
      this.applyImmersiveMode();
      this.saveSettings();

      btn.style.background = this.settings.immersiveMode ?
        'rgba(0, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.8)';
      btn.style.borderColor = this.settings.immersiveMode ? '#00ffff' : '#00ffff';
    });

    document.body.appendChild(btn);

    // Apply initial state
    if (this.settings.immersiveMode) {
      btn.style.background = 'rgba(0, 255, 255, 0.3)';
      this.applyImmersiveMode();
    }
  }

  /**
   * Create fullscreen toggle button
   */
  createFullscreenButton() {
    const btn = document.createElement('button');
    btn.id = 'fullscreen-btn';
    btn.innerHTML = '⛶';
    btn.title = 'Basculer en plein écran (F11)';
    btn.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      z-index: 1001;
      background: rgba(0, 0, 0, 0.8);
      border: 2px solid #ff6b00;
      border-radius: 8px;
      width: 45px;
      height: 45px;
      font-size: 22px;
      cursor: pointer;
      transition: all 0.3s ease;
      backdrop-filter: blur(5px);
    `;

    (window.eventListenerManager ? window.eventListenerManager.add(btn, 'mouseenter', () : (window.eventListenerManager ? window.eventListenerManager.add(btn, 'mouseenter', ()) : btn.addEventListener('mouseenter', ())) => {
      btn.style.transform = 'scale(1.1)';
      btn.style.boxShadow = '0 0 20px rgba(255, 107, 0, 0.5)';
    });

    (window.eventListenerManager ? window.eventListenerManager.add(btn, 'mouseleave', () : (window.eventListenerManager ? window.eventListenerManager.add(btn, 'mouseleave', ()) : btn.addEventListener('mouseleave', ())) => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = 'none';
    });

    (window.eventListenerManager ? window.eventListenerManager.add(btn, 'click', () : (window.eventListenerManager ? window.eventListenerManager.add(btn, 'click', ()) : btn.addEventListener('click', ())) => {
      this.toggleFullscreen();
      this.updateFullscreenButton();
    });

    document.body.appendChild(btn);

    // Apply initial state
    this.updateFullscreenButton();
  }

  /**
   * Update fullscreen button appearance
   */
  updateFullscreenButton() {
    const btn = document.getElementById('fullscreen-btn');
    if (!btn) return;

    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;

    if (isFullscreen) {
      btn.innerHTML = '⛶';
      btn.title = 'Quitter le plein écran (ESC)';
      btn.style.background = 'rgba(255, 107, 0, 0.3)';
      btn.style.borderColor = '#ff6b00';
    } else {
      btn.innerHTML = '⛶';
      btn.title = 'Basculer en plein écran';
      btn.style.background = 'rgba(0, 0, 0, 0.8)';
      btn.style.borderColor = '#ff6b00';
    }
  }

  /**
   * Create minimap toggle button (mobile)
   */
  createMinimapToggleButton() {
    const isMobile = this.isMobile();
    if (!isMobile) return;

    const btn = document.createElement('button');
    btn.id = 'minimap-toggle-btn';
    btn.innerHTML = '🗺️';
    btn.title = 'Afficher/Masquer la Minimap';
    btn.style.cssText = `
      position: fixed;
      bottom: 70px;
      right: 10px;
      z-index: 1001;
      background: rgba(0, 0, 0, 0.8);
      border: 2px solid #00ccff;
      border-radius: 8px;
      width: 45px;
      height: 45px;
      font-size: 20px;
      cursor: pointer;
      transition: all 0.3s ease;
      backdrop-filter: blur(5px);
    `;

    (window.eventListenerManager ? window.eventListenerManager.add(btn, 'click', () : (window.eventListenerManager ? window.eventListenerManager.add(btn, 'click', ()) : btn.addEventListener('click', ())) => {
      // Toggle between hidden and last known position
      if (this.settings.minimapPosition === 'hidden') {
        this.settings.minimapPosition = this.lastMinimapPosition || 'right';
      } else {
        this.lastMinimapPosition = this.settings.minimapPosition;
        this.settings.minimapPosition = 'hidden';
      }

      this.applyMinimapSettings();
      this.saveSettings();
      this.updateMinimapToggleButton();

      // Update select if panel is open
      const select = document.getElementById('minimap-position-select');
      if (select) {
        select.value = this.settings.minimapPosition;
      }
    });

    document.body.appendChild(btn);

    // Apply initial state
    this.updateMinimapToggleButton();
  }

  /**
   * Update minimap toggle button appearance
   */
  updateMinimapToggleButton() {
    const btn = document.getElementById('minimap-toggle-btn');
    if (!btn) return;

    const isHidden = this.settings.minimapPosition === 'hidden';

    if (isHidden) {
      btn.innerHTML = '🗺️';
      btn.title = 'Afficher la Minimap';
      btn.style.background = 'rgba(0, 0, 0, 0.8)';
      btn.style.borderColor = '#666';
      btn.style.opacity = '0.6';
    } else {
      btn.innerHTML = '🗺️';
      btn.title = 'Masquer la Minimap';
      btn.style.background = 'rgba(0, 204, 255, 0.3)';
      btn.style.borderColor = '#00ccff';
      btn.style.opacity = '1';
    }
  }

  /**
   * Setup fullscreen event listeners
   */
  setupFullscreenListeners() {
    // Handle fullscreen changes (e.g., when user presses ESC)
    const handleFullscreenChange = () => {
      const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);

      this.settings.fullscreenEnabled = isFullscreen;
      this.saveSettings();
      this.updateFullscreenButton();

      // Update checkbox if panel is open
      const checkbox = document.getElementById('fullscreen-checkbox');
      if (checkbox) {
        checkbox.checked = isFullscreen;
      }

      // Resize canvas when entering/exiting fullscreen
      if (window.gameEngine) {
        (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
          window.gameEngine.resizeCanvas();
        }, 100);
      }
    };

    (window.eventListenerManager ? window.eventListenerManager.add(document, 'fullscreenchange', handleFullscreenChange) : (window.eventListenerManager ? window.eventListenerManager.add(document, 'fullscreenchange', handleFullscreenChange)) : document.addEventListener('fullscreenchange', handleFullscreenChange)));
    (window.eventListenerManager ? window.eventListenerManager.add(document, 'webkitfullscreenchange', handleFullscreenChange) : (window.eventListenerManager ? window.eventListenerManager.add(document, 'webkitfullscreenchange', handleFullscreenChange)) : document.addEventListener('webkitfullscreenchange', handleFullscreenChange))); // Safari
  }

  /**
   * Toggle settings panel
   */
  toggleSettingsPanel() {
    const panel = document.getElementById('performance-settings-panel');
    if (panel.style.display === 'none') {
      panel.style.display = 'block';
      // Update FPS display
      document.getElementById('current-fps').textContent = Math.round(this.currentFPS);
      const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / Math.max(this.fpsHistory.length, 1);
      document.getElementById('avg-fps').textContent = Math.round(avgFPS);
    } else {
      panel.style.display = 'none';
    }
  }

  /**
   * Hide settings panel
   */
  hideSettingsPanel() {
    document.getElementById('performance-settings-panel').style.display = 'none';
  }

  /**
   * Update settings from UI
   */
  updateSettingsFromUI() {
    const perfMode = document.querySelector('input[name="perfMode"]:checked').value;
    const resolutionScale = parseInt(document.getElementById('resolution-slider').value) / 100;
    const targetFPS = parseInt(document.querySelector('input[name="targetFPS"]:checked').value);
    const particlesEnabled = document.getElementById('particles-checkbox').checked;
    const gridEnabled = document.getElementById('grid-checkbox').checked;
    const immersiveMode = document.getElementById('immersive-mode-checkbox').checked;
    const minimapPosition = document.getElementById('minimap-position-select').value;
    const autoAdjust = document.getElementById('auto-adjust-checkbox').checked;
    const fullscreenEnabled = document.getElementById('fullscreen-checkbox').checked;
    const minimapSize = document.getElementById('minimap-size-select').value;
    const minimapOpacity = parseInt(document.getElementById('minimap-opacity-slider').value) / 100;

    this.settings = {
      performanceMode: perfMode,
      resolutionScale,
      targetFPS,
      particlesEnabled,
      gridEnabled,
      shadowsEnabled: this.settings.shadowsEnabled,
      immersiveMode,
      minimapPosition,
      fullscreenEnabled,
      minimapSize,
      minimapOpacity
    };

    this.autoAdjust = autoAdjust;
  }

  /**
   * Apply settings to the game
   */
  applySettings() {
    // Apply resolution scale
    this.applyResolutionScale();

    // Apply immersive mode
    this.applyImmersiveMode();

    // Apply minimap settings (position, size, opacity)
    this.applyMinimapSettings();

    // Apply fullscreen mode
    this.applyFullscreen();

    // Notify game of settings change
    if (window.gameEngine) {
      window.gameEngine.onPerformanceSettingsChanged(this.settings);
    }

    console.log('Performance settings applied:', this.settings);
  }

  /**
   * Apply resolution scale
   */
  applyResolutionScale() {
    if (!window.gameEngine) return;

    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;

    const basePixelRatio = window.devicePixelRatio || 1;
    const adjustedPixelRatio = basePixelRatio * this.settings.resolutionScale;

    // Set display size (CSS pixels)
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';

    // Set actual size in memory (scaled)
    canvas.width = window.innerWidth * adjustedPixelRatio;
    canvas.height = window.innerHeight * adjustedPixelRatio;

    console.log(`Resolution scale applied: ${this.settings.resolutionScale}x (${Math.round(adjustedPixelRatio * 100)}% of native)`);
  }

  /**
   * Apply immersive mode
   */
  applyImmersiveMode() {
    const stats = document.getElementById('stats');
    const instructions = document.getElementById('instructions');

    if (this.settings.immersiveMode) {
      // Hide non-essential UI in landscape mode on mobile
      const isLandscape = window.innerWidth > window.innerHeight;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isLandscape && isMobile) {
        if (stats) stats.style.opacity = '0.3';
        if (instructions) instructions.style.display = 'none';
      }
    } else {
      // Show all UI
      if (stats) stats.style.opacity = '1';
      if (instructions && !this.isMobile()) instructions.style.display = 'block';
    }
  }

  /**
   * Apply minimap settings (position, size, opacity)
   */
  applyMinimapSettings() {
    const minimap = document.getElementById('minimap');
    if (!minimap) return;

    minimap.style.transition = 'all 0.3s ease';

    // Position
    if (this.settings.minimapPosition === 'hidden') {
      minimap.style.display = 'none';
      return; // No need to apply other settings if hidden
    } else {
      minimap.style.display = 'block';

      if (this.settings.minimapPosition === 'left') {
        minimap.style.left = '0.5rem';
        minimap.style.right = 'auto';
      } else {
        minimap.style.right = '0.5rem';
        minimap.style.left = 'auto';
      }
    }

    // Opacity
    minimap.style.opacity = this.settings.minimapOpacity;

    // Size (only on mobile)
    const isMobile = this.isMobile();
    if (isMobile) {
      const sizeMap = {
        'small': '50px',
        'medium': '80px',
        'large': '120px'
      };
      const size = sizeMap[this.settings.minimapSize] || '80px';
      minimap.style.width = size;
      minimap.style.height = size;

      // Also update canvas dimensions
      if (window.gameEngine) {
        window.gameEngine.resizeMinimapCanvas();
      }
    }
  }

  /**
   * Apply minimap position (kept for backwards compatibility)
   */
  applyMinimapPosition() {
    this.applyMinimapSettings();
  }

  /**
   * Apply fullscreen mode
   */
  applyFullscreen() {
    if (this.settings.fullscreenEnabled) {
      this.enterFullscreen();
    } else {
      this.exitFullscreen();
    }
  }

  /**
   * Enter fullscreen mode
   */
  enterFullscreen() {
    const elem = document.documentElement;

    if (!document.fullscreenElement) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => {
          console.warn('Failed to enter fullscreen:', err);
          this.settings.fullscreenEnabled = false;
        });
      } else if (elem.webkitRequestFullscreen) { // Safari
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) { // IE11
        elem.msRequestFullscreen();
      } else {
        console.warn('Fullscreen API not supported');
        this.settings.fullscreenEnabled = false;
      }
    }
  }

  /**
   * Exit fullscreen mode
   */
  exitFullscreen() {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) { // Safari
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) { // IE11
        document.msExitFullscreen();
      }
    }
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen() {
    this.settings.fullscreenEnabled = !this.settings.fullscreenEnabled;
    this.applyFullscreen();
    this.saveSettings();

    // Update checkbox if panel is open
    const checkbox = document.getElementById('fullscreen-checkbox');
    if (checkbox) {
      checkbox.checked = this.settings.fullscreenEnabled;
    }
  }

  /**
   * Check if device is mobile
   */
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Start FPS monitoring
   */
  startFPSMonitoring() {
    this.autoAdjustCooldown = 0; // Cooldown to prevent spam adjustments

    (window.timerManager ? window.timerManager.setInterval : setInterval)(() => {
      this.updateFPS();

      // Auto-adjust if enabled and FPS is critically low
      // Only adjust every 5 seconds to avoid spam and allow changes to take effect
      const now = Date.now();
      if (this.autoAdjust && this.currentFPS < 20 && now - this.autoAdjustCooldown > 5000) {
        this.autoAdjustPerformance();
        this.autoAdjustCooldown = now;
      }
    }, 1000);
  }

  /**
   * Update FPS counter
   */
  updateFPS() {
    const now = Date.now();
    const delta = now - this.lastFPSUpdate;

    if (delta >= 1000) {
      this.currentFPS = this.frameCount;
      this.frameCount = 0;
      this.lastFPSUpdate = now;

      // Update FPS history
      this.fpsHistory.push(this.currentFPS);
      if (this.fpsHistory.length > 10) {
        this.fpsHistory.shift();
      }

      // Update FPS counter display
      const fpsValue = document.getElementById('fps-value');
      if (fpsValue) {
        fpsValue.textContent = this.currentFPS;

        // Color based on FPS
        const counter = document.getElementById('fps-counter');
        if (this.currentFPS < 30) {
          counter.style.borderColor = '#ff0000';
          fpsValue.style.color = '#ff0000';
        } else if (this.currentFPS < 50) {
          counter.style.borderColor = '#ffaa00';
          fpsValue.style.color = '#ffaa00';
        } else {
          counter.style.borderColor = '#ffd700';
          fpsValue.style.color = '#ffd700';
        }
      }
    }
  }

  /**
   * Auto-adjust performance
   */
  autoAdjustPerformance() {
    console.warn(`Low FPS detected (${this.currentFPS} FPS), auto-adjusting performance...`);

    let adjusted = false;

    // Step 1: Disable particles first (least visual impact)
    if (this.settings.particlesEnabled) {
      this.settings.particlesEnabled = false;
      adjusted = true;
      console.log('→ Disabled particles');
    }
    // Step 2: Disable grid
    else if (this.settings.gridEnabled) {
      this.settings.gridEnabled = false;
      adjusted = true;
      console.log('→ Disabled grid');
    }
    // Step 3: Reduce resolution gradually
    else if (this.settings.resolutionScale > 0.5) {
      this.settings.resolutionScale = Math.max(0.5, this.settings.resolutionScale - 0.1);
      this.applyResolutionScale();
      adjusted = true;
      console.log(`→ Reduced resolution to ${Math.round(this.settings.resolutionScale * 100)}%`);
    }
    // Step 4: Lower target FPS as last resort
    else if (this.settings.targetFPS > 30) {
      this.settings.targetFPS = 30;
      adjusted = true;
      console.log('→ Lowered target FPS to 30');
    }

    if (adjusted) {
      this.saveSettings();
      // Notify game engine
      if (window.gameEngine) {
        window.gameEngine.onPerformanceSettingsChanged(this.settings);
      }
      console.log('Performance auto-adjusted successfully');
    } else {
      console.log('All performance settings already at minimum');
    }
  }

  /**
   * Notify frame rendered (for FPS counting)
   */
  onFrameRendered() {
    this.frameCount++;
  }

  /**
   * Get current settings
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Should render grid?
   */
  shouldRenderGrid() {
    return this.settings.gridEnabled;
  }

  /**
   * Should render particles?
   */
  shouldRenderParticles() {
    return this.settings.particlesEnabled;
  }

  /**
   * Get target frame time (ms)
   */
  getTargetFrameTime() {
    return 1000 / this.settings.targetFPS;
  }

  /**
   * Get resolution scale
   */
  getResolutionScale() {
    return this.settings.resolutionScale;
  }
}

// Export for global use
if (typeof window !== 'undefined') {
  window.PerformanceSettingsManager = PerformanceSettingsManager;
}
