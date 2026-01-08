/**
 * RENDERER
 * Handles all game rendering including sprites, effects, and minimap
 * @module Renderer
 * @author Claude Code
 * @version 2.0.0
 */

class Renderer {
  constructor(canvas, ctx, minimapCanvas, minimapCtx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.minimapCanvas = minimapCanvas;
    this.minimapCtx = minimapCtx;
    this.camera = null;
    this.performanceSettings = null; // Will be set by GameEngine
    this.gridCanvas = null; // Offscreen canvas for grid optimization
    this.gridConfig = null; // Store config to detect changes

    // Performance optimizations
    this.frustumCuller = window.FrustumCuller ? new window.FrustumCuller() : null;
    this.maxParticles = 100; // Limite particules actives
    this.cullStats = { visible: 0, total: 0, culled: 0 };

    // Damage numbers system
    this.damageNumbers = [];
    this.lastZombieHealthCheck = {}; // Track zombie health to detect damage

    // Kill feed system
    this.lastZombieCount = 0; // Track zombie count to detect kills
    this.killFeedItems = [];

    // Combo tracking
    this.lastComboValue = 0;
  }

  setCamera(camera) {
    this.camera = camera;
  }

  // Crée un canvas offscreen pour la grille (optimisation)
  createGridCanvas(config) {
    // Si déjà créé avec la même config, ne pas recréer
    if (this.gridCanvas && this.gridConfig &&
        this.gridConfig.ROOM_WIDTH === config.ROOM_WIDTH &&
        this.gridConfig.ROOM_HEIGHT === config.ROOM_HEIGHT) {
      return;
    }

    // Créer un nouveau canvas offscreen
    this.gridCanvas = document.createElement('canvas');
    this.gridCanvas.width = config.ROOM_WIDTH;
    this.gridCanvas.height = config.ROOM_HEIGHT;
    const gridCtx = this.gridCanvas.getContext('2d');

    // Dessiner la grille sur le canvas offscreen
    gridCtx.strokeStyle = '#252541';
    gridCtx.lineWidth = 1;

    const gridSize = CONSTANTS.CANVAS.GRID_SIZE;

    for (let x = 0; x < config.ROOM_WIDTH; x += gridSize) {
      gridCtx.beginPath();
      gridCtx.moveTo(x, 0);
      gridCtx.lineTo(x, config.ROOM_HEIGHT);
      gridCtx.stroke();
    }

    for (let y = 0; y < config.ROOM_HEIGHT; y += gridSize) {
      gridCtx.beginPath();
      gridCtx.moveTo(0, y);
      gridCtx.lineTo(config.ROOM_WIDTH, y);
      gridCtx.stroke();
    }

    // Sauvegarder la config
    this.gridConfig = {
      ROOM_WIDTH: config.ROOM_WIDTH,
      ROOM_HEIGHT: config.ROOM_HEIGHT
    };
  }

  clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transforms
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  render(gameState, playerId) {
    this.clear();

    // Cache timestamps for performance (calculate once per frame)
    const timestamp = performance.now();
    const dateNow = Date.now();

    // Scale context for Retina displays (canvas is already physically sized × pixelRatio)
    // This allows us to draw in CSS pixels while the canvas renders at device pixels
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
    this.renderSky(gameState.state.dayNight);

    // Apply weather fog overlay BEFORE world rendering
    this.applyWeatherFog(gameState.state.weather, 'before');

    this.ctx.save();
    this.ctx.translate(-cameraPos.x, -cameraPos.y);

    // Render layers (bottom to top)
    this.renderFloor(gameState.config, gameState.state.dayNight);
    this.renderGrid(gameState.config);

    // Apply global shadow overlay if lighting system active
    this.applyAmbientDarkness(gameState.state.lighting);

    this.renderStaticProps(gameState.state.staticProps, 'ground'); // Ground layer props
    this.renderDynamicProps(gameState.state.dynamicProps); // Dynamic props base (torches, fires)
    this.renderWalls(gameState.state.walls);
    this.renderDoors(gameState.state.doors);
    this.renderPowerups(gameState.state.powerups, gameState.powerupTypes, gameState.config, dateNow);
    this.renderLoot(gameState.state.loot, gameState.config, dateNow);
    this.renderDestructibleObstacles(gameState.state.obstacles);
    this.renderParticles(gameState.state.particles);
    this.renderDynamicPropParticles(gameState.state.dynamicPropParticles); // Fire/smoke particles
    this.renderPoisonTrails(gameState.state.poisonTrails, dateNow);
    this.renderToxicPools(gameState.state.toxicPools, dateNow);
    this.renderExplosions(gameState.state.explosions, dateNow);
    // Render speed trails (SCREEN EFFECTS)
    if (window.screenEffects) {
      window.screenEffects.drawTrails(this.ctx, this.camera);
    }
    this.renderBullets(gameState.state.bullets, gameState.config);
    this.renderZombies(gameState.state.zombies, timestamp);
    this.renderPlayers(gameState.state.players, playerId, gameState.config, dateNow, timestamp);

    // Render dynamic lights AFTER entities (additive blending)
    this.renderDynamicLights(gameState.state.lighting);

    this.renderStaticProps(gameState.state.staticProps, 'overlay'); // Overlay layer props (trees, posts)
    this.renderWeather(gameState.state.weather); // Render rain/snow particles
    this.renderTargetIndicator(player); // Show auto-shoot target indicator

    // Check zombie damage for damage numbers
    this.checkZombieDamage(gameState.state.zombies);

    // Update and render damage numbers
    const deltaTime = 16; // Approximate 60fps
    this.updateDamageNumbers(deltaTime);
    this.renderDamageNumbers();

    this.ctx.restore();

    // Apply weather effects AFTER world rendering
    this.applyWeatherFog(gameState.state.weather, 'after');

    // Render minimap
    this.renderMinimap(gameState, playerId);

    // Update kill feed and combo display
    this.updateKillFeedAndCombo(gameState);

    // Update boss health bar
    this.updateBossHealthBar(gameState);

    // Update wave progress bar
    this.updateWaveProgress(gameState);

    this.ctx.restore(); // Restore pixelRatio scaling
  }

  renderWaitingMessage() {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'center';
    // Use CSS pixels (window dimensions) for proper centering on high-DPI displays
    this.ctx.fillText('Connexion au serveur...', window.innerWidth / 2, window.innerHeight / 2);
  }

  renderFloor(config, dayNight) {
    // Base floor color adjusted by time of day
    let floorColor = '#1a1a2e';

    if (dayNight && dayNight.config) {
      const ambient = dayNight.config.ambient;
      const darken = Math.floor((1 - ambient) * 100);
      floorColor = `hsl(240, 25%, ${Math.max(5, 12 - darken)}%)`;
    }

    this.ctx.fillStyle = floorColor;
    this.ctx.fillRect(0, 0, config.ROOM_WIDTH, config.ROOM_HEIGHT);
  }

  renderGrid(config) {
    // Check performance settings
    if (window.performanceSettings && !window.performanceSettings.shouldRenderGrid()) {
      return; // Skip grid rendering in performance mode
    }

    // Créer le canvas de grille si pas encore fait
    if (!this.gridCanvas) {
      this.createGridCanvas(config);
    }

    // Dessiner le canvas de grille pré-rendu (beaucoup plus rapide)
    this.ctx.drawImage(this.gridCanvas, 0, 0);
  }

  renderWalls(walls) {
    this.ctx.fillStyle = '#2d2d44';

    walls.forEach(wall => {
      this.ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
      this.ctx.strokeStyle = '#3d3d54';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
    });
  }

  renderDoors(doors) {
    if (!doors || !Array.isArray(doors)) return;

    doors.forEach(door => {
      this.ctx.fillStyle = door.active ? '#00ff00' : '#ff0000';
      this.ctx.fillRect(door.x, door.y, door.width, door.height);

      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 16px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(door.active ? '▲' : '✖', door.x + door.width / 2, door.y + 15);
    });
  }

  renderPowerups(powerups, powerupTypes, config, now = Date.now()) {
    Object.values(powerups).forEach(powerup => {
      const type = powerupTypes[powerup.type];
      if (!type) return;

      const pulse = Math.sin(now / 200) * 3 + config.POWERUP_SIZE;

      this.ctx.fillStyle = type.color;
      this.ctx.beginPath();
      this.ctx.arc(powerup.x, powerup.y, pulse, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Icon
      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const symbols = {
        health: '+',
        speed: '»',
        shotgun: 'S',
        machinegun: 'M',
        rocketlauncher: 'R'
      };

      this.ctx.fillText(symbols[powerup.type] || '?', powerup.x, powerup.y);
    });
  }

  renderLoot(loot, config, now = Date.now()) {
    Object.values(loot).forEach(item => {
      const rotation = (now / 500) % (Math.PI * 2);

      this.ctx.save();
      this.ctx.translate(item.x, item.y);
      this.ctx.rotate(rotation);

      this.ctx.fillStyle = '#ffd700';
      this.ctx.beginPath();
      this.ctx.ellipse(0, 0, config.LOOT_SIZE, config.LOOT_SIZE * 0.6, 0, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.strokeStyle = '#ff8c00';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.restore();
    });
  }

  renderDestructibleObstacles(obstacles) {
    if (!obstacles || obstacles.length === 0) return;

    obstacles.forEach(obstacle => {
      if (obstacle.destroyed) return;

      // Viewport culling
      if (!this.camera.isInViewport(obstacle.x, obstacle.y, obstacle.width * 2)) {
        return;
      }

      this.ctx.save();
      this.ctx.translate(obstacle.x, obstacle.y);

      // Draw obstacle shadow
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.beginPath();
      this.ctx.ellipse(2, obstacle.height / 3, obstacle.width / 2, obstacle.height / 6, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw obstacle body
      this.ctx.fillStyle = obstacle.color || '#8B4513';
      this.ctx.strokeStyle = this.darkenColor(obstacle.color || '#8B4513', 30);
      this.ctx.lineWidth = 2;

      // Different shapes based on type
      if (obstacle.type === 'barrel') {
        // Barrel shape
        this.ctx.beginPath();
        this.ctx.ellipse(0, -obstacle.height / 2 + 5, obstacle.width / 2, 5, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillRect(-obstacle.width / 2, -obstacle.height / 2 + 5, obstacle.width, obstacle.height - 10);
        this.ctx.strokeRect(-obstacle.width / 2, -obstacle.height / 2 + 5, obstacle.width, obstacle.height - 10);

        this.ctx.beginPath();
        this.ctx.ellipse(0, obstacle.height / 2 - 5, obstacle.width / 2, 5, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Barrel stripes
        this.ctx.strokeStyle = this.darkenColor(obstacle.color, 40);
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(-obstacle.width / 2, -5);
        this.ctx.lineTo(obstacle.width / 2, -5);
        this.ctx.moveTo(-obstacle.width / 2, 5);
        this.ctx.lineTo(obstacle.width / 2, 5);
        this.ctx.stroke();
      } else if (obstacle.type === 'vase') {
        // Vase shape
        this.ctx.beginPath();
        this.ctx.moveTo(-obstacle.width / 3, -obstacle.height / 2);
        this.ctx.lineTo(-obstacle.width / 2, -obstacle.height / 4);
        this.ctx.lineTo(-obstacle.width / 2, obstacle.height / 4);
        this.ctx.lineTo(-obstacle.width / 3, obstacle.height / 2);
        this.ctx.lineTo(obstacle.width / 3, obstacle.height / 2);
        this.ctx.lineTo(obstacle.width / 2, obstacle.height / 4);
        this.ctx.lineTo(obstacle.width / 2, -obstacle.height / 4);
        this.ctx.lineTo(obstacle.width / 3, -obstacle.height / 2);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      } else if (obstacle.type === 'tire') {
        // Tire shape
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, obstacle.width / 2, obstacle.height / 2, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Inner circle
        this.ctx.fillStyle = '#444';
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, obstacle.width / 4, obstacle.height / 4, 0, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        // Default crate shape
        this.ctx.fillRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
        this.ctx.strokeRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);

        // Crate details (planks)
        this.ctx.strokeStyle = this.darkenColor(obstacle.color, 40);
        this.ctx.lineWidth = 2;
        for (let i = -obstacle.width / 2 + 10; i < obstacle.width / 2; i += 10) {
          this.ctx.beginPath();
          this.ctx.moveTo(i, -obstacle.height / 2);
          this.ctx.lineTo(i, obstacle.height / 2);
          this.ctx.stroke();
        }
      }

      // Draw icon if exists
      if (obstacle.icon) {
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText(obstacle.icon, 0, -obstacle.height / 2 - 15);
      }

      // Draw health bar if damaged
      const healthPercent = obstacle.health / obstacle.maxHealth;
      if (healthPercent < 1) {
        const barWidth = obstacle.width;
        const barHeight = 4;
        const barY = -obstacle.height / 2 - 8;

        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);

        // Health fill
        let healthColor = '#00ff00';
        if (healthPercent < 0.3) healthColor = '#ff0000';
        else if (healthPercent < 0.6) healthColor = '#ffaa00';

        this.ctx.fillStyle = healthColor;
        this.ctx.fillRect(-barWidth / 2, barY, barWidth * healthPercent, barHeight);

        // Border
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(-barWidth / 2, barY, barWidth, barHeight);
      }

      this.ctx.restore();
    });
  }

  darkenColor(color, percent) {
    // Simple color darkening
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16).slice(1);
  }

  renderStaticProps(props, layer = 'all') {
    if (!props || props.length === 0) return;

    props.forEach(prop => {
      // Layer filtering
      if (layer === 'ground' && prop.renderLayers) return;
      if (layer === 'overlay' && !prop.renderLayers) return;

      // Viewport culling
      if (!this.camera.isInViewport(prop.x, prop.y, Math.max(prop.width, prop.height) * 2)) {
        return;
      }

      this.ctx.save();
      this.ctx.translate(prop.x, prop.y);
      this.ctx.rotate(prop.rotation || 0);

      // Render shadow
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.beginPath();
      this.ctx.ellipse(3, prop.height / 4, prop.width / 2 * (prop.shadowSize || 1), prop.height / 8, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Render based on type
      switch (prop.type) {
        case 'tree':
          this.renderTree(prop);
          break;
        case 'rock':
          this.renderRock(prop);
          break;
        case 'car':
          this.renderCar(prop);
          break;
        case 'bush':
          this.renderBush(prop);
          break;
        case 'lampPost':
          this.renderLampPost(prop);
          break;
        case 'fence':
          this.renderFence(prop);
          break;
        case 'sign':
          this.renderSign(prop);
          break;
        case 'bench':
          this.renderBench(prop);
          break;
        default:
          // Generic prop
          this.ctx.fillStyle = prop.color || '#888';
          this.ctx.fillRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height);
      }

      this.ctx.restore();
    });
  }

  renderTree(prop) {
    // Trunk
    this.ctx.fillStyle = prop.trunkColor || '#4a3520';
    this.ctx.fillRect(-8, -10, 16, 40);

    // Foliage (3 layers for depth)
    const colors = ['#2d5016', '#3a6b35', '#4a7d45'];
    const sizes = [40, 35, 30];

    for (let i = 0; i < 3; i++) {
      this.ctx.fillStyle = colors[i];
      this.ctx.beginPath();
      this.ctx.ellipse(0, -40 - i * 10, sizes[i], sizes[i] * 0.8, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Highlight
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.beginPath();
    this.ctx.ellipse(-10, -50, 12, 10, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  renderRock(prop) {
    this.ctx.fillStyle = prop.color || '#5a5a5a';
    this.ctx.strokeStyle = this.darkenColor(prop.color || '#5a5a5a', 30);
    this.ctx.lineWidth = 2;

    // Irregular rock shape
    this.ctx.beginPath();
    const points = 8;
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const variance = 0.7 + Math.sin(i + prop.variant) * 0.3;
      const x = Math.cos(angle) * prop.width / 2 * variance;
      const y = Math.sin(angle) * prop.height / 2 * variance;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Cracks
    this.ctx.strokeStyle = this.darkenColor(prop.color, 50);
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(-5, -5);
    this.ctx.lineTo(8, 5);
    this.ctx.moveTo(0, -8);
    this.ctx.lineTo(-6, 8);
    this.ctx.stroke();
  }

  renderCar(prop) {
    // Car body
    this.ctx.fillStyle = prop.color || '#c0c0c0';
    this.ctx.fillRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height);

    // Windows
    this.ctx.fillStyle = '#4a7d9d';
    this.ctx.fillRect(-prop.width / 2 + 10, -prop.height / 2 + 5, prop.width / 3, prop.height - 10);

    // Wheels
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.beginPath();
    this.ctx.arc(-prop.width / 3, prop.height / 2, 8, 0, Math.PI * 2);
    this.ctx.arc(prop.width / 3, prop.height / 2, 8, 0, Math.PI * 2);
    this.ctx.fill();

    // Headlights
    this.ctx.fillStyle = '#ffff99';
    this.ctx.fillRect(prop.width / 2 - 5, -prop.height / 2 + 8, 5, 8);
    this.ctx.fillRect(prop.width / 2 - 5, prop.height / 2 - 16, 5, 8);
  }

  renderBush(prop) {
    this.ctx.fillStyle = prop.color || '#3a6b35';

    // Multiple circles for bushy appearance
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 8;
      const y = Math.sin(i) * 5;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 12, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  renderLampPost(prop) {
    // Post
    this.ctx.fillStyle = prop.color || '#4a4a4a';
    this.ctx.fillRect(-5, -prop.height / 2, 10, prop.height);

    // Lamp
    this.ctx.fillStyle = '#6a6a6a';
    this.ctx.beginPath();
    this.ctx.arc(0, -prop.height / 2, 12, 0, Math.PI * 2);
    this.ctx.fill();

    // Light glow
    const gradient = this.ctx.createRadialGradient(0, -prop.height / 2, 0, 0, -prop.height / 2, 30);
    gradient.addColorStop(0, 'rgba(255, 255, 153, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 255, 153, 0)');
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(0, -prop.height / 2, 30, 0, Math.PI * 2);
    this.ctx.fill();
  }

  renderFence(prop) {
    this.ctx.fillStyle = prop.color || '#6b4423';
    this.ctx.strokeStyle = this.darkenColor(prop.color || '#6b4423', 30);
    this.ctx.lineWidth = 2;

    // Horizontal beams
    this.ctx.fillRect(-prop.width / 2, -5, prop.width, 3);
    this.ctx.fillRect(-prop.width / 2, 5, prop.width, 3);

    // Vertical posts
    for (let i = -prop.width / 2; i <= prop.width / 2; i += 15) {
      this.ctx.fillRect(i - 2, -prop.height / 2, 4, prop.height);
    }
  }

  renderSign(prop) {
    // Post
    this.ctx.fillStyle = '#6b4423';
    this.ctx.fillRect(-3, 0, 6, prop.height / 2);

    // Sign board
    this.ctx.fillStyle = prop.color || '#d4a574';
    this.ctx.strokeStyle = '#4a3520';
    this.ctx.lineWidth = 2;
    this.ctx.fillRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height / 2);
    this.ctx.strokeRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height / 2);

    // Text lines
    this.ctx.fillStyle = '#4a3520';
    this.ctx.fillRect(-10, -prop.height / 2 + 8, 20, 2);
    this.ctx.fillRect(-10, -prop.height / 2 + 14, 20, 2);
  }

  renderBench(prop) {
    this.ctx.fillStyle = prop.color || '#6b4423';
    this.ctx.strokeStyle = this.darkenColor(prop.color || '#6b4423', 30);
    this.ctx.lineWidth = 2;

    // Seat
    this.ctx.fillRect(-prop.width / 2, -8, prop.width, 8);

    // Backrest
    this.ctx.fillRect(-prop.width / 2, -prop.height / 2, 5, 20);
    this.ctx.fillRect(prop.width / 2 - 5, -prop.height / 2, 5, 20);
    this.ctx.fillRect(-prop.width / 2, -prop.height / 2, prop.width, 5);

    // Legs
    this.ctx.fillRect(-prop.width / 2 + 5, 0, 4, 10);
    this.ctx.fillRect(prop.width / 2 - 9, 0, 4, 10);
  }

  renderDynamicProps(props) {
    if (!props || props.length === 0) return;

    props.forEach(prop => {
      // Viewport culling
      if (!this.camera.isInViewport(prop.x, prop.y, prop.lightRadius || 100)) {
        return;
      }

      this.ctx.save();
      this.ctx.translate(prop.x, prop.y);

      // Render light glow first (behind everything)
      if (prop.lightRadius && prop.lightColor) {
        const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, prop.lightRadius);
        gradient.addColorStop(0, prop.lightColor);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, prop.lightRadius, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Render prop base based on type
      switch (prop.type) {
        case 'fire':
          this.renderFireBase(prop);
          break;
        case 'smoke':
          // Smoke has no base, only particles
          break;
        case 'sparks':
          this.renderSparksBase(prop);
          break;
        case 'steam':
          // Steam has no base
          break;
        case 'torch':
          this.renderTorchBase(prop);
          break;
      }

      this.ctx.restore();
    });
  }

  renderFireBase(prop) {
    // Fire logs/wood base
    this.ctx.fillStyle = '#3a2410';
    this.ctx.fillRect(-15, 0, 10, 6);
    this.ctx.fillRect(5, 0, 10, 6);
    this.ctx.fillRect(-8, -3, 16, 5);
  }

  renderSparksBase(prop) {
    // Broken wire or source
    this.ctx.strokeStyle = '#666';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(-10, 0);
    this.ctx.lineTo(10, 0);
    this.ctx.stroke();

    // Spark point
    this.ctx.fillStyle = '#ff8800';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 3, 0, Math.PI * 2);
    this.ctx.fill();
  }

  renderTorchBase(prop) {
    // Torch post
    this.ctx.fillStyle = '#4a3520';
    this.ctx.fillRect(-4, -prop.height / 2, 8, prop.height);

    // Torch head
    this.ctx.fillStyle = '#6b4423';
    this.ctx.beginPath();
    this.ctx.arc(0, -prop.height / 2, 8, 0, Math.PI * 2);
    this.ctx.fill();
  }

  renderDynamicPropParticles(particles) {
    if (!particles || particles.length === 0) return;

    // Check performance settings
    if (window.performanceSettings && !window.performanceSettings.shouldRenderParticles()) {
      return;
    }

    particles.forEach(particle => {
      // Viewport culling
      if (!this.camera.isInViewport(particle.x, particle.y, 50)) {
        return;
      }

      this.ctx.save();
      this.ctx.globalAlpha = particle.alpha || 1;

      // Render particle based on color
      if (typeof particle.color === 'string' && particle.color.startsWith('rgba')) {
        // Already has alpha in color
        this.ctx.fillStyle = particle.color;
      } else {
        this.ctx.fillStyle = particle.color || '#fff';
      }

      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.ctx.fill();

      // Add glow for fire/sparks
      if (particle.color === '#ff6600' || particle.color === '#ffaa00' || particle.color === '#ffff00') {
        this.ctx.shadowBlur = 5;
        this.ctx.shadowColor = particle.color;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
      }

      this.ctx.restore();
    });
  }

  renderParticles(particles) {
    // Check performance settings
    if (window.performanceSettings && !window.performanceSettings.shouldRenderParticles()) {
      return; // Skip particles rendering in performance mode
    }

    Object.values(particles).forEach(particle => {
      // Viewport culling
      if (!this.camera.isInViewport(particle.x, particle.y, 50)) {
        return;
      }

      this.ctx.fillStyle = particle.color;
      this.ctx.globalAlpha = 0.7;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    });
  }

  renderPoisonTrails(poisonTrails, now = Date.now()) {
    Object.values(poisonTrails || {}).forEach(trail => {
      // Viewport culling
      if (!this.camera.isInViewport(trail.x, trail.y, trail.radius * 2)) {
        return;
      }

      // Effet de pulsation pour montrer que c'est toxique
      const pulseAmount = Math.sin(now / 300) * 0.1;
      const age = now - trail.createdAt;
      const fadeAmount = Math.max(0, 1 - (age / trail.duration));

      // Cercle extérieur (plus transparent)
      this.ctx.fillStyle = '#22ff22';
      this.ctx.globalAlpha = (0.15 + pulseAmount) * fadeAmount;
      this.ctx.beginPath();
      this.ctx.arc(trail.x, trail.y, trail.radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Cercle intérieur (plus visible)
      this.ctx.fillStyle = '#11dd11';
      this.ctx.globalAlpha = (0.3 + pulseAmount * 0.5) * fadeAmount;
      this.ctx.beginPath();
      this.ctx.arc(trail.x, trail.y, trail.radius * 0.6, 0, Math.PI * 2);
      this.ctx.fill();

      // Contour pulsant
      this.ctx.strokeStyle = '#00ff00';
      this.ctx.lineWidth = 2;
      this.ctx.globalAlpha = (0.4 + pulseAmount) * fadeAmount;
      this.ctx.beginPath();
      this.ctx.arc(trail.x, trail.y, trail.radius, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.globalAlpha = 1;
    });
  }

  renderToxicPools(toxicPools, now = Date.now()) {
    if (!toxicPools || !Array.isArray(toxicPools)) return;

    toxicPools.forEach(pool => {
      // Viewport culling
      if (!this.camera.isInViewport(pool.x, pool.y, pool.radius * 2)) {
        return;
      }

      // Effet de pulsation toxique intense
      const pulseAmount = Math.sin(now / 200) * 0.15;
      const age = now - pool.createdAt;
      const fadeAmount = Math.max(0, 1 - (age / pool.duration));

      this.ctx.save();

      // Cercle extérieur (aura toxique)
      this.ctx.fillStyle = '#00ff00';
      this.ctx.globalAlpha = (0.2 + pulseAmount) * fadeAmount;
      this.ctx.beginPath();
      this.ctx.arc(pool.x, pool.y, pool.radius * 1.2, 0, Math.PI * 2);
      this.ctx.fill();

      // Cercle principal (flaque toxique)
      this.ctx.fillStyle = '#22ff22';
      this.ctx.globalAlpha = (0.4 + pulseAmount * 0.8) * fadeAmount;
      this.ctx.beginPath();
      this.ctx.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Cercle intérieur (centre dense)
      this.ctx.fillStyle = '#00dd00';
      this.ctx.globalAlpha = (0.6 + pulseAmount * 1.2) * fadeAmount;
      this.ctx.beginPath();
      this.ctx.arc(pool.x, pool.y, pool.radius * 0.5, 0, Math.PI * 2);
      this.ctx.fill();

      // Contour pulsant intense
      this.ctx.strokeStyle = '#00ff00';
      this.ctx.lineWidth = 3;
      this.ctx.globalAlpha = (0.6 + pulseAmount * 1.5) * fadeAmount;
      this.ctx.beginPath();
      this.ctx.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
      this.ctx.stroke();

      // Shadow blur pour effet glow
      this.ctx.shadowBlur = 20;
      this.ctx.shadowColor = '#00ff00';
      this.ctx.globalAlpha = (0.3 + pulseAmount) * fadeAmount;
      this.ctx.beginPath();
      this.ctx.arc(pool.x, pool.y, pool.radius * 0.3, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    });
  }

  renderExplosions(explosions, now = Date.now()) {
    Object.values(explosions || {}).forEach(explosion => {
      const age = now - explosion.createdAt;
      const progress = age / explosion.duration;

      // Ne pas afficher si l'explosion est terminée
      if (progress >= 1) return;

      // Viewport culling
      if (!this.camera.isInViewport(explosion.x, explosion.y, explosion.radius * 2)) {
        return;
      }

      // Animation d'expansion
      const currentRadius = explosion.radius * (0.3 + progress * 0.7);

      // Fade out
      const alpha = 1 - progress;

      if (explosion.isRocket) {
        // Explosion de roquette - effet plus intense

        // Cercle extérieur rouge vif
        this.ctx.fillStyle = '#ff0000';
        this.ctx.globalAlpha = alpha * 0.5;
        this.ctx.beginPath();
        this.ctx.arc(explosion.x, explosion.y, currentRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Cercle moyen orange
        this.ctx.fillStyle = '#ff8800';
        this.ctx.globalAlpha = alpha * 0.7;
        this.ctx.beginPath();
        this.ctx.arc(explosion.x, explosion.y, currentRadius * 0.7, 0, Math.PI * 2);
        this.ctx.fill();

        // Cercle intérieur jaune brillant
        this.ctx.fillStyle = '#ffff00';
        this.ctx.globalAlpha = alpha * 0.9;
        this.ctx.beginPath();
        this.ctx.arc(explosion.x, explosion.y, currentRadius * 0.4, 0, Math.PI * 2);
        this.ctx.fill();

        // Centre blanc très brillant
        this.ctx.fillStyle = '#ffffff';
        this.ctx.globalAlpha = alpha;
        this.ctx.beginPath();
        this.ctx.arc(explosion.x, explosion.y, currentRadius * 0.2, 0, Math.PI * 2);
        this.ctx.fill();

        // Contour rouge pulsant
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 3;
        this.ctx.globalAlpha = alpha * 0.8;
        this.ctx.beginPath();
        this.ctx.arc(explosion.x, explosion.y, currentRadius, 0, Math.PI * 2);
        this.ctx.stroke();

        // Rayons de l'explosion (8 rayons)
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = alpha * 0.6;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const rayLength = currentRadius * 1.2;
          this.ctx.beginPath();
          this.ctx.moveTo(explosion.x, explosion.y);
          this.ctx.lineTo(
            explosion.x + Math.cos(angle) * rayLength,
            explosion.y + Math.sin(angle) * rayLength
          );
          this.ctx.stroke();
        }

      } else {
        // Explosion normale
        this.ctx.fillStyle = '#ff8800';
        this.ctx.globalAlpha = alpha * 0.6;
        this.ctx.beginPath();
        this.ctx.arc(explosion.x, explosion.y, currentRadius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#ffff00';
        this.ctx.globalAlpha = alpha * 0.8;
        this.ctx.beginPath();
        this.ctx.arc(explosion.x, explosion.y, currentRadius * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.globalAlpha = 1;
    });
  }

  renderBullets(bullets, config) {
    Object.values(bullets).forEach(bullet => {
      // Viewport culling
      if (!this.camera.isInViewport(bullet.x, bullet.y, 50)) {
        return;
      }

      const bulletSize = bullet.size || config.BULLET_SIZE;
      this.ctx.fillStyle = bullet.color || '#ffff00';
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = bullet.color || '#ffff00';
      this.ctx.beginPath();
      this.ctx.arc(bullet.x, bullet.y, bulletSize, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    });
  }

  drawZombieSprite(zombie, timestamp) {
    this.ctx.save();
    this.ctx.translate(zombie.x, zombie.y);

    // Animation de marche (oscillation des bras et jambes)
    const walkCycle = Math.sin(timestamp / 200 + zombie.id * 100) * 0.2;
    const scale = zombie.isBoss ? 1.5 : 1;
    const baseSize = zombie.size / 25; // Normaliser par rapport à la taille par défaut (25)

    // Corps
    this.ctx.fillStyle = zombie.color;
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = zombie.isBoss ? 3 : 1.5;

    // Jambes (arrière-plan)
    const legWidth = 6 * baseSize * scale;
    const legHeight = 12 * baseSize * scale;
    const legSpacing = 8 * baseSize * scale;

    // Jambe gauche
    this.ctx.save();
    this.ctx.translate(-legSpacing / 2, 10 * baseSize * scale);
    this.ctx.rotate(walkCycle);
    this.ctx.fillRect(-legWidth / 2, 0, legWidth, legHeight);
    this.ctx.strokeRect(-legWidth / 2, 0, legWidth, legHeight);
    this.ctx.restore();

    // Jambe droite
    this.ctx.save();
    this.ctx.translate(legSpacing / 2, 10 * baseSize * scale);
    this.ctx.rotate(-walkCycle);
    this.ctx.fillRect(-legWidth / 2, 0, legWidth, legHeight);
    this.ctx.strokeRect(-legWidth / 2, 0, legWidth, legHeight);
    this.ctx.restore();

    // Corps principal (torse) - rectangle simple pour compatibilité
    const bodyWidth = 18 * baseSize * scale;
    const bodyHeight = 20 * baseSize * scale;
    this.ctx.fillRect(-bodyWidth / 2, -5 * baseSize * scale, bodyWidth, bodyHeight);
    this.ctx.strokeRect(-bodyWidth / 2, -5 * baseSize * scale, bodyWidth, bodyHeight);

    // Bras
    const armWidth = 5 * baseSize * scale;
    const armHeight = 14 * baseSize * scale;
    const armOffset = bodyWidth / 2 + 2 * baseSize * scale;

    // Bras gauche
    this.ctx.save();
    this.ctx.translate(-armOffset, 0);
    this.ctx.rotate(-walkCycle * 1.5);
    this.ctx.fillRect(-armWidth / 2, 0, armWidth, armHeight);
    this.ctx.strokeRect(-armWidth / 2, 0, armWidth, armHeight);
    this.ctx.restore();

    // Bras droit
    this.ctx.save();
    this.ctx.translate(armOffset, 0);
    this.ctx.rotate(walkCycle * 1.5);
    this.ctx.fillRect(-armWidth / 2, 0, armWidth, armHeight);
    this.ctx.strokeRect(-armWidth / 2, 0, armWidth, armHeight);
    this.ctx.restore();

    // Tête
    const headRadius = 10 * baseSize * scale;
    this.ctx.beginPath();
    this.ctx.arc(0, -10 * baseSize * scale, headRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Yeux (rouges effrayants)
    const eyeSize = zombie.isBoss ? 4 * scale : 2.5 * scale;
    const eyeOffset = 4 * baseSize * scale;
    this.ctx.fillStyle = '#ff0000';
    this.ctx.shadowBlur = 5;
    this.ctx.shadowColor = '#ff0000';
    this.ctx.beginPath();
    this.ctx.arc(-eyeOffset, -12 * baseSize * scale, eyeSize, 0, Math.PI * 2);
    this.ctx.arc(eyeOffset, -12 * baseSize * scale, eyeSize, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    // Bouche (grimace)
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(0, -6 * baseSize * scale, 4 * baseSize * scale, 0.2, Math.PI - 0.2);
    this.ctx.stroke();

    // Détails spéciaux selon le type
    if (zombie.type === 'tank') {
      // Armure sur les épaules et casque
      this.ctx.fillStyle = '#444';
      this.ctx.strokeStyle = '#222';
      this.ctx.lineWidth = 1;
      // Épaulières
      this.ctx.fillRect(-bodyWidth / 2 - 4, -3 * baseSize * scale, 8, 10);
      this.ctx.strokeRect(-bodyWidth / 2 - 4, -3 * baseSize * scale, 8, 10);
      this.ctx.fillRect(bodyWidth / 2 - 4, -3 * baseSize * scale, 8, 10);
      this.ctx.strokeRect(bodyWidth / 2 - 4, -3 * baseSize * scale, 8, 10);
      // Casque
      this.ctx.fillRect(-headRadius * 0.8, -16 * baseSize * scale, headRadius * 1.6, 4);
      this.ctx.strokeRect(-headRadius * 0.8, -16 * baseSize * scale, headRadius * 1.6, 4);
    } else if (zombie.type === 'fast') {
      // Traits de vitesse et posture penchée
      this.ctx.strokeStyle = zombie.color;
      this.ctx.lineWidth = 2;
      this.ctx.globalAlpha = 0.5;
      for (let i = 0; i < 3; i++) {
        this.ctx.beginPath();
        this.ctx.moveTo(-bodyWidth / 2 - 5 - i * 4, -5 + i * 4);
        this.ctx.lineTo(-bodyWidth / 2 - 12 - i * 4, -5 + i * 4);
        this.ctx.stroke();
      }
      this.ctx.globalAlpha = 1;
    } else if (zombie.type === 'explosive') {
      // Taches/veines explosives sur le corps
      this.ctx.strokeStyle = '#ff00ff';
      this.ctx.lineWidth = 2;
      this.ctx.globalAlpha = 0.6 + Math.sin(timestamp / 100) * 0.3; // Pulsation
      this.ctx.beginPath();
      this.ctx.moveTo(0, -5 * baseSize * scale);
      this.ctx.lineTo(-5, 0);
      this.ctx.moveTo(0, -5 * baseSize * scale);
      this.ctx.lineTo(5, 0);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
    } else if (zombie.type === 'healer') {
      // Aura de soin
      this.ctx.strokeStyle = '#00ffff';
      this.ctx.lineWidth = 1.5;
      this.ctx.globalAlpha = 0.4;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, headRadius + 5, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
    } else if (zombie.type === 'slower') {
      // Aura ralentissante violette
      this.ctx.strokeStyle = '#8800ff';
      this.ctx.lineWidth = 1.5;
      this.ctx.globalAlpha = 0.3;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, headRadius + 3, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
    } else if (zombie.type === 'poison') {
      // Aura toxique verte pulsante
      const pulseAmount = Math.sin(timestamp / 200) * 0.15;
      this.ctx.strokeStyle = '#22ff22';
      this.ctx.lineWidth = 2;
      this.ctx.globalAlpha = 0.4 + pulseAmount;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, headRadius + 5, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.globalAlpha = 0.25 + pulseAmount;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, headRadius + 8, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;

      // Gouttes de poison sur le corps
      this.ctx.fillStyle = '#00aa00';
      const dropPositions = [
        { x: -bodyWidth / 3, y: bodyHeight / 4 },
        { x: bodyWidth / 4, y: bodyHeight / 3 },
        { x: 0, y: -bodyHeight / 4 }
      ];
      dropPositions.forEach(pos => {
        this.ctx.beginPath();
        this.ctx.ellipse(pos.x, pos.y, 2 * scale, 3 * scale, 0, 0, Math.PI * 2);
        this.ctx.fill();
      });
    } else if (zombie.type === 'shooter') {
      // Fusil/Arme sur le zombie tireur
      this.ctx.fillStyle = '#333';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 1;

      // Arme à feu (fusil) - en position de tir
      const gunLength = 15 * baseSize * scale;
      const gunWidth = 3 * baseSize * scale;

      // Position de l'arme (bras droit)
      this.ctx.save();
      this.ctx.translate(armOffset, 8 * baseSize * scale);

      // Canon
      this.ctx.fillRect(0, -gunWidth / 2, gunLength, gunWidth);
      this.ctx.strokeRect(0, -gunWidth / 2, gunLength, gunWidth);

      // Poignée
      this.ctx.fillRect(-3 * baseSize * scale, -gunWidth / 2, 5 * baseSize * scale, 8 * baseSize * scale);
      this.ctx.strokeRect(-3 * baseSize * scale, -gunWidth / 2, 5 * baseSize * scale, 8 * baseSize * scale);

      // Point rouge sur le canon (visée laser)
      this.ctx.fillStyle = '#ff3300';
      this.ctx.beginPath();
      this.ctx.arc(gunLength, 0, 2 * scale, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();

      // Bandana/Bandeau de munitions
      this.ctx.strokeStyle = '#ffaa00';
      this.ctx.lineWidth = 2;
      this.ctx.globalAlpha = 0.8;
      this.ctx.beginPath();
      this.ctx.moveTo(-bodyWidth / 2, 2 * baseSize * scale);
      this.ctx.lineTo(bodyWidth / 2, 2 * baseSize * scale);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
    } else if (zombie.type === 'teleporter') {
      // Aura violette électrique pulsante pour le téléporteur
      const pulseAmount = Math.sin(Date.now() / 150) * 0.2;
      this.ctx.strokeStyle = '#aa00ff';
      this.ctx.lineWidth = 2;
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = '#aa00ff';
      this.ctx.globalAlpha = 0.5 + pulseAmount;

      // Cercle d'énergie principal
      this.ctx.beginPath();
      this.ctx.arc(0, 0, headRadius + 8, 0, Math.PI * 2);
      this.ctx.stroke();

      // Cercle d'énergie secondaire
      this.ctx.globalAlpha = 0.3 + pulseAmount;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, headRadius + 12, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = 1;

      // Symbole éclair sur le torse
      this.ctx.strokeStyle = '#ff00ff';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, -5 * baseSize * scale);
      this.ctx.lineTo(-3, 0);
      this.ctx.lineTo(0, 0);
      this.ctx.lineTo(-2, 5 * baseSize * scale);
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(3, 2 * baseSize * scale);
      this.ctx.stroke();
    } else if (zombie.type === 'summoner') {
      // Aura mystique bleue/cyan pour l'invocateur
      const pulseAmount = Math.sin(Date.now() / 250) * 0.2;
      this.ctx.strokeStyle = '#00ddff';
      this.ctx.lineWidth = 2;
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = '#00ddff';
      this.ctx.globalAlpha = 0.4 + pulseAmount;

      // Cercles d'invocation
      this.ctx.beginPath();
      this.ctx.arc(0, 0, headRadius + 6, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.arc(0, 0, headRadius + 10, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = 1;

      // Runes mystiques sur le corps
      this.ctx.strokeStyle = '#00ffff';
      this.ctx.lineWidth = 1.5;
      const runeSize = 3 * baseSize * scale;

      // Rune 1 (pentagone)
      this.ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const x = Math.cos(angle) * runeSize;
        const y = Math.sin(angle) * runeSize + 3 * baseSize * scale;
        if (i === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.closePath();
      this.ctx.stroke();
    } else if (zombie.type === 'shielded') {
      // Bouclier frontal argenté
      this.ctx.save();

      // Le bouclier fait face au joueur (facingAngle)
      const shieldAngle = zombie.facingAngle || 0;
      this.ctx.rotate(shieldAngle);

      // Bouclier
      this.ctx.fillStyle = '#c0c0c0';
      this.ctx.strokeStyle = '#808080';
      this.ctx.lineWidth = 2;

      const shieldWidth = 15 * baseSize * scale;
      const shieldHeight = 25 * baseSize * scale;

      // Corps du bouclier
      this.ctx.beginPath();
      this.ctx.moveTo(0, -shieldHeight / 2);
      this.ctx.lineTo(shieldWidth, -shieldHeight / 4);
      this.ctx.lineTo(shieldWidth, shieldHeight / 4);
      this.ctx.lineTo(0, shieldHeight / 2);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      // Reflet métallique sur le bouclier
      this.ctx.fillStyle = '#ffffff';
      this.ctx.globalAlpha = 0.4;
      this.ctx.beginPath();
      this.ctx.arc(shieldWidth * 0.6, -shieldHeight / 6, 4 * scale, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;

      // Bossage central
      this.ctx.fillStyle = '#a0a0a0';
      this.ctx.beginPath();
      this.ctx.arc(shieldWidth * 0.5, 0, 3 * scale, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.restore();
    } else if (zombie.type === 'minion') {
      // Mini aura sombre pour les minions
      this.ctx.strokeStyle = '#660066';
      this.ctx.lineWidth = 1;
      this.ctx.globalAlpha = 0.5;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, headRadius + 2, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;

      // Marque d'invocation (petit symbole)
      this.ctx.fillStyle = '#660066';
      this.ctx.font = `${6 * scale}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('∞', 0, -10 * baseSize * scale);
    } else if (zombie.type === 'bossCharnier') {
      // Boss RAIIVY - Nécromancien avec aura de mort
      this.ctx.save();

      // Aura de mort noire pulsante
      const pulseAmount = Math.sin(Date.now() / 300) * 0.2;
      this.ctx.strokeStyle = '#1a0033';
      this.ctx.lineWidth = 4;
      this.ctx.shadowBlur = 25;
      this.ctx.shadowColor = '#1a0033';
      this.ctx.globalAlpha = 0.6 + pulseAmount;

      for (let i = 0; i < 3; i++) {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, headRadius + 20 + i * 10, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = 1;

      // Crânes flottants autour
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = `${12 * scale}px Arial`;
      const skullPositions = [
        { angle: 0, radius: headRadius + 25 },
        { angle: Math.PI * 0.5, radius: headRadius + 25 },
        { angle: Math.PI, radius: headRadius + 25 },
        { angle: Math.PI * 1.5, radius: headRadius + 25 }
      ];

      skullPositions.forEach(pos => {
        const x = Math.cos(pos.angle + Date.now() / 1000) * pos.radius;
        const y = Math.sin(pos.angle + Date.now() / 1000) * pos.radius;
        this.ctx.fillText('💀', x, y);
      });

      this.ctx.restore();
    } else if (zombie.type === 'bossInfect') {
      // Boss SORENZA - Toxic master avec aura verte toxique
      this.ctx.save();

      // Aura toxique super épaisse
      const pulseAmount = Math.sin(Date.now() / 250) * 0.2;
      this.ctx.strokeStyle = '#00ff00';
      this.ctx.lineWidth = 5;
      this.ctx.shadowBlur = 30;
      this.ctx.shadowColor = '#00ff00';
      this.ctx.globalAlpha = 0.7 + pulseAmount;

      for (let i = 0; i < 4; i++) {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, headRadius + 15 + i * 8, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = 1;

      // Symbole biohazard sur le torse
      this.ctx.fillStyle = '#00ff00';
      this.ctx.font = `${15 * scale}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('☣️', 0, 5 * baseSize * scale);

      this.ctx.restore();
    } else if (zombie.type === 'bossColosse') {
      // Boss HAIER - Tank massif avec armure lourde
      this.ctx.save();

      // Aura rouge de rage (plus intense si enragé)
      const isEnraged = zombie.isEnraged || (zombie.health / zombie.maxHealth) < 0.3;
      const pulseAmount = Math.sin(Date.now() / (isEnraged ? 100 : 300)) * 0.3;
      this.ctx.strokeStyle = isEnraged ? '#ff0000' : '#ff6600';
      this.ctx.lineWidth = isEnraged ? 6 : 4;
      this.ctx.shadowBlur = isEnraged ? 35 : 20;
      this.ctx.shadowColor = isEnraged ? '#ff0000' : '#ff6600';
      this.ctx.globalAlpha = (isEnraged ? 0.8 : 0.5) + pulseAmount;

      for (let i = 0; i < 3; i++) {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, headRadius + 18 + i * 12, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = 1;

      // Armure renforcée sur tout le corps
      this.ctx.fillStyle = '#333333';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 2;

      // Plaques d'armure multiples
      const plateSize = 6 * scale;
      const positions = [
        { x: -bodyWidth / 3, y: 0 },
        { x: bodyWidth / 3, y: 0 },
        { x: 0, y: -bodyHeight / 4 },
        { x: 0, y: bodyHeight / 4 }
      ];

      positions.forEach(pos => {
        this.ctx.fillRect(pos.x - plateSize / 2, pos.y - plateSize / 2, plateSize, plateSize);
        this.ctx.strokeRect(pos.x - plateSize / 2, pos.y - plateSize / 2, plateSize, plateSize);
      });

      // Symbole de force
      this.ctx.fillStyle = isEnraged ? '#ff0000' : '#ffaa00';
      this.ctx.font = `${15 * scale}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('💪', 0, 5 * baseSize * scale);

      this.ctx.restore();
    } else if (zombie.type === 'bossRoi') {
      // Boss KUROI TO SUTA - Couronne dorée et aura royale
      this.ctx.save();

      // Aura dorée royale multicouche
      const pulseAmount = Math.sin(Date.now() / 200) * 0.15;
      this.ctx.strokeStyle = '#ffd700';
      this.ctx.lineWidth = 5;
      this.ctx.shadowBlur = 30;
      this.ctx.shadowColor = '#ffd700';
      this.ctx.globalAlpha = 0.7 + pulseAmount;

      for (let i = 0; i < 4; i++) {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, headRadius + 20 + i * 10, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // Aura violette de téléportation (phase 2+)
      if (zombie.phase >= 2) {
        this.ctx.strokeStyle = '#aa00ff';
        this.ctx.globalAlpha = 0.5 + pulseAmount;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, headRadius + 30, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = 1;

      // Grande couronne dorée
      this.ctx.fillStyle = '#ffd700';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();

      const crownPoints = [
        { x: -12 * scale, y: -20 * baseSize * scale },
        { x: -10 * scale, y: -26 * baseSize * scale },
        { x: -6 * scale, y: -20 * baseSize * scale },
        { x: -3 * scale, y: -28 * baseSize * scale },
        { x: 0, y: -20 * baseSize * scale },
        { x: 3 * scale, y: -28 * baseSize * scale },
        { x: 6 * scale, y: -20 * baseSize * scale },
        { x: 10 * scale, y: -26 * baseSize * scale },
        { x: 12 * scale, y: -20 * baseSize * scale }
      ];

      crownPoints.forEach((point, i) => {
        if (i === 0) this.ctx.moveTo(point.x, point.y);
        else this.ctx.lineTo(point.x, point.y);
      });

      this.ctx.fill();
      this.ctx.stroke();

      // Symbole royal
      this.ctx.fillStyle = '#ffd700';
      this.ctx.font = `${15 * scale}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('👑', 0, 5 * baseSize * scale);

      this.ctx.restore();
    } else if (zombie.type === 'bossOmega') {
      // Boss MORGANNITO - Boss final ultime avec toutes les auras
      this.ctx.save();

      // Auras multiples superposées (noir, violet, vert, rouge)
      const pulseAmount = Math.sin(Date.now() / 150) * 0.2;
      const phase = zombie.phase || 1;

      // Aura noire (nécro)
      this.ctx.strokeStyle = '#1a0033';
      this.ctx.lineWidth = 6;
      this.ctx.shadowBlur = 40;
      this.ctx.shadowColor = '#1a0033';
      this.ctx.globalAlpha = 0.8 + pulseAmount;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, headRadius + 35, 0, Math.PI * 2);
      this.ctx.stroke();

      // Aura violette (téléportation) - phase 2+
      if (phase >= 2) {
        this.ctx.strokeStyle = '#aa00ff';
        this.ctx.shadowColor = '#aa00ff';
        this.ctx.globalAlpha = 0.7 + pulseAmount;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, headRadius + 30, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // Aura verte toxique - phase 3+
      if (phase >= 3) {
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.shadowColor = '#00ff00';
        this.ctx.globalAlpha = 0.7 + pulseAmount;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, headRadius + 25, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // Aura rouge laser - phase 4
      if (phase >= 4) {
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.shadowColor = '#ff0000';
        this.ctx.globalAlpha = 0.9 + pulseAmount;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, headRadius + 20, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = 1;

      // Symbole Omega géant
      this.ctx.fillStyle = '#ffffff';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 3;
      this.ctx.font = `bold ${20 * scale}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.strokeText('Ω', 0, 5 * baseSize * scale);
      this.ctx.fillText('Ω', 0, 5 * baseSize * scale);

      // Étoiles tournantes autour
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = `${10 * scale}px Arial`;
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI * 2) / 6 + Date.now() / 1000;
        const x = Math.cos(angle) * (headRadius + 40);
        const y = Math.sin(angle) * (headRadius + 40);
        this.ctx.fillText('★', x, y);
      }

      this.ctx.restore();
    } else if (zombie.isBoss) {
      // Boss normal générique (autres vagues)
      this.ctx.fillStyle = '#ff0000';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      // Points de la couronne
      this.ctx.beginPath();
      this.ctx.moveTo(-8 * scale, -18 * baseSize * scale);
      this.ctx.lineTo(-6 * scale, -22 * baseSize * scale);
      this.ctx.lineTo(-3 * scale, -18 * baseSize * scale);
      this.ctx.lineTo(0, -24 * baseSize * scale);
      this.ctx.lineTo(3 * scale, -18 * baseSize * scale);
      this.ctx.lineTo(6 * scale, -22 * baseSize * scale);
      this.ctx.lineTo(8 * scale, -18 * baseSize * scale);
      this.ctx.fill();
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  renderZombies(zombies, timestamp = performance.now()) {
    Object.values(zombies).forEach(zombie => {
      // Viewport culling - ne rendre que les zombies visibles
      // Augmenter la marge pour les boss avec leurs grandes auras (jusqu'à 80px d'aura)
      const cullMargin = zombie.isBoss ? zombie.size * 4 : zombie.size * 2;
      if (!this.camera.isInViewport(zombie.x, zombie.y, cullMargin)) {
        return;
      }

      // Dessiner le sprite du zombie
      this.drawZombieSprite(zombie, timestamp);

      // Health bar
      if (zombie.maxHealth) {
        const healthPercent = zombie.health / zombie.maxHealth;
        const barWidth = zombie.size * 1.6;
        const barY = zombie.y - zombie.size - 10;

        this.ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
        this.ctx.fillRect(zombie.x - barWidth / 2, barY, barWidth * healthPercent, 5);
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(zombie.x - barWidth / 2, barY, barWidth, 5);
      }

      // Elite zombie indicator (golden glow)
      if (zombie.isElite) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.4 + Math.sin(timestamp / 200) * 0.2;
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = '#ffd700';
        this.ctx.strokeStyle = '#ffd700';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(zombie.x, zombie.y, zombie.size + 15, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();

        // Elite crown
        this.ctx.fillStyle = '#ffd700';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.strokeText('👑', zombie.x, zombie.y - zombie.size - 35);
        this.ctx.fillText('👑', zombie.x, zombie.y - zombie.size - 35);
      }

      // Boss label
      if (zombie.isBoss) {
        const bossName = CONSTANTS.BOSS_NAMES[zombie.type] || 'BOSS';
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 3;
        this.ctx.strokeText(bossName, zombie.x, zombie.y - zombie.size - 25);
        this.ctx.fillText(bossName, zombie.x, zombie.y - zombie.size - 25);
      }

      // Special zombie indicators
      this.renderZombieSpecialIndicator(zombie);
    });
  }

  renderZombieSpecialIndicator(zombie) {
    this.ctx.font = 'bold 16px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    if (zombie.type === 'explosive') {
      this.ctx.fillStyle = '#fff';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.strokeText('💣', zombie.x, zombie.y);
      this.ctx.fillText('💣', zombie.x, zombie.y);
    } else if (zombie.type === 'healer') {
      this.ctx.save();
      this.ctx.globalAlpha = 0.3;
      this.ctx.strokeStyle = '#00ffff';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(zombie.x, zombie.y, zombie.size + 10 + Math.sin(Date.now() / 200) * 5, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();

      this.ctx.fillStyle = '#fff';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.strokeText('+', zombie.x, zombie.y);
      this.ctx.fillText('+', zombie.x, zombie.y);
    } else if (zombie.type === 'slower') {
      this.ctx.save();
      this.ctx.globalAlpha = 0.3;
      this.ctx.strokeStyle = '#8800ff';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(zombie.x, zombie.y, zombie.size + 8, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();

      this.ctx.fillStyle = '#fff';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.strokeText('⏱', zombie.x, zombie.y);
      this.ctx.fillText('⏱', zombie.x, zombie.y);
    } else if (zombie.type === 'poison') {
      this.ctx.save();
      this.ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 200) * 0.15;
      this.ctx.strokeStyle = '#22ff22';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(zombie.x, zombie.y, zombie.size + 10, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();

      this.ctx.fillStyle = '#22ff22';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.strokeText('☠', zombie.x, zombie.y);
      this.ctx.fillText('☠', zombie.x, zombie.y);
    } else if (zombie.type === 'teleporter') {
      // Purple portal effect
      this.ctx.save();
      this.ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 150) * 0.2;
      this.ctx.strokeStyle = '#9900ff';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(zombie.x, zombie.y, zombie.size + 12, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();

      this.ctx.fillStyle = '#9900ff';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.font = 'bold 18px Arial';
      this.ctx.strokeText('⚡', zombie.x, zombie.y);
      this.ctx.fillText('⚡', zombie.x, zombie.y);
    } else if (zombie.type === 'summoner') {
      // Dark purple magic aura
      this.ctx.save();
      this.ctx.globalAlpha = 0.35 + Math.sin(Date.now() / 180) * 0.15;
      this.ctx.strokeStyle = '#cc00ff';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(zombie.x, zombie.y, zombie.size + 14 + Math.sin(Date.now() / 250) * 4, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();

      this.ctx.fillStyle = '#cc00ff';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.font = 'bold 18px Arial';
      this.ctx.strokeText('🔮', zombie.x, zombie.y);
      this.ctx.fillText('🔮', zombie.x, zombie.y);

      // Show minion count
      if (zombie.minionCount > 0) {
        this.ctx.font = 'bold 10px Arial';
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeText(`${zombie.minionCount}`, zombie.x + zombie.size * 0.6, zombie.y - zombie.size * 0.6);
        this.ctx.fillText(`${zombie.minionCount}`, zombie.x + zombie.size * 0.6, zombie.y - zombie.size * 0.6);
      }
    } else if (zombie.type === 'shielded') {
      // Draw shield indicator (arc in facing direction)
      if (zombie.facingAngle !== null && zombie.facingAngle !== undefined) {
        this.ctx.save();
        this.ctx.translate(zombie.x, zombie.y);
        this.ctx.rotate(zombie.facingAngle);

        // Shield arc (90 degrees in front)
        this.ctx.strokeStyle = '#00ccff';
        this.ctx.fillStyle = 'rgba(0, 204, 255, 0.3)';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        const shieldRadius = zombie.size + 10;
        this.ctx.arc(0, 0, shieldRadius, -Math.PI / 4, Math.PI / 4);
        this.ctx.lineTo(0, 0);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.restore();
      }

      // Shield icon
      this.ctx.fillStyle = '#00ccff';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.font = 'bold 18px Arial';
      this.ctx.strokeText('🛡️', zombie.x, zombie.y);
      this.ctx.fillText('🛡️', zombie.x, zombie.y);
    } else if (zombie.type === 'minion') {
      // Small indicator for minions
      this.ctx.save();
      this.ctx.globalAlpha = 0.4;
      this.ctx.strokeStyle = '#ff99ff';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(zombie.x, zombie.y, zombie.size + 5, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    } else if (zombie.type === 'berserker') {
      // Berserker rage indicator
      if (zombie.isExtremeRaged) {
        // Extreme rage - pulsing red aura with flames
        this.ctx.save();
        this.ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 100) * 0.3;
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(zombie.x, zombie.y, zombie.size + 15 + Math.sin(Date.now() / 150) * 5, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();

        // Inner flame effect
        this.ctx.save();
        this.ctx.globalAlpha = 0.4;
        this.ctx.strokeStyle = '#ff4400';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(zombie.x, zombie.y, zombie.size + 8, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();

        // Rage icon - double swords for extreme rage
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.font = 'bold 20px Arial';
        this.ctx.strokeText('⚔️', zombie.x, zombie.y);
        this.ctx.fillText('⚔️', zombie.x, zombie.y);
      } else if (zombie.isRaged) {
        // Normal rage - orange aura
        this.ctx.save();
        this.ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 180) * 0.2;
        this.ctx.strokeStyle = '#ff6600';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(zombie.x, zombie.y, zombie.size + 10 + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();

        // Rage icon
        this.ctx.fillStyle = '#ff6600';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.font = 'bold 18px Arial';
        this.ctx.strokeText('💢', zombie.x, zombie.y);
        this.ctx.fillText('💢', zombie.x, zombie.y);
      } else {
        // Not enraged - just a subtle indicator
        this.ctx.fillStyle = '#ff6600';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.font = 'bold 16px Arial';
        this.ctx.strokeText('💪', zombie.x, zombie.y);
        this.ctx.fillText('💪', zombie.x, zombie.y);
      }

      // Dash trail effect
      if (zombie.isDashing) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.5;
        this.ctx.strokeStyle = '#ff4400';
        this.ctx.lineWidth = zombie.size;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        const dashTrailLength = 40;
        const trailX = zombie.x - Math.cos(zombie.dashAngle || 0) * dashTrailLength;
        const trailY = zombie.y - Math.sin(zombie.dashAngle || 0) * dashTrailLength;
        this.ctx.moveTo(trailX, trailY);
        this.ctx.lineTo(zombie.x, zombie.y);
        this.ctx.stroke();
        this.ctx.restore();
      }
    }

    // === BOSS SPÉCIAUX ===
    else if (zombie.type === 'bossCharnier') {
      // Le Charnier - Aura rouge sang pulsante
      this.ctx.save();
      this.ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 150) * 0.2;
      this.ctx.strokeStyle = '#8b0000';
      this.ctx.lineWidth = 5;
      this.ctx.beginPath();
      this.ctx.arc(zombie.x, zombie.y, zombie.size + 20, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();

      // Icône crânes
      this.ctx.fillStyle = '#fff';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.font = 'bold 24px Arial';
      this.ctx.strokeText('💀', zombie.x, zombie.y);
      this.ctx.fillText('💀', zombie.x, zombie.y);

      // Nom du boss
      this.ctx.font = 'bold 16px Arial';
      this.ctx.fillStyle = '#8b0000';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 3;
      this.ctx.strokeText('RAIIVY', zombie.x, zombie.y - zombie.size - 40);
      this.ctx.fillText('RAIIVY', zombie.x, zombie.y - zombie.size - 40);
    }

    else if (zombie.type === 'bossInfect') {
      // L'Infect - Aura toxique verte
      this.ctx.save();
      this.ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 200) * 0.2;
      this.ctx.strokeStyle = '#00ff00';
      this.ctx.lineWidth = 5;
      this.ctx.beginPath();
      this.ctx.arc(zombie.x, zombie.y, zombie.size + 25, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();

      // Icône biohazard
      this.ctx.fillStyle = '#00ff00';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.font = 'bold 26px Arial';
      this.ctx.strokeText('☣️', zombie.x, zombie.y);
      this.ctx.fillText('☣️', zombie.x, zombie.y);

      // Nom du boss
      this.ctx.font = 'bold 16px Arial';
      this.ctx.fillStyle = '#00ff00';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 3;
      this.ctx.strokeText('SORENZA', zombie.x, zombie.y - zombie.size - 40);
      this.ctx.fillText('SORENZA', zombie.x, zombie.y - zombie.size - 40);
    }

    else if (zombie.type === 'bossColosse') {
      // Le Colosse - Aura orange/rouge selon enrage
      const isEnraged = zombie.isEnraged;
      const auraColor = isEnraged ? '#ff0000' : '#ff4500';

      this.ctx.save();
      this.ctx.globalAlpha = 0.5 + Math.sin(Date.now() / (isEnraged ? 100 : 180)) * 0.3;
      this.ctx.strokeStyle = auraColor;
      this.ctx.lineWidth = isEnraged ? 8 : 5;
      this.ctx.beginPath();
      this.ctx.arc(zombie.x, zombie.y, zombie.size + (isEnraged ? 30 : 20), 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();

      // Icône puissance
      this.ctx.fillStyle = auraColor;
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.font = 'bold 28px Arial';
      this.ctx.strokeText(isEnraged ? '💢' : '💪', zombie.x, zombie.y);
      this.ctx.fillText(isEnraged ? '💢' : '💪', zombie.x, zombie.y);

      // Nom du boss
      this.ctx.font = 'bold 16px Arial';
      this.ctx.fillStyle = auraColor;
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 3;
      const name = isEnraged ? 'HAIER ENRAGÉ' : 'HAIER';
      this.ctx.strokeText(name, zombie.x, zombie.y - zombie.size - 40);
      this.ctx.fillText(name, zombie.x, zombie.y - zombie.size - 40);
    }

    else if (zombie.type === 'bossRoi') {
      // Roi Zombie - Aura dorée avec phase
      this.ctx.save();
      this.ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 120) * 0.3;
      this.ctx.strokeStyle = '#ffd700';
      this.ctx.lineWidth = 6;
      this.ctx.beginPath();
      this.ctx.arc(zombie.x, zombie.y, zombie.size + 25, 0, Math.PI * 2);
      this.ctx.stroke();

      // Deuxième aura pour phase 2+
      if (zombie.phase >= 2) {
        this.ctx.strokeStyle = '#ffaa00';
        this.ctx.beginPath();
        this.ctx.arc(zombie.x, zombie.y, zombie.size + 35, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      this.ctx.restore();

      // Icône couronne royale
      this.ctx.fillStyle = '#ffd700';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.font = 'bold 30px Arial';
      this.ctx.strokeText('👑', zombie.x, zombie.y);
      this.ctx.fillText('👑', zombie.x, zombie.y);

      // Nom du boss avec phase
      this.ctx.font = 'bold 16px Arial';
      this.ctx.fillStyle = '#ffd700';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 3;
      const phaseName = `KUROI TO SUTA (Phase ${zombie.phase || 1})`;
      this.ctx.strokeText(phaseName, zombie.x, zombie.y - zombie.size - 40);
      this.ctx.fillText(phaseName, zombie.x, zombie.y - zombie.size - 40);
    }

    else if (zombie.type === 'bossOmega') {
      // Omega - Aura multicolore selon phase
      const phaseColors = ['#ff00ff', '#ff0088', '#8800ff', '#ff0000'];
      const currentColor = phaseColors[(zombie.phase || 1) - 1];

      this.ctx.save();
      this.ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 80) * 0.4;
      this.ctx.strokeStyle = currentColor;
      this.ctx.lineWidth = 8;
      this.ctx.beginPath();
      this.ctx.arc(zombie.x, zombie.y, zombie.size + 30, 0, Math.PI * 2);
      this.ctx.stroke();

      // Auras multiples pour phases avancées
      if (zombie.phase >= 2) {
        this.ctx.strokeStyle = '#ff00ff';
        this.ctx.lineWidth = 5;
        this.ctx.beginPath();
        this.ctx.arc(zombie.x, zombie.y, zombie.size + 45, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      if (zombie.phase >= 3) {
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(zombie.x, zombie.y, zombie.size + 60, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      this.ctx.restore();

      // Icône omega
      this.ctx.fillStyle = currentColor;
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 3;
      this.ctx.font = 'bold 32px Arial';
      this.ctx.strokeText('Ω', zombie.x, zombie.y + 5);
      this.ctx.fillText('Ω', zombie.x, zombie.y + 5);

      // Nom du boss avec phase
      this.ctx.font = 'bold 18px Arial';
      this.ctx.fillStyle = currentColor;
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 4;
      const omegaName = `MORGANNITO (Phase ${zombie.phase || 1}/4)`;
      this.ctx.strokeText(omegaName, zombie.x, zombie.y - zombie.size - 40);
      this.ctx.fillText(omegaName, zombie.x, zombie.y - zombie.size - 40);
    }
  }

  renderPlayerNameBubble(x, y, text, isCurrentPlayer, offsetY = -40) {
    // Measure text to calculate bubble size
    this.ctx.font = 'bold 14px Arial';
    const textMetrics = this.ctx.measureText(text);
    const textWidth = textMetrics.width;

    // Bubble dimensions
    const paddingX = 12;
    const paddingY = 8;
    const bubbleWidth = textWidth + paddingX * 2;
    const bubbleHeight = 24;
    const borderRadius = 12;

    // Bubble position (centered above player)
    const bubbleX = x - bubbleWidth / 2;
    const bubbleY = y + offsetY - bubbleHeight / 2;

    // Draw bubble background with rounded corners (manual path for compatibility)
    this.ctx.fillStyle = isCurrentPlayer ? 'rgba(0, 136, 255, 0.9)' : 'rgba(255, 136, 0, 0.9)';
    this.ctx.beginPath();
    this.ctx.moveTo(bubbleX + borderRadius, bubbleY);
    this.ctx.lineTo(bubbleX + bubbleWidth - borderRadius, bubbleY);
    this.ctx.arcTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + borderRadius, borderRadius);
    this.ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - borderRadius);
    this.ctx.arcTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight, bubbleX + bubbleWidth - borderRadius, bubbleY + bubbleHeight, borderRadius);
    this.ctx.lineTo(bubbleX + borderRadius, bubbleY + bubbleHeight);
    this.ctx.arcTo(bubbleX, bubbleY + bubbleHeight, bubbleX, bubbleY + bubbleHeight - borderRadius, borderRadius);
    this.ctx.lineTo(bubbleX, bubbleY + borderRadius);
    this.ctx.arcTo(bubbleX, bubbleY, bubbleX + borderRadius, bubbleY, borderRadius);
    this.ctx.closePath();
    this.ctx.fill();

    // Draw bubble border
    this.ctx.strokeStyle = isCurrentPlayer ? '#00ffff' : '#ffaa00';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Draw text inside bubble
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, x, y + offsetY);
  }

  // Fonction pour dessiner les sprites d'armes
  renderWeaponSprite(x, y, angle, weaponType, isCurrentPlayer) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);

    const primaryColor = isCurrentPlayer ? '#333333' : '#444444';
    const accentColor = isCurrentPlayer ? '#00ffff' : '#ffaa00';

    switch(weaponType) {
      case 'pistol':
        // Pistolet compact
        // Corps de l'arme
        this.ctx.fillStyle = primaryColor;
        this.ctx.fillRect(5, -3, 18, 6);
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(5, -3, 18, 6);

        // Canon
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(23, -2, 8, 4);
        this.ctx.strokeRect(23, -2, 8, 4);

        // Poignée
        this.ctx.fillStyle = primaryColor;
        this.ctx.fillRect(5, 3, 6, 8);
        this.ctx.strokeRect(5, 3, 6, 8);

        // Détail accent
        this.ctx.fillStyle = accentColor;
        this.ctx.fillRect(15, -1, 3, 2);
        break;

      case 'shotgun':
        // Shotgun à double canon
        // Corps principal
        this.ctx.fillStyle = primaryColor;
        this.ctx.fillRect(5, -4, 25, 8);
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(5, -4, 25, 8);

        // Double canon
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(30, -4, 12, 3);
        this.ctx.fillRect(30, 1, 12, 3);
        this.ctx.strokeRect(30, -4, 12, 3);
        this.ctx.strokeRect(30, 1, 12, 3);

        // Crosse
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(-5, -3, 10, 6);
        this.ctx.strokeRect(-5, -3, 10, 6);

        // Pompe
        this.ctx.fillStyle = accentColor;
        this.ctx.fillRect(12, -2, 8, 4);
        this.ctx.strokeStyle = '#000';
        this.ctx.strokeRect(12, -2, 8, 4);

        // Détails sur les canons
        this.ctx.fillStyle = '#ff6600';
        this.ctx.fillRect(40, -3, 2, 1);
        this.ctx.fillRect(40, 2, 2, 1);
        break;

      case 'machinegun':
        // Mitraillette
        // Corps principal
        this.ctx.fillStyle = primaryColor;
        this.ctx.fillRect(0, -5, 30, 10);
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(0, -5, 30, 10);

        // Canon avec refroidissement
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(30, -3, 15, 6);
        this.ctx.strokeRect(30, -3, 15, 6);

        // Grilles de refroidissement
        for(let i = 0; i < 4; i++) {
          this.ctx.fillStyle = '#00ffff';
          this.ctx.fillRect(32 + i * 3, -2, 1, 4);
        }

        // Chargeur
        this.ctx.fillStyle = '#444';
        this.ctx.fillRect(10, 5, 8, 12);
        this.ctx.strokeStyle = '#000';
        this.ctx.strokeRect(10, 5, 8, 12);

        // Crosse pliable
        this.ctx.fillStyle = '#333';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(-5, -3);
        this.ctx.lineTo(-12, -5);
        this.ctx.lineTo(-12, 5);
        this.ctx.lineTo(-5, 3);
        this.ctx.stroke();

        // Viseur laser
        this.ctx.fillStyle = '#ff0000';
        this.ctx.beginPath();
        this.ctx.arc(45, 0, 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Détails accent
        this.ctx.fillStyle = accentColor;
        this.ctx.fillRect(5, -3, 2, 6);
        this.ctx.fillRect(20, -3, 2, 6);
        break;

      case 'rocketlauncher':
        // Lance-roquettes imposant
        // Tube principal (large)
        this.ctx.fillStyle = '#444';
        this.ctx.fillRect(0, -7, 40, 14);
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeRect(0, -7, 40, 14);

        // Bandes de sécurité jaunes/noires
        for(let i = 0; i < 3; i++) {
          this.ctx.fillStyle = i % 2 === 0 ? '#ffff00' : '#000';
          this.ctx.fillRect(8 + i * 8, -6, 6, 12);
        }

        // Tube de visée supérieur
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(5, -10, 30, 3);
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(5, -10, 30, 3);

        // Ouverture avant (tube de lancement)
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(40, -6, 8, 12);
        this.ctx.strokeRect(40, -6, 8, 12);

        // Bordure du tube de lancement
        this.ctx.fillStyle = '#ff4400';
        this.ctx.fillRect(40, -7, 2, 14);
        this.ctx.fillRect(46, -7, 2, 14);

        // Poignée avant
        this.ctx.fillStyle = '#333';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(15, 7);
        this.ctx.lineTo(15, 12);
        this.ctx.lineTo(20, 12);
        this.ctx.lineTo(20, 7);
        this.ctx.stroke();

        // Gâchette arrière
        this.ctx.fillStyle = primaryColor;
        this.ctx.fillRect(-3, 2, 5, 10);
        this.ctx.strokeRect(-3, 2, 5, 10);

        // Détails rouges (danger)
        this.ctx.fillStyle = '#ff0000';
        this.ctx.fillRect(38, -8, 3, 2);
        this.ctx.fillRect(38, 6, 3, 2);

        // Indicateur LED (prêt à tirer)
        this.ctx.fillStyle = '#00ff00';
        this.ctx.beginPath();
        this.ctx.arc(10, 0, 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Évents de recul
        this.ctx.fillStyle = '#666';
        for(let i = 0; i < 3; i++) {
          this.ctx.fillRect(-8 - i * 3, -4 + i * 2, 5, 2);
        }

        // Détails accent
        this.ctx.fillStyle = accentColor;
        this.ctx.fillRect(2, -5, 3, 10);
        break;

      default:
        // Arme par défaut (pistolet)
        this.ctx.fillStyle = primaryColor;
        this.ctx.fillRect(5, -3, 18, 6);
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(5, -3, 18, 6);
    }

    this.ctx.restore();
  }

  drawPlayerSprite(player, isCurrentPlayer, timestamp) {
    this.ctx.save();
    this.ctx.translate(player.x, player.y);

    // Calculer la vélocité pour l'animation de marche
    const velocity = Math.sqrt((player.vx || 0) ** 2 + (player.vy || 0) ** 2);
    const isMoving = velocity > 0.5;

    // Animation de marche basée sur le mouvement
    const walkCycle = isMoving ? Math.sin(timestamp / 150) * 0.3 : 0;
    const baseSize = 20 / 20; // Normaliser par rapport à PLAYER_SIZE (20)

    // Couleurs du joueur
    const primaryColor = isCurrentPlayer ? '#0088ff' : '#ff8800';
    const secondaryColor = isCurrentPlayer ? '#0066cc' : '#cc6600';
    const borderColor = isCurrentPlayer ? '#00ffff' : '#ffaa00';

    this.ctx.fillStyle = primaryColor;
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 1.5;

    // Jambes (arrière-plan)
    const legWidth = 5 * baseSize;
    const legHeight = 10 * baseSize;
    const legSpacing = 7 * baseSize;

    // Jambe gauche
    this.ctx.save();
    this.ctx.translate(-legSpacing / 2, 8 * baseSize);
    this.ctx.rotate(walkCycle);
    this.ctx.fillStyle = secondaryColor;
    this.ctx.fillRect(-legWidth / 2, 0, legWidth, legHeight);
    this.ctx.strokeRect(-legWidth / 2, 0, legWidth, legHeight);
    // Pied
    this.ctx.fillStyle = '#222';
    this.ctx.fillRect(-legWidth / 2, legHeight - 2, legWidth, 2);
    this.ctx.restore();

    // Jambe droite
    this.ctx.save();
    this.ctx.translate(legSpacing / 2, 8 * baseSize);
    this.ctx.rotate(-walkCycle);
    this.ctx.fillStyle = secondaryColor;
    this.ctx.fillRect(-legWidth / 2, 0, legWidth, legHeight);
    this.ctx.strokeRect(-legWidth / 2, 0, legWidth, legHeight);
    // Pied
    this.ctx.fillStyle = '#222';
    this.ctx.fillRect(-legWidth / 2, legHeight - 2, legWidth, 2);
    this.ctx.restore();

    // Corps principal (torse)
    const bodyWidth = 16 * baseSize;
    const bodyHeight = 18 * baseSize;
    this.ctx.fillStyle = primaryColor;
    this.ctx.fillRect(-bodyWidth / 2, -4 * baseSize, bodyWidth, bodyHeight);
    this.ctx.strokeRect(-bodyWidth / 2, -4 * baseSize, bodyWidth, bodyHeight);

    // Détail du torse (rayure centrale)
    this.ctx.strokeStyle = borderColor;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -4 * baseSize);
    this.ctx.lineTo(0, -4 * baseSize + bodyHeight);
    this.ctx.stroke();

    // Bras
    const armWidth = 4 * baseSize;
    const armHeight = 12 * baseSize;
    const armOffset = bodyWidth / 2 + 1 * baseSize;

    this.ctx.fillStyle = primaryColor;
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 1.5;

    // Bras gauche
    this.ctx.save();
    this.ctx.translate(-armOffset, 0);
    this.ctx.rotate(isMoving ? -walkCycle * 1.2 : -0.2);
    this.ctx.fillRect(-armWidth / 2, 0, armWidth, armHeight);
    this.ctx.strokeRect(-armWidth / 2, 0, armWidth, armHeight);
    // Main
    this.ctx.fillStyle = '#ffcc99';
    this.ctx.beginPath();
    this.ctx.arc(0, armHeight, armWidth / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();

    // Bras droit
    this.ctx.save();
    this.ctx.translate(armOffset, 0);
    this.ctx.rotate(isMoving ? walkCycle * 1.2 : 0.2);
    this.ctx.fillRect(-armWidth / 2, 0, armWidth, armHeight);
    this.ctx.strokeRect(-armWidth / 2, 0, armWidth, armHeight);
    // Main
    this.ctx.fillStyle = '#ffcc99';
    this.ctx.beginPath();
    this.ctx.arc(0, armHeight, armWidth / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();

    // Tête
    const headRadius = 8 * baseSize;
    this.ctx.fillStyle = '#ffcc99';
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(0, -8 * baseSize, headRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Yeux
    const eyeSize = 2;
    const eyeOffset = 3 * baseSize;
    this.ctx.fillStyle = '#fff';
    this.ctx.beginPath();
    this.ctx.arc(-eyeOffset, -9 * baseSize, eyeSize, 0, Math.PI * 2);
    this.ctx.arc(eyeOffset, -9 * baseSize, eyeSize, 0, Math.PI * 2);
    this.ctx.fill();

    // Pupilles
    this.ctx.fillStyle = '#000';
    this.ctx.beginPath();
    this.ctx.arc(-eyeOffset, -9 * baseSize, eyeSize / 2, 0, Math.PI * 2);
    this.ctx.arc(eyeOffset, -9 * baseSize, eyeSize / 2, 0, Math.PI * 2);
    this.ctx.fill();

    // Bouche (sourire)
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(0, -6 * baseSize, 3 * baseSize, 0.2, Math.PI - 0.2);
    this.ctx.stroke();

    // Cheveux/Casque selon le joueur
    this.ctx.fillStyle = borderColor;
    this.ctx.beginPath();
    this.ctx.arc(0, -12 * baseSize, headRadius * 0.8, Math.PI, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  renderPlayers(players, currentPlayerId, config, dateNow = Date.now(), timestamp = performance.now()) {
    Object.entries(players).forEach(([pid, p]) => {
      const isCurrentPlayer = pid === currentPlayerId;
      if (!p.alive) return;

      // Don't render players without nicknames (except current player in waiting state)
      // This prevents "ghost" players from being visible before they start playing
      if (!p.hasNickname && !isCurrentPlayer) return;

      // Speed effect
      if (p.speedBoost && dateNow < p.speedBoost) {
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = '#00ffff';

        // Create speed trail for current player (SCREEN EFFECTS)
        if (isCurrentPlayer && window.screenEffects) {
          window.screenEffects.createSpeedTrail(p.x, p.y);
        }
      }

      // Draw enhanced player sprite
      this.drawPlayerSprite(p, isCurrentPlayer, timestamp);

      this.ctx.shadowBlur = 0;

      // Render weapon sprite
      const weaponType = p.weapon || 'pistol';
      this.renderWeaponSprite(p.x, p.y, p.angle, weaponType, isCurrentPlayer);

      // Player name bubble with nickname
      const nickname = p.nickname || (isCurrentPlayer ? 'Vous' : 'Joueur');
      const playerLabel = `${nickname} (Lv${p.level || 1})`;
      this.renderPlayerNameBubble(p.x, p.y, playerLabel, isCurrentPlayer, -config.PLAYER_SIZE - 25);

      // Health bar
      const healthPercent = p.health / p.maxHealth;
      this.ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
      this.ctx.fillRect(p.x - 20, p.y + config.PLAYER_SIZE + 5, 40 * healthPercent, 5);
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(p.x - 20, p.y + config.PLAYER_SIZE + 5, 40, 5);
    });
  }

  renderTargetIndicator(player) {
    // Only render if mobile controls are active and auto-shoot is on
    if (!window.mobileControls || !window.mobileControls.autoShootActive) return;

    const target = window.mobileControls.getCurrentTarget();
    if (!target || !player) return;

    // Draw line from player to target
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([10, 5]);
    this.ctx.beginPath();
    this.ctx.moveTo(player.x, player.y);
    this.ctx.lineTo(target.x, target.y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Draw target reticle
    const reticleSize = 30;
    this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    this.ctx.lineWidth = 3;

    // Crosshair
    this.ctx.beginPath();
    this.ctx.moveTo(target.x - reticleSize, target.y);
    this.ctx.lineTo(target.x + reticleSize, target.y);
    this.ctx.moveTo(target.x, target.y - reticleSize);
    this.ctx.lineTo(target.x, target.y + reticleSize);
    this.ctx.stroke();

    // Circle around target
    this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(target.x, target.y, reticleSize - 5, 0, Math.PI * 2);
    this.ctx.stroke();

    // Pulsing effect
    const pulse = Math.sin(Date.now() / 200) * 5;
    this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(target.x, target.y, reticleSize + pulse, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  renderMinimap(gameState, playerId) {
    if (!gameState.config.ROOM_WIDTH) return;

    // Scale context for Retina displays
    const pixelRatio = window.devicePixelRatio || 1;
    this.minimapCtx.save();
    this.minimapCtx.scale(pixelRatio, pixelRatio);

    const mapWidth = this.minimapCanvas.width / pixelRatio;
    const mapHeight = this.minimapCanvas.height / pixelRatio;
    const scaleX = mapWidth / gameState.config.ROOM_WIDTH;
    const scaleY = mapHeight / gameState.config.ROOM_HEIGHT;

    // Background
    this.minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.minimapCtx.fillRect(0, 0, mapWidth, mapHeight);

    // Walls
    this.minimapCtx.fillStyle = '#444';
    gameState.state.walls.forEach(wall => {
      this.minimapCtx.fillRect(
        wall.x * scaleX,
        wall.y * scaleY,
        wall.width * scaleX,
        wall.height * scaleY
      );
    });

    // Zombies
    Object.values(gameState.state.zombies).forEach(zombie => {
      this.minimapCtx.fillStyle = zombie.isBoss ? '#ff0000' : zombie.color;
      this.minimapCtx.beginPath();
      this.minimapCtx.arc(zombie.x * scaleX, zombie.y * scaleY, zombie.isBoss ? 6 : 3, 0, Math.PI * 2);
      this.minimapCtx.fill();
    });

    // Loot
    this.minimapCtx.fillStyle = '#ffd700';
    Object.values(gameState.state.loot).forEach(loot => {
      this.minimapCtx.beginPath();
      this.minimapCtx.arc(loot.x * scaleX, loot.y * scaleY, 2, 0, Math.PI * 2);
      this.minimapCtx.fill();
    });

    // Powerups
    this.minimapCtx.fillStyle = '#ffff00';
    Object.values(gameState.state.powerups).forEach(powerup => {
      this.minimapCtx.beginPath();
      this.minimapCtx.arc(powerup.x * scaleX, powerup.y * scaleY, 3, 0, Math.PI * 2);
      this.minimapCtx.fill();
    });

    // Other players
    this.minimapCtx.fillStyle = '#ff8800';
    Object.entries(gameState.state.players).forEach(([pid, p]) => {
      if (pid === playerId || !p.alive || !p.hasNickname) return;
      this.minimapCtx.beginPath();
      this.minimapCtx.arc(p.x * scaleX, p.y * scaleY, 4, 0, Math.PI * 2);
      this.minimapCtx.fill();
    });

    // Current player
    const player = gameState.state.players[playerId];
    if (player && player.alive) {
      this.minimapCtx.fillStyle = '#0088ff';
      this.minimapCtx.beginPath();
      this.minimapCtx.arc(player.x * scaleX, player.y * scaleY, 5, 0, Math.PI * 2);
      this.minimapCtx.fill();

      // Direction
      this.minimapCtx.strokeStyle = '#00ffff';
      this.minimapCtx.lineWidth = 2;
      this.minimapCtx.beginPath();
      this.minimapCtx.moveTo(player.x * scaleX, player.y * scaleY);
      this.minimapCtx.lineTo(
        player.x * scaleX + Math.cos(player.angle) * 10,
        player.y * scaleY + Math.sin(player.angle) * 10
      );
      this.minimapCtx.stroke();
    }

    // Border
    this.minimapCtx.strokeStyle = '#00ff00';
    this.minimapCtx.lineWidth = 2;
    this.minimapCtx.strokeRect(0, 0, mapWidth, mapHeight);

    this.minimapCtx.restore(); // Restore pixelRatio scaling
  }

  /**
   * Add a damage number at position
   * @param {number} x - World X coordinate
   * @param {number} y - World Y coordinate
   * @param {number} damage - Damage amount
   * @param {string} type - Damage type (normal, critical, poison, fire, ice)
   */
  addDamageNumber(x, y, damage, type = 'normal') {
    const colors = {
      normal: '#ffffff',
      critical: '#ffff00',
      poison: '#00ff00',
      fire: '#ff6600',
      ice: '#00ffff',
      boss: '#ff0000'
    };

    this.damageNumbers.push({
      x: x,
      y: y,
      damage: Math.ceil(damage),
      color: colors[type] || colors.normal,
      opacity: 1,
      velocity: -2, // Move up
      createdAt: Date.now(),
      lifetime: 2000 // 2 seconds
    });

    // Limit damage numbers for performance
    if (this.damageNumbers.length > 50) {
      this.damageNumbers.shift();
    }
  }

  /**
   * Check zombie health changes and create damage numbers
   * @param {object} zombies - Current zombies state
   */
  checkZombieDamage(zombies) {
    for (let zombieId in zombies) {
      const zombie = zombies[zombieId];

      // Check if we tracked this zombie before
      if (this.lastZombieHealthCheck[zombieId] !== undefined) {
        const lastHealth = this.lastZombieHealthCheck[zombieId];
        const currentHealth = zombie.health;

        // Damage detected
        if (currentHealth < lastHealth) {
          const damage = lastHealth - currentHealth;
          const damageType = zombie.isBoss ? 'boss' : 'normal';
          this.addDamageNumber(zombie.x, zombie.y - zombie.size, damage, damageType);
        }
      }

      // Update tracked health
      this.lastZombieHealthCheck[zombieId] = zombie.health;
    }

    // Clean up dead zombies from tracking
    for (let zombieId in this.lastZombieHealthCheck) {
      if (!zombies[zombieId]) {
        delete this.lastZombieHealthCheck[zombieId];
      }
    }
  }

  /**
   * Update and render damage numbers
   * @param {number} deltaTime - Time since last frame (ms)
   */
  updateDamageNumbers(deltaTime) {
    const now = Date.now();

    // Update damage numbers
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dmg = this.damageNumbers[i];

      // Calculate age
      const age = now - dmg.createdAt;

      // Remove if expired
      if (age > dmg.lifetime) {
        this.damageNumbers.splice(i, 1);
        continue;
      }

      // Update position (float up)
      dmg.y += dmg.velocity;

      // Update opacity (fade out)
      dmg.opacity = 1 - (age / dmg.lifetime);
    }
  }

  /**
   * Render damage numbers
   */
  applyWeatherFog(weather, stage = 'before') {
    if (!weather || weather.intensity === 0) return;

    if (stage === 'before') {
      // Apply ambient light darkening
      if (weather.ambientLight < 1) {
        this.ctx.save();
        this.ctx.fillStyle = `rgba(0, 0, 0, ${(1 - weather.ambientLight) * weather.intensity * 0.5})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
      }
    } else if (stage === 'after') {
      // Apply fog overlay
      if (weather.fogDensity > 0) {
        this.ctx.save();
        this.ctx.fillStyle = `rgba(200, 200, 220, ${weather.fogDensity * weather.intensity})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
      }

      // Lightning flash
      if (weather.lightning) {
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
      }
    }
  }

  renderSky(dayNight) {
    if (!dayNight || !dayNight.config) return;

    const { config, stars, moon } = dayNight;

    // Render gradient sky
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);

    // Apply zenith colors (top)
    config.zenith.forEach((color, i) => {
      gradient.addColorStop(i * 0.2, color);
    });

    // Apply horizon colors (bottom)
    config.horizon.forEach((color, i) => {
      gradient.addColorStop(0.6 + i * 0.13, color);
    });

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Render stars for night
    if (stars && stars.length > 0) {
      this.ctx.save();
      const time = Date.now() / 1000;

      stars.forEach(star => {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.3 + 0.7;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness * twinkle * config.ambient})`;
        this.ctx.fillRect(
          star.x * this.canvas.width,
          star.y * this.canvas.height,
          star.size,
          star.size
        );
      });

      this.ctx.restore();
    }

    // Render moon
    if (moon) {
      this.ctx.save();

      const moonX = moon.x * this.canvas.width;
      const moonY = moon.y * this.canvas.height;
      const moonRadius = 40;

      // Moon glow
      const moonGlow = this.ctx.createRadialGradient(moonX, moonY, moonRadius * 0.5, moonX, moonY, moonRadius * 2);
      moonGlow.addColorStop(0, 'rgba(220, 220, 255, 0.3)');
      moonGlow.addColorStop(1, 'rgba(220, 220, 255, 0)');
      this.ctx.fillStyle = moonGlow;
      this.ctx.fillRect(moonX - moonRadius * 2, moonY - moonRadius * 2, moonRadius * 4, moonRadius * 4);

      // Moon disc
      this.ctx.fillStyle = '#f0f0ff';
      this.ctx.beginPath();
      this.ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
      this.ctx.fill();

      // Moon phase shadow
      if (moon.phase < 0.4 || moon.phase > 0.6) {
        this.ctx.fillStyle = 'rgba(10, 20, 40, 0.4)';
        this.ctx.beginPath();
        const crescent = (moon.phase < 0.5) ? (0.5 - moon.phase) * 2 : (moon.phase - 0.5) * 2;
        this.ctx.arc(moonX, moonY, moonRadius, Math.PI * 0.5, Math.PI * 1.5);
        this.ctx.arc(moonX + moonRadius * crescent, moonY, moonRadius * (1 - crescent), Math.PI * 1.5, Math.PI * 0.5, true);
        this.ctx.fill();
      }

      this.ctx.restore();
    }
  }

  applyAmbientDarkness(lighting) {
    if (!lighting || lighting.ambientLight >= 0.95) return;

    const darkness = 1 - lighting.ambientLight;
    this.ctx.save();
    this.ctx.fillStyle = `rgba(0, 0, 0, ${darkness * 0.7})`;
    this.ctx.fillRect(
      this.camera.x,
      this.camera.y,
      this.canvas.width / (window.devicePixelRatio || 1),
      this.canvas.height / (window.devicePixelRatio || 1)
    );
    this.ctx.restore();
  }

  renderDynamicLights(lighting) {
    if (!lighting || !lighting.lights || lighting.lights.length === 0) return;

    // Check performance settings
    if (window.performanceSettings && !window.performanceSettings.shouldRenderParticles()) {
      return;
    }

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter'; // Additive blending for lights

    lighting.lights.forEach(light => {
      if (!light.enabled) return;

      // Viewport culling
      if (!this.camera.isInViewport(light.x, light.y, light.radius * 2)) {
        return;
      }

      // Radial gradient light
      const gradient = this.ctx.createRadialGradient(
        light.x, light.y, 0,
        light.x, light.y, light.radius * light.currentIntensity
      );

      gradient.addColorStop(0, light.color);
      gradient.addColorStop(0.5, light.color.replace(/[\d.]+\)$/g, `${light.currentIntensity * 0.3})`));
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(
        light.x - light.radius,
        light.y - light.radius,
        light.radius * 2,
        light.radius * 2
      );
    });

    this.ctx.restore();
  }

  renderWeather(weather) {
    if (!weather || weather.intensity === 0) return;

    // Check performance settings
    if (window.performanceSettings && !window.performanceSettings.shouldRenderParticles()) {
      return;
    }

    // Render raindrops
    if (weather.raindrops && weather.raindrops.length > 0) {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(150, 180, 200, 0.4)';
      this.ctx.lineWidth = 1;

      weather.raindrops.forEach(drop => {
        this.ctx.globalAlpha = drop.alpha;
        this.ctx.beginPath();
        this.ctx.moveTo(drop.x, drop.y);
        this.ctx.lineTo(drop.x + drop.vx, drop.y + drop.length);
        this.ctx.stroke();
      });

      this.ctx.restore();
    }

    // Render snowflakes
    if (weather.snowflakes && weather.snowflakes.length > 0) {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';

      weather.snowflakes.forEach(flake => {
        this.ctx.save();
        this.ctx.globalAlpha = flake.alpha;
        this.ctx.translate(flake.x, flake.y);
        this.ctx.rotate(flake.rotation);

        // Simple snowflake shape
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const x = Math.cos(angle) * flake.size;
          const y = Math.sin(angle) * flake.size;
          this.ctx.moveTo(0, 0);
          this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();

        this.ctx.restore();
      });

      this.ctx.restore();
    }
  }

  renderDamageNumbers() {
    if (!this.camera) return;

    this.ctx.save();

    for (const dmg of this.damageNumbers) {
      // Convert world to screen coordinates
      const screenX = dmg.x - this.camera.x;
      const screenY = dmg.y - this.camera.y;

      // Only render if on screen
      if (screenX < -50 || screenX > this.canvas.width + 50 ||
          screenY < -50 || screenY > this.canvas.height + 50) {
        continue;
      }

      // Render damage number
      this.ctx.globalAlpha = dmg.opacity;
      this.ctx.font = 'bold 20px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      // Outline
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 4;
      this.ctx.strokeText(`-${dmg.damage}`, screenX, screenY);

      // Fill
      this.ctx.fillStyle = dmg.color;
      this.ctx.fillText(`-${dmg.damage}`, screenX, screenY);
    }

    this.ctx.restore();
  }

  /**
   * Update Boss Health Bar UI
   * @param {object} gameState - Game state object
   */
  updateBossHealthBar(gameState) {
    const container = document.getElementById('boss-health-container');
    const nameEl = document.getElementById('boss-name');
    const phaseEl = document.getElementById('boss-phase');
    const healthBar = document.getElementById('boss-health-bar');
    const healthText = document.getElementById('boss-health-text');

    if (!container || !nameEl || !phaseEl || !healthBar || !healthText) {
      return;
    }

    // Find active boss
    const bosses = Object.values(gameState.state.zombies).filter(z => z.isBoss);

    if (bosses.length === 0) {
      // No boss - hide health bar
      container.style.display = 'none';
      return;
    }

    // Show boss health bar
    container.style.display = 'block';

    // Get first boss (primary boss)
    const boss = bosses[0];
    const healthPercent = (boss.health / boss.maxHealth) * 100;

    // Update boss name (use type as name if available, otherwise "BOSS")
    const bossNames = {
      'boss': 'BOSS',
      'bossCharnier': 'RAIIVY',
      'bossInfect': 'SORENZA',
      'bossColosse': 'HAIER',
      'bossRoi': 'KUROI TO SUTA',
      'bossOmega': 'MORGANNITO',
      'bossInfernal': 'LORD INFERNUS',
      'bossCryos': 'CRYOS L\'ÉTERNEL',
      'bossVortex': 'VORTEX LE DESTRUCTEUR',
      'bossNexus': 'NEXUS DU VIDE',
      'bossApocalypse': 'APOCALYPSE PRIME'
    };
    const bossName = bossNames[boss.type] || 'BOSS';
    nameEl.textContent = bossName;

    // Determine phase based on health percentage
    let phase = 1;
    if (healthPercent <= 33) {
      phase = 3;
    } else if (healthPercent <= 66) {
      phase = 2;
    }

    phaseEl.textContent = `Phase ${phase}`;

    // Update health bar width
    healthBar.style.width = `${healthPercent}%`;
    healthText.textContent = `${Math.ceil(healthPercent)}%`;

    // Update health bar class for phase coloring
    healthBar.classList.remove('phase-2', 'phase-3');
    if (phase === 2) {
      healthBar.classList.add('phase-2');
    } else if (phase === 3) {
      healthBar.classList.add('phase-3');
    }
  }
}

// Export to window
window.Renderer = Renderer;

  // Kill Feed & Combo Methods (added before updateBossHealthBar)
  updateKillFeedAndCombo(gameState) {
    const player = gameState.state.players[gameState.playerId];
    if (!player) return;

    // Update combo display
    const combo = player.combo || 0;
    const comboDisplay = document.getElementById('combo-display');
    const comboCount = document.getElementById('combo-count');
    const comboMultiplier = document.getElementById('combo-multiplier');

    if (combo > 0) {
      comboDisplay.style.display = 'block';
      comboCount.textContent = combo;
      const multiplier = Math.min(1 + (combo * 0.05), 3).toFixed(1);
      comboMultiplier.textContent = multiplier;

      // Trigger animation on combo increase
      if (combo > this.lastComboValue) {
        comboCount.style.animation = 'none';
        setTimeout(() => { comboCount.style.animation = ''; }, 10);
      }
    } else {
      comboDisplay.style.display = 'none';
    }
    this.lastComboValue = combo;

    // Simple kill feed (detect zombie count decrease)
    const currentZombieCount = Object.keys(gameState.state.zombies).length;
    if (currentZombieCount < this.lastZombieCount) {
      this.addKillFeedItem(player.nickname || 'Player', 'Zombie');
    }
    this.lastZombieCount = currentZombieCount;

    // Update kill feed items (remove old ones)
    this.updateKillFeed();
  }

  addKillFeedItem(killer, victim, type = 'normal') {
    const feedEl = document.getElementById('kill-feed');
    if (!feedEl) return;

    const item = document.createElement('div');
    item.classList.add('kill-feed-item');
    if (type === 'elite') item.classList.add('elite');
    if (type === 'boss') item.classList.add('boss');

    item.innerHTML = `
      <div class="kill-feed-text">
        <span class="kill-feed-killer">${killer}</span>
        <span>☠</span>
        <span class="kill-feed-victim ${type}">${victim}</span>
      </div>
    `;

    feedEl.prepend(item);

    // Store item with timestamp
    this.killFeedItems.push({ element: item, createdAt: Date.now() });

    // Limit to 5 items
    while (this.killFeedItems.length > 5) {
      const oldest = this.killFeedItems.shift();
      oldest.element.remove();
    }
  }

  updateKillFeed() {
    const now = Date.now();
    for (let i = this.killFeedItems.length - 1; i >= 0; i--) {
      const item = this.killFeedItems[i];
      const age = now - item.createdAt;

      // Remove after 5 seconds
      if (age > 5000) {
        item.element.classList.add('removing');
        setTimeout(() => item.element.remove(), 300);
        this.killFeedItems.splice(i, 1);
      }
    }
  }

  updateWaveProgress(gameState) {
    const waveNumberEl = document.getElementById('wave-progress-number');
    const waveKillsEl = document.getElementById('wave-kills');
    const waveTargetEl = document.getElementById('wave-target');
    const progressBar = document.getElementById('wave-progress-bar');

    if (!waveNumberEl || !waveKillsEl || !waveTargetEl || !progressBar) {
      return;
    }

    const wave = gameState.state.wave || 1;
    const zombiesKilled = gameState.state.zombiesKilledThisWave || 0;

    // Calculate target zombies for this wave (base 10 + wave scaling)
    const targetZombies = Math.floor(10 + (wave * 2));

    // Update display
    waveNumberEl.textContent = wave;
    waveKillsEl.textContent = zombiesKilled;
    waveTargetEl.textContent = targetZombies;

    // Update progress bar width
    const progress = Math.min((zombiesKilled / targetZombies) * 100, 100);
    progressBar.style.width = `${progress}%`;
  }
