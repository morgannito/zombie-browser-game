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

    // Day/night cycle overlay (wave-based)
    this._dnCurrentColor = { r: 0, g: 0, b: 0, a: 0 };
    this._dnTargetColor = { r: 0, g: 0, b: 0, a: 0 };
    this._dnTransitionStart = 0;
    this._dnTransitionDuration = 3000; // 3s lerp
    this._dnLastWave = 0;
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
  addKillFeedItem(killer, victim, type, weapon, isOwnKill) {
    this.uiRenderer.addKillFeedItem(killer, victim, type, weapon, isOwnKill);
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

    // Effective ratio accounts for performance resolutionScale (devicePixelRatio × scale).
    // Derived from actual buffer vs CSS size to stay in sync with resizeCanvas.
    const pixelRatio = this.canvas.width / (this.canvas.clientWidth || window.innerWidth);
    this.ctx.save();
    this.ctx.scale(pixelRatio, pixelRatio);
    // Pixel-art sprites: keep crisp rendering after save/scale (ctx state is inherited
    // from the save stack, but re-assert here in case the context was re-created).
    this.ctx.imageSmoothingEnabled = false;

    let player = gameState.state.players[playerId];
    // Spectator mode: use targeted player as render anchor (no local player)
    if (!player && window.spectatorManager && window.spectatorManager.active) {
      const sid = window.spectatorManager.targetPlayerId;
      player = (sid && gameState.state.players[sid]) ||
        Object.values(gameState.state.players || {}).find(p => p && p.alive !== false) ||
        null;
    }
    if (!player) {
      this.renderWaitingMessage();
      this.ctx.restore();
      return;
    }

    // Reset per-frame culling counters before any entity rendering
    this.entityRenderer.resetCullingStats();

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
    const magnetEnabled = window.settingsManager ? window.settingsManager.get('magnetPickup') !== false : true;
    const localPlayer = gameState.state.players[playerId];
    const magnetPlayerPos = (magnetEnabled && localPlayer) ? { x: localPlayer.x, y: localPlayer.y } : null;
    this.entityRenderer.renderPowerups(
      this.ctx,
      this.camera,
      gameState.state.powerups,
      gameState.powerupTypes,
      gameState.config,
      dateNow,
      magnetPlayerPos,
      magnetEnabled
    );
    this.entityRenderer.renderLoot(
      this.ctx,
      this.camera,
      gameState.state.loot,
      gameState.config,
      dateNow,
      magnetPlayerPos,
      magnetEnabled
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
    this.effectsRenderer.renderScorchDecals(this.ctx, this.camera, dateNow);
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

    // Track bullet removal → spawn ghost + impact spark
    if (!this._prevBulletIds) {
this._prevBulletIds = new Map();
} // id → {x, y, color, size}
    const prevBullets = this._prevBulletIds;
    for (const [id, snap] of prevBullets) {
      if (!bulletsToRender[id]) {
        this.effectsRenderer.addBulletGhost(snap, snap.color);
        this.effectsRenderer.addBulletImpact(snap.x, snap.y, snap.color);
      }
    }
    prevBullets.clear();
    for (const id in bulletsToRender) {
      const b = bulletsToRender[id];
      if (b) {
prevBullets.set(id, { x: b.x, y: b.y, color: b.color || '#ffff00', size: b.size || 5 });
}
    }

    this.entityRenderer.renderBullets(this.ctx, this.camera, bulletsToRender, gameState.config);

    // Render bullet ghosts and impact sparks
    this.effectsRenderer.renderBulletEffects(this.ctx, this.camera, dateNow);
    this.entityRenderer.renderZombies(this.ctx, this.camera, gameState.state.zombies, timestamp);
    // Blood pools + splatter particles (rendered above floor, above zombies)
    this.effectsRenderer.renderBloodEffects(this.ctx, this.camera, dateNow);
    this.entityRenderer.renderPlayers(
      this.ctx,
      this.camera,
      gameState.state.players,
      playerId,
      gameState.config,
      dateNow,
      timestamp
    );

    // Muzzle flashes — drawn above entities, below UI
    this.effectsRenderer.renderMuzzleFlashes(this.ctx, this.camera, dateNow);

    // Hazard warning indicator
    this.effectsRenderer.renderHazardWarning(
      this.ctx,
      this.camera,
      player,
      gameState.state.toxicPools,
      gameState.state.poisonTrails,
      dateNow
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

    // Gore: detect zombie hits/deaths and spawn blood
    this.effectsRenderer.processZombieGore(gameState.state.zombies);

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

    // Day/night cycle overlay (wave-based, above game world, below HUD)
    this._renderWaveDayNight(gameState.state.wave || 1);

    // POST-PROCESS: vignette + blood overlay (CSS-pixel space, no scaling needed)
    this._renderPostProcess(player);

    // Boss offscreen indicators — CSS-pixel screen space
    const pixelRatioForIndicators =
      this.canvas.width / (this.canvas.clientWidth || window.innerWidth);
    this.ctx.save();
    this.ctx.scale(pixelRatioForIndicators, pixelRatioForIndicators);
    this.uiRenderer.renderBossOffscreenIndicators(
      this.ctx,
      this.camera,
      gameState,
      this.canvas.width / pixelRatioForIndicators,
      this.canvas.height / pixelRatioForIndicators
    );
    this.uiRenderer.renderDangerArrows(
      this.ctx,
      this.camera,
      gameState,
      this.canvas.width / pixelRatioForIndicators,
      this.canvas.height / pixelRatioForIndicators,
      playerId
    );
    this.ctx.restore();

    // Crosshair — drawn in CSS-pixel screen space (after all transforms restored)
    if (this.crosshairRenderer && window.inputManager && !window.mobileControls?.isMobile) {
      // Use EFFECTIVE pixelRatio (devicePixelRatio * resolutionScale) computed
      // from canvas.width/CSS width, not window.devicePixelRatio alone.
      // Mismatch between the two caused crosshair offset when user had a
      // performance preset lowering resolutionScale, while shots (which use
      // world coords via camera) still landed correctly under the cursor.
      const effectivePixelRatio =
        this.canvas.width / (this.canvas.clientWidth || window.innerWidth);
      this.ctx.save();
      this.ctx.scale(effectivePixelRatio, effectivePixelRatio);
      this.crosshairRenderer.render(
        this.ctx,
        window.inputManager.mouse.x,
        window.inputManager.mouse.y,
        gameState.state.zombies,
        this.camera.getPosition(),
        effectivePixelRatio
      );
      this.ctx.restore();
    }

    // Expose culling stats for DebugOverlay
    window._cullingStats = this.entityRenderer.getCullingStats();
  }

  /**
   * Returns the target overlay color for a given wave number.
   * @param {number} wave
   * @returns {{r,g,b,a}}
   */
  _getDayNightTarget(wave) {
    if (wave >= 10) {
return { r: 80, g: 0, b: 0, a: 0.4 };
}
    if (wave >= 7)  {
return { r: 10, g: 20, b: 60, a: 0.35 };
}
    if (wave >= 4)  {
return { r: 255, g: 100, b: 0, a: 0.15 };
}
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  /**
   * Renders a full-screen wave-based day/night color overlay.
   * Transitions smoothly over 3s when the wave changes.
   * @param {number} wave
   */
  _renderWaveDayNight(wave) {
    const target = this._getDayNightTarget(wave);

    if (wave !== this._dnLastWave) {
      // Start a new transition from the current interpolated color
      const now = performance.now();
      const elapsed = now - this._dnTransitionStart;
      const t = Math.min(1, elapsed / this._dnTransitionDuration);
      this._dnCurrentColor = {
        r: this._dnCurrentColor.r + (this._dnTargetColor.r - this._dnCurrentColor.r) * t,
        g: this._dnCurrentColor.g + (this._dnTargetColor.g - this._dnCurrentColor.g) * t,
        b: this._dnCurrentColor.b + (this._dnTargetColor.b - this._dnCurrentColor.b) * t,
        a: this._dnCurrentColor.a + (this._dnTargetColor.a - this._dnCurrentColor.a) * t
      };
      this._dnTargetColor = target;
      this._dnTransitionStart = performance.now();
      this._dnLastWave = wave;
    }

    const elapsed = performance.now() - this._dnTransitionStart;
    const t = Math.min(1, elapsed / this._dnTransitionDuration);
    const c = this._dnCurrentColor;
    const tgt = this._dnTargetColor;
    const r = Math.round(c.r + (tgt.r - c.r) * t);
    const g = Math.round(c.g + (tgt.g - c.g) * t);
    const b = Math.round(c.b + (tgt.b - c.b) * t);
    const a = c.a + (tgt.a - c.a) * t;

    if (a <= 0) {
return;
}

    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  /**
   * Post-process compositing: dynamic vignette + blood overlay based on player HP.
   * Drawn in canvas buffer space (no pixelRatio scale applied here).
   * @param {Object} player - Local player state
   */
  _renderPostProcess(player) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const maxHp = player.maxHealth || player.maxHp || 100;
    const hp = player.health ?? player.hp ?? maxHp;
    const hpRatio = Math.max(0, Math.min(1, hp / maxHp));

    // --- Dynamic vignette ---
    // Base vignette always present (subtle), intensifies and turns red below 30 HP
    const lowHp = hpRatio < 0.3;
    const baseAlpha = 0.45 + (1 - hpRatio) * 0.35; // 0.45 at full HP → 0.8 at 0 HP

    // Pulsing red when critically low
    let vignetteColor;
    if (lowHp) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      const red = Math.round(180 + pulse * 75);
      vignetteColor = `rgba(${red},0,0,${(baseAlpha * (0.7 + pulse * 0.3)).toFixed(3)})`;
    } else {
      vignetteColor = `rgba(0,0,0,${baseAlpha.toFixed(3)})`;
    }

    const vgRadius = Math.hypot(w, h) * 0.5;
    const vgInner = Math.min(w, h) * 0.38;
    const grad = ctx.createRadialGradient(w / 2, h / 2, vgInner, w / 2, h / 2, vgRadius);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, vignetteColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // --- Blood overlay: red edge bleed at low HP ---
    if (hpRatio < 0.5) {
      const bloodAlpha = (0.5 - hpRatio) * 0.7; // 0 at 50 HP → 0.35 at 0 HP
      const bloodGrad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, vgRadius);
      bloodGrad.addColorStop(0, 'rgba(120,0,0,0)');
      bloodGrad.addColorStop(0.6, 'rgba(160,0,0,0)');
      bloodGrad.addColorStop(1, `rgba(200,0,0,${bloodAlpha.toFixed(3)})`);
      ctx.fillStyle = bloodGrad;
      ctx.fillRect(0, 0, w, h);
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
