/**
 * RENDERER (Orchestrator)
 * Delegates rendering to specialized sub-renderers:
 *   - BackgroundRenderer: grid, sky, parallax, floor, walls, doors, props
 *   - EntityRenderer: players, zombies, bullets, loot, powerups
 *   - EffectsRenderer: particles, explosions, poison trails, weather, lighting
 *   - UIRenderer: HUD, boss health bar, kill feed, combo, damage numbers, wave info
 *   - MinimapRenderer: minimap overlay
 *   - CrosshairRenderer: canvas crosshair with spread + zombie hover feedback
 * @module Renderer
 * @author Claude Code
 * @version 3.1.0
 */

class Renderer {
  constructor(canvas, ctx, minimapCanvas, minimapCtx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.minimapCanvas = minimapCanvas;
    this.minimapCtx = minimapCtx;
    this.camera = null;
    this.performanceSettings = null; // Will be set by GameEngine

    // Performance optimizations
    this.frustumCuller = window.FrustumCuller ? new window.FrustumCuller() : null;
    this.maxParticles = 100;
    this.cullStats = { visible: 0, total: 0, culled: 0 };

    // Sub-renderers
    this.backgroundRenderer = new window.BackgroundRenderer();
    this.entityRenderer = new window.EntityRenderer();
    this.effectsRenderer = new window.EffectsRenderer();
    this.uiRenderer = new window.UIRenderer();
    this.minimapRenderer = new window.MinimapRenderer();
    this.crosshairRenderer = window.CrosshairRenderer ? new window.CrosshairRenderer() : null;
  }

  // Proxy: notify crosshair of a shot (spread feedback)
  onShoot() {
    if (this.crosshairRenderer) {
      this.crosshairRenderer.onShoot();
    }
  }

  setCamera(camera) {
    this.camera = camera;
  }

  // Proxy: grid canvas creation (used by BackgroundRenderer)
  createGridCanvas(config) {
    this.backgroundRenderer.createGridCanvas(config);
  }

  // Proxy: keep gridCanvas/gridConfig accessible for backward compat
  get gridCanvas() {
    return this.backgroundRenderer.gridCanvas;
  }

  get gridConfig() {
    return this.backgroundRenderer.gridConfig;
  }

  // Proxy: damage numbers (public API)
  addDamageNumber(x, y, damage, type) {
    this.uiRenderer.addDamageNumber(x, y, damage, type);
  }

  // Proxy: pickup label popup (public API)
  addPickupLabel(x, y, text, color) {
    this.uiRenderer.addPickupLabel(x, y, text, color);
  }

  // Proxy: kill feed (public API)
  addKillFeedItem(killer, victim, type) {
    this.uiRenderer.addKillFeedItem(killer, victim, type);
  }

  // Proxy: access damageNumbers array
  get damageNumbers() {
    return this.uiRenderer.damageNumbers;
  }

  // Proxy: access killFeedItems
  get killFeedItems() {
    return this.uiRenderer.killFeedItems;
  }

  // Proxy: access uiState
  get uiState() {
    return this.uiRenderer.uiState;
  }

  // Proxy: access uiElements
  get uiElements() {
    return this.uiRenderer.uiElements;
  }

  // Proxy: access bossNameMap
  get bossNameMap() {
    return this.uiRenderer.bossNameMap;
  }

  clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  render(gameState, playerId, deltaTime = 16) {
    this.clear();

    const timestamp = performance.now();
    const dateNow = Date.now();

    const pixelRatio = window.devicePixelRatio || 1;
    this.ctx.save();
    this.ctx.scale(pixelRatio, pixelRatio);

    const player = gameState.state.players[playerId];
    if (!player) {
      this.renderWaitingMessage();
      this.ctx.restore();
      return;
    }

    const cameraPos = this.camera.getPosition();

    // Render day/night sky BEFORE world (fullscreen)
    this.backgroundRenderer.renderSky(this.ctx, this.canvas, gameState.state.dayNight);

    // Render parallax background layers BEFORE world
    this.backgroundRenderer.renderParallaxBackground(
      this.ctx,
      gameState.state.parallax,
      cameraPos,
      { width: this.canvas.width, height: this.canvas.height }
    );

    // Apply weather fog overlay BEFORE world rendering
    this.effectsRenderer.applyWeatherFog(this.ctx, this.canvas, gameState.state.weather, 'before');

    this.ctx.save();
    this.ctx.translate(-cameraPos.x, -cameraPos.y);

    // Render layers (bottom to top)
    this.backgroundRenderer.renderFloor(this.ctx, gameState.config, gameState.state.dayNight);
    this.backgroundRenderer.renderGrid(this.ctx, gameState.config);

    // Apply global shadow overlay if lighting system active
    this.effectsRenderer.applyAmbientDarkness(
      this.ctx,
      this.canvas,
      this.camera,
      gameState.state.lighting
    );

    this.backgroundRenderer.renderStaticProps(
      this.ctx,
      this.camera,
      gameState.state.staticProps,
      'ground'
    );
    this.backgroundRenderer.renderDynamicProps(this.ctx, this.camera, gameState.state.dynamicProps);
    this.backgroundRenderer.renderWalls(this.ctx, this.camera, gameState.state.walls);
    this.backgroundRenderer.renderDoors(this.ctx, this.camera, gameState.state.doors);
    this.entityRenderer.renderPowerups(
      this.ctx,
      this.camera,
      gameState.state.powerups,
      gameState.powerupTypes,
      gameState.config,
      dateNow
    );
    this.entityRenderer.renderLoot(
      this.ctx,
      this.camera,
      gameState.state.loot,
      gameState.config,
      dateNow
    );
    this.entityRenderer.renderDestructibleObstacles(
      this.ctx,
      this.camera,
      gameState.state.obstacles
    );
    this.effectsRenderer.renderParticles(this.ctx, this.camera, gameState.state.particles);
    this.effectsRenderer.renderDynamicPropParticles(
      this.ctx,
      this.camera,
      gameState.state.dynamicPropParticles
    );
    this.effectsRenderer.renderEnvironmentalParticles(
      this.ctx,
      this.camera,
      gameState.state.envParticles
    );
    this.effectsRenderer.renderPoisonTrails(
      this.ctx,
      this.camera,
      gameState.state.poisonTrails,
      dateNow
    );
    this.effectsRenderer.renderToxicPools(
      this.ctx,
      this.camera,
      gameState.state.toxicPools,
      dateNow
    );
    this.effectsRenderer.renderExplosions(
      this.ctx,
      this.camera,
      gameState.state.explosions,
      dateNow
    );

    // Render speed trails (SCREEN EFFECTS)
    if (window.screenEffects) {
      window.screenEffects.drawTrails(this.ctx, this.camera);
    }

    // CLIENT-SIDE PREDICTION: Use combined bullets (server + predicted) for rendering
    const bulletsToRender = gameState.getAllBulletsForRendering
      ? gameState.getAllBulletsForRendering()
      : gameState.state.bullets;
    this.entityRenderer.renderBullets(this.ctx, this.camera, bulletsToRender, gameState.config);
    this.entityRenderer.renderZombies(this.ctx, this.camera, gameState.state.zombies, timestamp);
    this.entityRenderer.renderPlayers(
      this.ctx,
      this.camera,
      gameState.state.players,
      playerId,
      gameState.config,
      dateNow,
      timestamp
    );

    // Render dynamic lights AFTER entities (additive blending)
    this.effectsRenderer.renderDynamicLights(this.ctx, this.camera, gameState.state.lighting);

    this.backgroundRenderer.renderStaticProps(
      this.ctx,
      this.camera,
      gameState.state.staticProps,
      'overlay'
    );
    this.effectsRenderer.renderWeather(this.ctx, this.camera, gameState.state.weather);
    this.entityRenderer.renderTargetIndicator(this.ctx, player);

    // Check zombie damage for damage numbers and hit markers
    this.uiRenderer.checkZombieDamage(gameState.state.zombies);

    // Update and render damage numbers + hit markers + pickup labels
    this.uiRenderer.updateDamageNumbers(deltaTime);
    this.uiRenderer.updateHitMarkers();
    this.uiRenderer.updatePickupLabels();
    this.uiRenderer.renderHitMarkers(this.ctx, this.camera);
    this.uiRenderer.renderDamageNumbers(this.ctx, this.camera);
    this.uiRenderer.renderPickupLabels(this.ctx, this.camera);

    this.ctx.restore();

    // Apply weather effects AFTER world rendering
    this.effectsRenderer.applyWeatherFog(this.ctx, this.canvas, gameState.state.weather, 'after');

    // Render minimap
    this.minimapRenderer.renderMinimap(this.minimapCanvas, this.minimapCtx, gameState, playerId);

    // Update kill feed and combo display
    this.uiRenderer.updateKillFeedAndCombo(gameState);

    // Update boss health bar
    this.uiRenderer.updateBossHealthBar(gameState);

    // Update wave progress bar
    this.uiRenderer.updateWaveProgress(gameState);

    this.ctx.restore(); // Restore pixelRatio scaling

    // Boss offscreen indicators — CSS-pixel screen space
    const pixelRatioForIndicators = window.devicePixelRatio || 1;
    this.ctx.save();
    this.ctx.scale(pixelRatioForIndicators, pixelRatioForIndicators);
    this.uiRenderer.renderBossOffscreenIndicators(
      this.ctx,
      this.camera,
      gameState,
      this.canvas.width / pixelRatioForIndicators,
      this.canvas.height / pixelRatioForIndicators
    );
    this.ctx.restore();

    // Crosshair — drawn in CSS-pixel screen space (after all transforms restored)
    if (this.crosshairRenderer && window.inputManager && !window.mobileControls?.isMobile) {
      const pixelRatio = window.devicePixelRatio || 1;
      this.crosshairRenderer.render(
        this.ctx,
        window.inputManager.mouse.x,
        window.inputManager.mouse.y,
        gameState.state.zombies,
        this.camera.getPosition(),
        pixelRatio
      );
    }
  }

  renderWaitingMessage() {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Connexion au serveur...', window.innerWidth / 2, window.innerHeight / 2);
  }
}

// Export to window
window.Renderer = Renderer;
