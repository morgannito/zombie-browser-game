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
      mousemove: null,
      click: null
    };

    this.animationFrameId = null; // Store requestAnimationFrame ID for cleanup
    this.lastFrameTime = 0; // For FPS limiting
    this.frameTimeAccumulator = 0; // For consistent frame timing

    this.setupCanvas();
    this.initializeManagers();
    this.start();

    // Debug mode toggle (press 'D' key)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D') {
        if (!document.querySelector('input:focus')) { // Only if not typing in input
          window.gameState.toggleDebug();
        }
      }
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => this.cleanup());
  }

  setupCanvas() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.minimapCanvas = document.getElementById('minimap');
    this.minimapCtx = this.minimapCanvas.getContext('2d');

    // Resize canvas
    this.resizeCanvas();
    window.addEventListener('resize', this.handlers.resize);

    // Handle orientation changes on mobile
    window.addEventListener('orientationchange', this.handlers.resize);
  }

  resizeCanvas() {
    const basePixelRatio = window.devicePixelRatio || 1;

    // Apply performance settings resolution scale
    const resolutionScale = window.performanceSettings ?
      window.performanceSettings.getResolutionScale() : 1.0;

    const pixelRatio = basePixelRatio * resolutionScale;

    // Set display size (CSS pixels)
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';

    // Set actual size in memory (scaled for Retina/high-DPI displays + performance)
    this.canvas.width = window.innerWidth * pixelRatio;
    this.canvas.height = window.innerHeight * pixelRatio;

    // Note: Pixel ratio scaling is applied in the render() method to avoid accumulation

    // Also resize minimap canvas
    this.resizeMinimapCanvas();
  }

  resizeMinimapCanvas() {
    if (!this.renderer || !this.renderer.minimapCanvas) return;

    const basePixelRatio = window.devicePixelRatio || 1;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    let minimapSize = 200; // Default desktop size

    // Apply mobile size settings
    if (isMobile && window.performanceSettings) {
      const settings = window.performanceSettings.getSettings();
      const sizeMap = {
        'small': 50,
        'medium': 80,
        'large': 120
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
      window.gameEngine = this; // Make engine accessible for performance settings
    }

    // Managers
    window.inputManager = new InputManager();
    const camera = new CameraManager();

    // Socket.IO client configuration optimized for low latency
    // Prioritize WebSocket transport for faster connection
    // Include sessionId for reconnection recovery
    const socket = io({
      transports: ['websocket', 'polling'], // WebSocket first for lower latency
      upgrade: false, // Don't upgrade, use WebSocket directly
      reconnection: true,
      reconnectionDelay: 500, // Faster initial reconnection
      reconnectionDelayMax: 3000, // Reduced max delay
      reconnectionAttempts: 10, // More attempts with shorter delays
      timeout: 20000, // Reduced timeout for faster failure detection
      auth: {
        sessionId: window.sessionManager.getSessionId()
      },
      // Enable ping/pong for latency monitoring
      pingInterval: 10000, // Check connection every 10s
      pingTimeout: 5000 // Wait 5s for pong response
    });

    window.networkManager = new NetworkManager(socket);
    window.gameUI = new UIManager(window.gameState);
    window.audioManager = new AudioManager(); // Audio feedback
    window.comboSystem = new ComboSystem(); // Système de combos
    window.leaderboardSystem = new LeaderboardSystem(); // Système de classement
    window.toastManager = new ToastManager(); // Système de notifications
    window.screenEffects = new ScreenEffectsManager(this.canvas); // Screen effects (flash, shake, slowmo, trails)

    // Mobile controls
    this.mobileControls = new MobileControlsManager();
    window.mobileControls = this.mobileControls; // Make globally accessible
    window.inputManager.setMobileControls(this.mobileControls);
    window.playerController = this.playerController = new PlayerController(window.inputManager, window.networkManager, window.gameState, camera);

    this.renderer = new Renderer(this.canvas, this.ctx, this.minimapCanvas, this.minimapCtx);
    this.renderer.setCamera(camera);

    this.nicknameManager = new NicknameManager(this.playerController);

    // Mouse events (only if not mobile)
    if (!this.mobileControls.isMobile) {
      this.handlers.mousemove = (e) => {
        window.inputManager.updateMouse(e.clientX, e.clientY);
      };
      this.handlers.click = () => {
        // Use CSS pixels for consistent shooting angle calculation
        this.playerController.shoot(window.innerWidth, window.innerHeight);
      };

      this.canvas.addEventListener('mousemove', this.handlers.mousemove);
      this.canvas.addEventListener('click', this.handlers.click);
    }
  }

  update(deltaTime = 16) {
    // Clean up orphaned entities (every 60 frames ≈ 1 second at 60 FPS)
    if (!this._cleanupFrameCounter) this._cleanupFrameCounter = 0;
    if (++this._cleanupFrameCounter >= 60) {
      window.gameState.cleanupOrphanedEntities();
      this._cleanupFrameCounter = 0;
    }

    // Update screen effects (trails decay, etc.) (SCREEN EFFECTS)
    if (window.screenEffects) {
      window.screenEffects.update(deltaTime);
    }

    // Update mobile auto-shoot (MOBILE)
    if (this.mobileControls && this.mobileControls.updateAutoShoot) {
      this.mobileControls.updateAutoShoot(performance.now());
    }

    // Use CSS pixels (window dimensions) instead of physical canvas dimensions
    // to ensure proper camera centering on high-DPI displays (mobile)
    this.playerController.update(window.innerWidth, window.innerHeight);
  }

  render() {
    // Apply visual interpolation for smooth movement BEFORE rendering
    window.gameState.applyInterpolation();

    // Update debug stats if debug mode is enabled
    if (window.gameState.debugMode) {
      window.gameState.updateDebugStats();
    }

    this.renderer.render(window.gameState, window.gameState.playerId);

    // Render debug overlay if enabled
    if (window.gameState.debugMode) {
      this.renderDebugOverlay();
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
    ctx.fillText('DEBUG MODE (Press D to toggle)', 20, y);
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
    // FPS limiting based on performance settings
    const targetFrameTime = window.performanceSettings ?
      window.performanceSettings.getTargetFrameTime() : (1000 / 60);

    const deltaTime = timestamp - this.lastFrameTime;

    // Only update/render if enough time has passed
    if (deltaTime >= targetFrameTime) {
      try {
        this.update(deltaTime);
        this.render();

        // Notify performance settings for FPS counting
        if (window.performanceSettings) {
          window.performanceSettings.onFrameRendered();
        }
      } catch (error) {
        console.error('Game loop error:', error);
        // Continue the game loop even if there's an error
      }

      this.lastFrameTime = timestamp - (deltaTime % targetFrameTime);
    }

    this.animationFrameId = requestAnimationFrame((ts) => this.gameLoop(ts));
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
