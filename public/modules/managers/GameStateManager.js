/**
 * GAME STATE MANAGER
 * Manages global game state, entity tracking, and debug features
 * Enhanced with adaptive interpolation and velocity-based smoothing
 * @module GameStateManager
 * @author Claude Code
 * @version 4.0.0
 */

class GameStateManager {
  constructor() {
    this.playerId = null;
    this.state = {
      players: {},
      zombies: {},
      bullets: {},
      powerups: {},
      particles: {},
      poisonTrails: {},
      explosions: {},
      loot: {},
      walls: [],
      currentRoom: 0,
      totalRooms: 5,
      doors: [],
      wave: 1,
      bossSpawned: false,
      // Environment systems
      parallax: null,
      staticProps: [],
      dynamicProps: [],
      dynamicPropParticles: [],
      envParticles: [],
      obstacles: []
    };
    this.config = {
      ROOM_WIDTH: 3000,
      ROOM_HEIGHT: 2400,
      PLAYER_SIZE: 20,
      ZOMBIE_SIZE: 25,
      POWERUP_SIZE: 15,
      LOOT_SIZE: 10
    };
    this.weapons = {};
    this.powerupTypes = {};
    this.zombieTypes = {};
    this.shopItems = {};

    // Enhanced visual interpolation system with velocity-based smoothing
    this.interpolation = {
      enabled: true,
      // Adaptive interpolation speed based on network conditions
      baseSpeed: 25, // Base interpolation speed (higher = snappier, less mushy)
      // Entity state tracking for velocity-based interpolation
      entityStates: {
        zombies: new Map(),
        players: new Map()
      },
      // Performance tracking
      lastFrameTime: performance.now(),
      deltaTime: 16.67
    };

    // Network latency tracking for adaptive behavior
    this.networkLatency = 50; // Initial estimate in ms
    this.serverTickRate = 20; // Expected server updates per second

    // FIX: Server time synchronization for latency compensation
    this.serverTimeOffset = 0; // (serverTime - clientTime) when packet was received
    this.lastServerTime = 0; // Last received server timestamp

    // CLIENT-SIDE PREDICTION: Predicted bullets for instant visual feedback
    this.predictedBullets = {};
    this.nextPredictedBulletId = 1;
    this.bulletPredictionEnabled = true;

    // Timestamp for state updates (to detect stale states)
    this.lastUpdateTimestamp = Date.now();

    // Debug mode (toggle with 'D' key)
    this.debugMode = false;
    this.debugStats = {
      entitiesCount: {},
      networkLatency: 0,
      lastUpdate: 0,
      interpolatedEntities: 0
    };
  }

  updateState(newState) {
    this.state = newState;
    this.lastUpdateTimestamp = Date.now();
  }

  getPlayer() {
    return this.state.players[this.playerId];
  }

  initialize(data) {
    this.playerId = data.playerId;
    this.config = data.config;
    this.weapons = data.weapons;
    this.powerupTypes = data.powerupTypes;
    this.zombieTypes = data.zombieTypes;
    this.shopItems = data.shopItems;
  }

  /**
   * Update network latency estimate (called from NetworkManager)
   * @param {number} latency - Measured latency in ms
   */
  updateNetworkLatency(latency) {
    // Exponential moving average for smooth latency tracking
    this.networkLatency = this.networkLatency * 0.8 + latency * 0.2;
  }

  /**
   * FIX: Update server time offset for latency compensation
   * Called when receiving gameState or delta with serverTime
   * @param {number} serverTime - Server timestamp from the packet
   */
  updateServerTime(serverTime) {
    const clientTime = Date.now();
    this.lastServerTime = serverTime;

    // Calculate offset (how far ahead server is from client)
    // Positive = server ahead, Negative = client ahead
    const newOffset = serverTime - clientTime;

    // Use exponential moving average for stability (avoid jitter from network variance)
    // Blend factor 0.2 means 20% new value, 80% old (smooth but responsive)
    if (this.serverTimeOffset === 0) {
      // First measurement - use directly
      this.serverTimeOffset = newOffset;
    } else {
      this.serverTimeOffset = this.serverTimeOffset * 0.8 + newOffset * 0.2;
    }
  }

  /**
   * FIX: Get estimated current server time
   * Useful for time-sensitive interpolation calculations
   * @returns {number} Estimated current server time
   */
  getEstimatedServerTime() {
    return Date.now() + this.serverTimeOffset;
  }

  /**
   * FIX: Get time since last server update (accounts for latency)
   * @returns {number} Milliseconds since server generated the last state
   */
  getTimeSinceServerUpdate() {
    if (this.lastServerTime === 0) {
      return 0;
    }
    return this.getEstimatedServerTime() - this.lastServerTime;
  }

  /**
   * Apply visual interpolation to entities for smooth movement.
   * Top-level dispatcher — frame-budget guard applied here.
   * Call this in the render loop, not in network handlers.
   */
  applyInterpolation() {
    if (!this.interpolation.enabled) {
      return;
    }

    const now = performance.now();
    const rawDelta = now - this.interpolation.lastFrameTime;
    this.interpolation.lastFrameTime = now;

    // Frame-budget guard: if delta > 100ms (tab was hidden, GC pause, etc.)
    // skip extrapolation entirely to avoid post-stall teleports.
    const deltaTime = Math.min(rawDelta, 100);
    this.interpolation.deltaTime = deltaTime;
    const skipExtrapolation = rawDelta > 100;

    // Adaptive smooth factor: exponential decay based on delta time.
    // Use a higher catch-up speed on bad connections (latency > 300ms).
    const effectiveSpeed = this._adaptiveSpeed();
    const smoothFactor = 1 - Math.exp(-effectiveSpeed * deltaTime / 1000);

    this.debugStats.interpolatedEntities = 0;
    this._interpolateZombies(now, smoothFactor, skipExtrapolation);
    this._interpolatePlayers(now, smoothFactor, skipExtrapolation);
    this._interpolateBullets(now, smoothFactor, skipExtrapolation);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Compute effective interpolation speed.
   * Bumps to 35 when latency > 300ms so clients catch up faster; capped at 40.
   * @returns {number}
   */
  _adaptiveSpeed() {
    const base = this.interpolation.baseSpeed; // 25
    if (this.networkLatency > 300) {
      return Math.min(40, base + 10); // 35, capped at 40
    }
    return base;
  }

  /**
   * Build or update the velocity/position tracking state for one entity.
   * @param {Map} map - entityStates map
   * @param {string} id
   * @param {Object} entity - live entity with .x, .y
   * @param {number} now
   * @returns {Object} state
   */
  _getOrInitState(map, id, entity, now) {
    let state = map.get(id);
    if (!state) {
      state = {
        serverX: entity.x,
        serverY: entity.y,
        displayX: entity.x,
        displayY: entity.y,
        targetX: entity.x,
        targetY: entity.y,
        velocityX: 0,
        velocityY: 0,
        lastUpdateTime: now
      };
      map.set(id, state);
    }
    return state;
  }

  /**
   * Detect a real server position update and refresh velocity.
   * @param {Object} state
   * @param {Object} entity
   * @param {number} now
   */
  _applyServerUpdate(state, entity, now) {
    if (entity.x === state.serverX && entity.y === state.serverY) {
      return; // No real update
    }
    const elapsed = now - state.lastUpdateTime;
    if (elapsed > 0 && elapsed < 500) {
      state.velocityX = (entity.x - state.serverX) / elapsed * 1000;
      state.velocityY = (entity.y - state.serverY) / elapsed * 1000;
    } else {
      state.velocityX = 0;
      state.velocityY = 0;
    }
    state.serverX = entity.x;
    state.serverY = entity.y;
    state.targetX = entity.x;
    state.targetY = entity.y;
    state.lastUpdateTime = now;
  }

  /**
   * Extrapolate + smooth display position towards predicted position.
   * @param {Object} state
   * @param {Object} entity - written back (.x, .y updated)
   * @param {number} now
   * @param {number} smoothFactor
   * @param {boolean} skipExtrapolation
   */
  _stepEntity(state, entity, now, smoothFactor, skipExtrapolation) {
    let predictedX = state.targetX;
    let predictedY = state.targetY;

    if (!skipExtrapolation) {
      const timeSinceUpdate = now - state.lastUpdateTime;
      if (timeSinceUpdate > 0 && timeSinceUpdate < 100) {
        const t = timeSinceUpdate / 1000;
        const MAX_EXTRA = 50;
        predictedX += Math.max(-MAX_EXTRA, Math.min(MAX_EXTRA, state.velocityX * t));
        predictedY += Math.max(-MAX_EXTRA, Math.min(MAX_EXTRA, state.velocityY * t));
      }
    }

    state.displayX += (predictedX - state.displayX) * smoothFactor;
    state.displayY += (predictedY - state.displayY) * smoothFactor;
    entity.x = state.displayX;
    entity.y = state.displayY;
  }

  /**
   * Interpolate all zombies.
   * @param {number} now
   * @param {number} smoothFactor
   * @param {boolean} skipExtrapolation
   */
  _interpolateZombies(now, smoothFactor, skipExtrapolation) {
    const map = this.interpolation.entityStates.zombies;

    for (const [id, zombie] of Object.entries(this.state.zombies)) {
      const state = this._getOrInitState(map, id, zombie, now);
      this._applyServerUpdate(state, zombie, now);
      this._stepEntity(state, zombie, now, smoothFactor, skipExtrapolation);
      this.debugStats.interpolatedEntities++;
    }

    // Clean up states for removed zombies
    for (const [id] of map) {
      if (!this.state.zombies[id]) {
        map.delete(id);
      }
    }
  }

  /**
   * Interpolate remote players (local player is skipped).
   * @param {number} now
   * @param {number} smoothFactor
   * @param {boolean} skipExtrapolation
   */
  _interpolatePlayers(now, smoothFactor, skipExtrapolation) {
    const map = this.interpolation.entityStates.players;

    for (const [id, player] of Object.entries(this.state.players)) {
      if (id === this.playerId) {
        continue; // Skip local player (client prediction handles it)
      }
      const state = this._getOrInitState(map, id, player, now);
      this._applyServerUpdate(state, player, now);
      this._stepEntity(state, player, now, smoothFactor, skipExtrapolation);
      this.debugStats.interpolatedEntities++;
    }

    // Clean up states for removed players
    for (const [id] of map) {
      if (!this.state.players[id]) {
        map.delete(id);
      }
    }
  }

  /**
   * Bullets move deterministically — no velocity extrapolation needed.
   * This method exists as the prescribed extension point; currently a no-op
   * beyond counting (server bullets are rendered via getAllBulletsForRendering).
   * @param {number} _now
   * @param {number} _smoothFactor
   * @param {boolean} _skipExtrapolation
   */
  _interpolateBullets(_now, _smoothFactor, _skipExtrapolation) {
    // Bullets are moved server-authoritatively; client predicted bullets are
    // handled by updatePredictedBullets(). Nothing to interpolate here.
  }

  /**
   * Clean up orphaned entities that no longer exist on server
   * Entities that haven't been updated in > 10 seconds are removed
   */
  cleanupOrphanedEntities() {
    const now = Date.now();
    const ORPHAN_TIMEOUT = 10000; // 10 seconds (increased to handle lag)

    ['zombies', 'bullets', 'particles', 'powerups', 'loot', 'explosions', 'poisonTrails'].forEach(type => {
      if (!this.state[type]) {
        return;
      }

      for (const [id, entity] of Object.entries(this.state[type])) {
        if (!entity._lastSeen) {
          entity._lastSeen = now;
        }

        // Remove if not updated recently
        if (now - entity._lastSeen > ORPHAN_TIMEOUT) {
          console.log(`[CLEANUP] Removing orphaned ${type} entity:`, id);
          delete this.state[type][id];
        }
      }
    });
  }

  /**
   * Mark entity as seen (called when receiving server update)
   */
  markEntitySeen(type, id) {
    if (this.state[type] && this.state[type][id]) {
      this.state[type][id]._lastSeen = Date.now();
    }
  }

  /**
   * Update debug statistics — throttled to 500ms + for-in counters (no allocation).
   */
  updateDebugStats() {
    if (!this._debugStatsNext || performance.now() >= this._debugStatsNext) {
      this._debugStatsNext = performance.now() + 500;
      const count = (o) => {
 let n = 0; if (o) {
for (const _k in o) {
n++;
}
} return n;
};
      this.debugStats.entitiesCount = {
        players: count(this.state.players),
        zombies: count(this.state.zombies),
        bullets: count(this.state.bullets),
        particles: count(this.state.particles),
        powerups: count(this.state.powerups),
        loot: count(this.state.loot)
      };
    }
    this.debugStats.lastUpdate = Date.now() - this.lastUpdateTimestamp;
  }

  /**
   * Toggle debug mode
   */
  toggleDebug() {
    this.debugMode = !this.debugMode;
    console.log('[DEBUG] Debug mode:', this.debugMode ? 'ENABLED' : 'DISABLED');
  }

  /**
   * CLIENT-SIDE PREDICTION: Create a predicted bullet for instant visual feedback
   * @param {number} x - Start X position
   * @param {number} y - Start Y position
   * @param {number} angle - Bullet direction in radians
   * @param {string} weaponType - Weapon type for bullet properties
   * @returns {Object} The predicted bullet object
   */
  createPredictedBullet(x, y, angle, weaponType) {
    if (!this.bulletPredictionEnabled) {
      return null;
    }

    // FIX: Validate inputs to prevent NaN positions
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(angle)) {
      console.warn('[BULLET] Invalid predicted bullet params:', { x, y, angle });
      return null;
    }

    const weapon = this.weapons[weaponType] || this.weapons.pistol;
    const bulletSpeed = weapon.bulletSpeed || 15;
    const bulletColor = weapon.color || '#ffff00';
    const bulletSize = weapon.bulletSize || this.config.BULLET_SIZE || 5;
    const bulletCount = weapon.bulletCount || 1;

    // Create predicted bullets (matching server-side bullet creation)
    for (let i = 0; i < bulletCount; i++) {
      const spreadAngle = angle + (Math.random() - 0.5) * (weapon.spread || 0);

      const predictedBullet = {
        id: `predicted_${this.nextPredictedBulletId++}`,
        x: x,
        y: y,
        vx: Math.cos(spreadAngle) * bulletSpeed,
        vy: Math.sin(spreadAngle) * bulletSpeed,
        color: bulletColor,
        size: bulletSize,
        createdAt: Date.now(),
        maxLifetime: 2000, // 2 second max lifetime for predicted bullets
        isPredicted: true
      };

      this.predictedBullets[predictedBullet.id] = predictedBullet;
    }
  }

  /**
   * CLIENT-SIDE PREDICTION: Update predicted bullets (called every frame)
   * Moves bullets, checks collisions with zombies/walls, and removes expired ones
   */
  updatePredictedBullets() {
    if (!this.bulletPredictionEnabled) {
      return;
    }

    const now = Date.now();
    const bulletIds = Object.keys(this.predictedBullets);
    const zombies = this.state.zombies;
    const walls = this.state.walls || [];
    const zombieSize = this.config.ZOMBIE_SIZE || 25;
    const bulletBaseSize = this.config.BULLET_SIZE || 5;

    for (let i = 0; i < bulletIds.length; i++) {
      const bulletId = bulletIds[i];
      const bullet = this.predictedBullets[bulletId];

      if (!bullet) {
        continue;
      }

      // Update position
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;

      // Remove if expired or out of bounds
      const age = now - bullet.createdAt;
      const outOfBounds =
        bullet.x < 0 || bullet.x > this.config.ROOM_WIDTH ||
        bullet.y < 0 || bullet.y > this.config.ROOM_HEIGHT;

      if (age > bullet.maxLifetime || outOfBounds) {
        delete this.predictedBullets[bulletId];
        continue;
      }

      // Check collision with walls (client-side visual feedback)
      let hitWall = false;
      for (let w = 0; w < walls.length; w++) {
        const wall = walls[w];
        if (bullet.x >= wall.x && bullet.x <= wall.x + wall.width &&
            bullet.y >= wall.y && bullet.y <= wall.y + wall.height) {
          hitWall = true;
          break;
        }
      }
      if (hitWall) {
        delete this.predictedBullets[bulletId];
        continue;
      }

      // Check collision with zombies (client-side visual feedback)
      const bulletSize = bullet.size || bulletBaseSize;
      let hitZombie = false;
      for (const zombieId in zombies) {
        const zombie = zombies[zombieId];
        if (!zombie || zombie.isDead) {
          continue;
        }

        const dx = bullet.x - zombie.x;
        const dy = bullet.y - zombie.y;
        const distSq = dx * dx + dy * dy;
        const minDist = bulletSize + (zombie.size || zombieSize);

        if (distSq < minDist * minDist) {
          hitZombie = true;
          break;
        }
      }
      if (hitZombie) {
        delete this.predictedBullets[bulletId];
        continue;
      }
    }
  }

  /**
   * CLIENT-SIDE PREDICTION: Get all bullets for rendering (server + predicted)
   * @returns {Object} Combined bullets object
   */
  getAllBulletsForRendering() {
    // Merge server bullets with predicted bullets
    // Server bullets take precedence (they have real IDs)
    return { ...this.predictedBullets, ...this.state.bullets };
  }

  /**
   * CLIENT-SIDE PREDICTION: Clear old predicted bullets when server state arrives
   * This prevents visual doubling of bullets
   */
  reconcilePredictedBullets() {
    const now = Date.now();
    // Use network latency to determine reconciliation age
    // Add buffer for processing delays (min 150ms to account for RTT + server processing)
    const RECONCILIATION_AGE = Math.max(150, this.networkLatency * 1.5 + 50);

    // If we have server bullets, remove old predicted bullets
    const serverBulletCount = Object.keys(this.state.bullets).length;
    if (serverBulletCount > 0) {
      const bulletIds = Object.keys(this.predictedBullets);
      for (let i = 0; i < bulletIds.length; i++) {
        const bulletId = bulletIds[i];
        const bullet = this.predictedBullets[bulletId];
        if (!bullet) {
          continue;
        }

        const age = now - bullet.createdAt;

        // Remove predicted bullets that are old enough to have been reconciled with server
        if (age > RECONCILIATION_AGE) {
          delete this.predictedBullets[bulletId];
        }
      }
    }
  }
}

// Export to window
window.GameStateManager = GameStateManager;
