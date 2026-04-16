/**
 * GAME ENGINE
 * Main game loop and initialization
 * @module GameEngine
 * @author Claude Code
 * @version 2.0.0
 */

class GameEngine {
  constructor() {
    // Store handler references for cleanup
    this.handlers = {
      resize: () => this.resizeCanvas(),
      mousemove: null
    };

    this.animationFrameId = null; // Store requestAnimationFrame ID for cleanup
    this.lastFrameTime = 0; // For FPS limiting
    this.frameTimeAccumulator = 0; // For consistent frame timing

    // Desktop continuous auto-fire state
    this.lastAutoFireTime = 0;
    this.AUTO_FIRE_INTERVAL = 150; // Fire every 150ms continuously (adjustable)

    this.setupCanvas();
    this.initializeManagers();
    this.start();

    // Debug mode toggle (press F3) — was 'D' which conflicted with right-movement
    window.addEventListener('keydown', e => {
      if (e.key === 'F3' && !e.repeat) {
        if (!document.querySelector('input:focus')) {
          e.preventDefault();
          window.gameState.toggleDebug();
        }
      }
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => this.cleanup());
  }

  setupCanvas() {
    this.canvas = document.getElementById('gameCanvas');
    // willReadFrequently: false — we never call getImageData on the main canvas,
    // so the browser should keep it GPU-accelerated (avoids software fallback).
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });
    // Pixel-art sprites: disable bilinear interpolation for crisp rendering.
    this.ctx.imageSmoothingEnabled = false;
    this.minimapCanvas = document.getElementById('minimap');
    this.minimapCtx = this.minimapCanvas.getContext('2d', { willReadFrequently: false });

    // Resize canvas
    this.resizeCanvas();
    window.addEventListener('resize', this.handlers.resize);

    // Handle orientation changes on mobile
    window.addEventListener('orientationchange', this.handlers.resize);
  }

  resizeCanvas() {
    const basePixelRatio = window.devicePixelRatio || 1;

    // Apply performance settings resolution scale
    const resolutionScale = window.performanceSettings
      ? window.performanceSettings.getResolutionScale()
      : 1.0;

    const pixelRatio = basePixelRatio * resolutionScale;

    // Set display size (CSS pixels)
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';

    // Set actual size in memory (scaled for Retina/high-DPI displays + performance)
    this.canvas.width = window.innerWidth * pixelRatio;
    this.canvas.height = window.innerHeight * pixelRatio;

    // Re-apply after resize (canvas resize resets all context state)
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
    }

    // Note: Pixel ratio scaling is applied in the render() method to avoid accumulation

    // Also resize minimap canvas
    this.resizeMinimapCanvas();
  }

  resizeMinimapCanvas() {
    if (!this.renderer || !this.renderer.minimapCanvas) {
      return;
    }

    const basePixelRatio = window.devicePixelRatio || 1;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    let minimapSize = 200; // Default desktop size

    // Apply mobile size settings
    if (isMobile && window.performanceSettings) {
      const settings = window.performanceSettings.getSettings();
      const sizeMap = {
        small: 50,
        medium: 80,
        large: 120
      };
      minimapSize = sizeMap[settings.minimapSize] || 80;
    }

    // Set canvas internal dimensions with pixel ratio
    this.renderer.minimapCanvas.width = minimapSize * basePixelRatio;
    this.renderer.minimapCanvas.height = minimapSize * basePixelRatio;
    // Minimap scaling is handled in renderMinimap()
  }

  initializeManagers() {
    // Global game state
    window.gameState = new GameStateManager();

    // Session manager for reconnection handling
    window.sessionManager = new SessionManager();

    // Performance settings (must be initialized early)
    if (typeof PerformanceSettingsManager !== 'undefined') {
      window.performanceSettings = new PerformanceSettingsManager();
    }

    // Make engine accessible globally
    window.gameEngine = this;

    // Managers
    window.inputManager = new InputManager();
    this.camera = new CameraManager(); // Store camera reference for external access
    const camera = this.camera; // Keep local reference for compatibility

    // Socket.IO client configuration optimized for low latency and stability
    // Try WebSocket first but allow polling fallback for reliability
    // Include sessionId for reconnection recovery

    // Use msgpack binary parser when server has enabled it (40-60% smaller packets).
    // window.__msgpackEnabled is set by the inline loader in index.html when the
    // server injects <meta name="msgpack" content="1"> (ENABLE_MSGPACK=true).
    const parserOption =
      window.__msgpackEnabled && window.msgpackParser ? { parser: window.msgpackParser } : {};

    const socket = io(Object.assign({
      transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
      upgrade: true, // Allow upgrade to WebSocket from polling (important for stability)
      autoConnect: false, // Connect after auth/session is ready
      reconnection: true,
      reconnectionDelay: 500, // Faster initial reconnection
      reconnectionDelayMax: 3000, // Reduced max delay
      reconnectionAttempts: 10, // More attempts with shorter delays
      timeout: 30000, // 30s timeout (balance between speed and stability)
      auth: {
        sessionId: window.sessionManager.getSessionId(),
        token: window.authManager ? window.authManager.getToken() : null
      },
      // Enable ping/pong for latency monitoring
      pingInterval: 10000, // Check connection every 10s
      pingTimeout: 5000, // Wait 5s for pong response
      rememberUpgrade: true, // Remember successful WebSocket upgrade
      forceNew: false // Reuse existing connection when possible
    }, parserOption));

    // Fallback: if msgpack parser causes a handshake error, reconnect without it.
    if (parserOption.parser) {
      socket.once('connect_error', function (err) {
        if (!socket.connected) {
          console.warn('[msgpack] parser handshake failed, falling back to JSON:', err.message);
          window.__msgpackEnabled = false;
          socket.io.opts.parser = undefined;
          socket.connect();
        }
      });
    }

    window.socket = socket;
    window.networkManager = new NetworkManager(socket);
    window.gameUI = new UIManager(window.gameState);

    // Initialize account progression manager (meta progression, skills, XP)
    if (typeof AccountProgressionManager !== 'undefined') {
      window.accountProgressionManager = new AccountProgressionManager();
      window.accountProgressionManager.init(socket);
      console.log('✓ Account progression manager initialized');
    } else {
      console.warn('⚠ AccountProgressionManager not found');
    }

    // Initialize advanced audio system (with music, enhanced sound effects)
    if (typeof AdvancedAudioManager !== 'undefined') {
      window.audioManager = new AdvancedAudioManager();
      window.advancedAudio = window.audioManager; // Alias for compatibility
      console.log('✓ Advanced audio system initialized');
    } else {
      window.audioManager = new AudioManager(); // Fallback
      console.warn('⚠ Using fallback audio - AdvancedAudioManager not found');
    }

    window.comboSystem = new ComboSystem(); // Système de combos
    window.leaderboardSystem = new LeaderboardSystem(); // Système de classement
    window.toastManager = new ToastManager(); // Système de notifications
    window.screenEffects = new ScreenEffectsManager(this.canvas); // Screen effects (flash, shake, slowmo, trails)

    // Environment systems (decoration, background)
    if (typeof ParallaxBackground !== 'undefined') {
      this.parallaxBackground = new ParallaxBackground();
      console.log('✓ Parallax background system initialized');

      // Initialize with default map size
      this.parallaxBackground.init(3000, 2400);

      // Populate gameState with parallax data
      window.gameState.state.parallax = this.parallaxBackground;
    } else {
      console.warn('⚠ ParallaxBackground not found');
    }

    if (typeof StaticPropsSystem !== 'undefined') {
      this.staticPropsSystem = new StaticPropsSystem();
      console.log('✓ Static props system initialized');

      // Spawn props on default map
      this.staticPropsSystem.spawnProps(3000, 2400, 0.8);

      // Populate gameState with props data
      window.gameState.state.staticProps = this.staticPropsSystem.getProps();
    } else {
      console.warn('⚠ StaticPropsSystem not found');
    }

    if (typeof DynamicPropsSystem !== 'undefined') {
      this.dynamicPropsSystem = new DynamicPropsSystem();
      console.log('✓ Dynamic props system initialized');

      // Spawn dynamic props
      this.dynamicPropsSystem.spawnProps(3000, 2400, 0.3);

      // Populate gameState with dynamic props
      window.gameState.state.dynamicProps = this.dynamicPropsSystem.getProps();
      window.gameState.state.dynamicPropParticles = [];
    } else {
      console.warn('⚠ DynamicPropsSystem not found');
    }

    // Mobile controls
    this.mobileControls = new MobileControlsManager();
    window.mobileControls = this.mobileControls; // Make globally accessible
    window.inputManager.setMobileControls(this.mobileControls);
    window.playerController = this.playerController = new PlayerController(
      window.inputManager,
      window.networkManager,
      window.gameState,
      camera
    );

    this.renderer = new Renderer(this.canvas, this.ctx, this.minimapCanvas, this.minimapCtx);
    this.renderer.setCamera(camera);

    this.nicknameManager = new NicknameManager(this.playerController);

    // Mouse events (only if not mobile)
    if (!this.mobileControls.isMobile) {
      this.handlers.mousemove = e => {
        window.inputManager.updateMouse(e.clientX, e.clientY);
      };

      this.canvas.addEventListener('mousemove', this.handlers.mousemove);
    }
  }

  update(deltaTime = 16) {
    // Clean up orphaned entities (every 60 frames ≈ 1 second at 60 FPS)
    if (!this._cleanupFrameCounter) {
      this._cleanupFrameCounter = 0;
    }
    if (++this._cleanupFrameCounter >= 60) {
      window.gameState.cleanupOrphanedEntities();
      this._cleanupFrameCounter = 0;
    }

    // CLIENT-SIDE PREDICTION: Update predicted bullets and reconcile with server
    if (window.gameState.updatePredictedBullets) {
      window.gameState.updatePredictedBullets();
    }
    if (window.gameState.reconcilePredictedBullets) {
      window.gameState.reconcilePredictedBullets();
    }

    // Update screen effects (trails decay, etc.) (SCREEN EFFECTS)
    if (window.screenEffects) {
      window.screenEffects.update(deltaTime);
    }

    // Update dynamic props (particles, animations)
    if (this.dynamicPropsSystem) {
      this.dynamicPropsSystem.update(deltaTime);
      window.gameState.state.dynamicPropParticles = this.dynamicPropsSystem.getParticles();
    }

    // Update mobile auto-shoot (MOBILE)
    if (this.mobileControls && this.mobileControls.updateAutoShoot) {
      this.mobileControls.updateAutoShoot(performance.now());
    }

    // Update desktop continuous auto-fire (DESKTOP)
    if (!this.mobileControls.isMobile) {
      const currentTime = performance.now();
      if (currentTime - this.lastAutoFireTime >= this.AUTO_FIRE_INTERVAL) {
        this.playerController.shoot(window.innerWidth, window.innerHeight);
        this.lastAutoFireTime = currentTime;
        if (this.renderer && this.renderer.onShoot) {
          this.renderer.onShoot();
        }
      }
    }

    // Note: playerController.update() is called unconditionally each RAF frame
    // in gameLoop() for 60fps local prediction — do not duplicate here.
  }

  render(deltaTime = 16) {
    const _t0 = performance.now();

    // Apply visual interpolation for smooth movement BEFORE rendering
    window.gameState.applyInterpolation();
    const _tInterp = performance.now();

    // Update debug stats if debug mode is enabled
    if (window.gameState.debugMode) {
      window.gameState.updateDebugStats();
    }

    this.renderer.render(window.gameState, window.gameState.playerId, deltaTime);
    const _tRender = performance.now();

    // Render debug overlay if enabled
    if (window.gameState.debugMode) {
      this.renderDebugOverlay();
    }

    // PROFILING — bucketize render timings, flush every 5s
    if (!this._renderPerf) {
      this._renderPerf = {
        interp: { sum: 0, count: 0, max: 0 },
        renderer: { sum: 0, count: 0, max: 0 },
        total: { sum: 0, count: 0, max: 0 },
        last: performance.now()
      };
    }
    const p = this._renderPerf;
    const interp = _tInterp - _t0;
    const renderer = _tRender - _tInterp;
    const total = performance.now() - _t0;
    p.interp.sum += interp;
    p.interp.count++;
    if (interp > p.interp.max) {
      p.interp.max = interp;
    }
    p.renderer.sum += renderer;
    p.renderer.count++;
    if (renderer > p.renderer.max) {
      p.renderer.max = renderer;
    }
    p.total.sum += total;
    p.total.count++;
    if (total > p.total.max) {
      p.total.max = total;
    }

    if (performance.now() - p.last >= 5000) {
      // Object.keys only at flush time, not per frame
      let zCount = 0;
      const zombies = window.gameState && window.gameState.state && window.gameState.state.zombies;
      if (zombies) {
        for (const _k in zombies) {
          zCount++;
        }
      }
      const rows = {};
      for (const [k, v] of Object.entries(p)) {
        if (k === 'last' || v.count === 0) {
          continue;
        }
        rows[k] = {
          avg_ms: +(v.sum / v.count).toFixed(2),
          max_ms: +v.max.toFixed(2),
          samples: v.count
        };
        v.sum = 0;
        v.count = 0;
        v.max = 0;
      }

      console.group(`[perf] render (5s, zombies=${zCount})`);

      console.table(rows);

      console.groupEnd();
      p.last = performance.now();
    }
  }

  renderDebugOverlay() {
    const ctx = this.ctx;
    const stats = window.gameState.debugStats;
    const pixelRatio = window.devicePixelRatio || 1;

    ctx.save();
    ctx.scale(pixelRatio, pixelRatio);

    // Semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 250, 200);

    // Text styling
    ctx.fillStyle = '#00ff00';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';

    let y = 30;
    const lineHeight = 20;

    // Title
    ctx.fillStyle = '#ffff00';
    ctx.fillText('DEBUG MODE (F3 to toggle)', 20, y);
    y += lineHeight * 1.5;

    // Entity counts
    ctx.fillStyle = '#00ff00';
    ctx.fillText(`Players: ${stats.entitiesCount.players || 0}`, 20, y);
    y += lineHeight;
    ctx.fillText(`Zombies: ${stats.entitiesCount.zombies || 0}`, 20, y);
    y += lineHeight;
    ctx.fillText(`Bullets: ${stats.entitiesCount.bullets || 0}`, 20, y);
    y += lineHeight;
    ctx.fillText(`Particles: ${stats.entitiesCount.particles || 0}`, 20, y);
    y += lineHeight;
    ctx.fillText(`Powerups: ${stats.entitiesCount.powerups || 0}`, 20, y);
    y += lineHeight;
    ctx.fillText(`Loot: ${stats.entitiesCount.loot || 0}`, 20, y);
    y += lineHeight;

    // Network info
    y += 5;
    ctx.fillStyle = '#00ffff';
    ctx.fillText(`Last Update: ${stats.lastUpdate}ms ago`, 20, y);
    y += lineHeight;

    // Interpolation status
    const interpStatus = window.gameState.interpolation.enabled ? 'ON' : 'OFF';
    ctx.fillText(`Interpolation: ${interpStatus}`, 20, y);

    ctx.restore();
  }

  gameLoop(timestamp = 0) {
    // FPS limiting: use a -1ms tolerance so RAF firing slightly early
    // (16.5ms vs 16.67ms target) doesn't halve the framerate to 30fps.
    const targetFrameTime = window.performanceSettings
      ? window.performanceSettings.getTargetFrameTime()
      : 1000 / 60;

    const deltaTime = timestamp - this.lastFrameTime;
    const renderDeltaTime = this._lastTimestamp ? timestamp - this._lastTimestamp : 16;
    this._lastTimestamp = timestamp;

    try {
      // Player position prediction runs unconditionally each RAF frame
      this.playerController.update(window.innerWidth, window.innerHeight, renderDeltaTime);

      // -1ms tolerance absorbs rAF jitter; target 60fps runs at ~60fps, not ~30.
      if (deltaTime >= targetFrameTime - 1) {
        this.update(renderDeltaTime);
        this.render(renderDeltaTime);

        if (window.performanceSettings) {
          window.performanceSettings.onFrameRendered();
        }

        this.lastFrameTime = timestamp - (deltaTime % targetFrameTime);
      }
    } catch (error) {
      console.error('Game loop error:', error);
    }

    this.animationFrameId = requestAnimationFrame(ts => this.gameLoop(ts));
  }

  /**
   * Called when performance settings change
   */
  onPerformanceSettingsChanged(settings) {
    // Resize canvas with new resolution scale
    this.resizeCanvas();

    // Update renderer settings
    if (this.renderer) {
      this.renderer.performanceSettings = settings;
    }

    console.log('Performance settings updated in game engine:', settings);
  }

  start() {
    console.log('🎮 Zombie Survival - Game Engine Started');
    this.gameLoop();
  }

  cleanup() {
    // Cancel animation frame to stop game loop
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Remove resize and orientation change event listeners
    window.removeEventListener('resize', this.handlers.resize);
    window.removeEventListener('orientationchange', this.handlers.resize);

    // Remove mouse event listeners (if desktop)
    if (this.handlers.mousemove) {
      this.canvas.removeEventListener('mousemove', this.handlers.mousemove);
    }
    if (this.handlers.click) {
      this.canvas.removeEventListener('click', this.handlers.click);
    }

    // CORRECTION: Fermer la connexion socket proprement
    if (window.socket && typeof window.socket.close === 'function') {
      console.log('[CLEANUP] Closing socket connection');
      window.socket.close();
    }

    // Cleanup all managers
    if (window.inputManager && typeof window.inputManager.cleanup === 'function') {
      window.inputManager.cleanup();
    }

    if (window.gameUI && typeof window.gameUI.cleanup === 'function') {
      window.gameUI.cleanup();
    }

    if (this.nicknameManager && typeof this.nicknameManager.cleanup === 'function') {
      this.nicknameManager.cleanup();
    }

    if (this.mobileControls && typeof this.mobileControls.cleanup === 'function') {
      this.mobileControls.cleanup();
    }

    console.log('[CLEANUP] Game cleanup completed');
  }
}

// Export to window
window.GameEngine = GameEngine;
