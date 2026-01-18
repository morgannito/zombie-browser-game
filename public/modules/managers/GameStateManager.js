/**
 * GAME STATE MANAGER
 * Manages global game state, entity tracking, and debug features
 * Enhanced with adaptive interpolation and velocity-based smoothing
 * @module GameStateManager
 * @author Claude Code
 * @version 3.0.0
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
      baseSpeed: 10, // Base interpolation speed (higher = faster catch-up)
      // Entity state tracking for velocity-based interpolation
      entityStates: {
        zombies: new Map(),
        players: new Map()
      },
      // Legacy support
      previousPositions: {
        zombies: {},
        players: {},
        bullets: {}
      },
      // Performance tracking
      lastFrameTime: performance.now(),
      deltaTime: 16.67
    };

    // Network latency tracking for adaptive behavior
    this.networkLatency = 50; // Initial estimate in ms
    this.serverTickRate = 20; // Expected server updates per second

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
   * Apply visual interpolation to entities for smooth movement
   * Uses velocity-based extrapolation with adaptive smoothing
   * Call this in the render loop, not in network handlers
   */
  applyInterpolation() {
    if (!this.interpolation.enabled) {
      return;
    }

    // Calculate delta time for frame-independent interpolation
    const now = performance.now();
    const deltaTime = Math.min(now - this.interpolation.lastFrameTime, 100);
    this.interpolation.lastFrameTime = now;
    this.interpolation.deltaTime = deltaTime;

    // Calculate adaptive interpolation factor based on delta time
    // Using exponential smoothing: factor = 1 - e^(-speed * dt/1000)
    const speed = this.interpolation.baseSpeed;
    const smoothFactor = 1 - Math.exp(-speed * deltaTime / 1000);

    const entityStates = this.interpolation.entityStates;
    let interpolatedCount = 0;

    // Interpolate zombies with velocity-based extrapolation
    for (const [id, zombie] of Object.entries(this.state.zombies)) {
      let state = entityStates.zombies.get(id);

      if (!state) {
        // Initialize state for new zombie
        state = {
          displayX: zombie.x,
          displayY: zombie.y,
          targetX: zombie.x,
          targetY: zombie.y,
          velocityX: 0,
          velocityY: 0,
          lastUpdateTime: now
        };
        entityStates.zombies.set(id, state);
      }

      // Check if server position changed (new update received)
      if (zombie.x !== state.targetX || zombie.y !== state.targetY) {
        // Calculate velocity from position delta
        const timeSinceLastUpdate = now - state.lastUpdateTime;
        if (timeSinceLastUpdate > 0 && timeSinceLastUpdate < 500) {
          state.velocityX = (zombie.x - state.targetX) / timeSinceLastUpdate * 1000;
          state.velocityY = (zombie.y - state.targetY) / timeSinceLastUpdate * 1000;
        }
        state.targetX = zombie.x;
        state.targetY = zombie.y;
        state.lastUpdateTime = now;
      }

      // Extrapolate position based on velocity (dead reckoning)
      const timeSinceUpdate = now - state.lastUpdateTime;
      let predictedX = state.targetX;
      let predictedY = state.targetY;

      // Only extrapolate for short periods to avoid overshooting
      if (timeSinceUpdate < 200) {
        predictedX += state.velocityX * timeSinceUpdate / 1000;
        predictedY += state.velocityY * timeSinceUpdate / 1000;
      }

      // Smoothly interpolate display position towards predicted position
      state.displayX += (predictedX - state.displayX) * smoothFactor;
      state.displayY += (predictedY - state.displayY) * smoothFactor;

      // Update zombie's rendered position
      zombie.x = state.displayX;
      zombie.y = state.displayY;
      interpolatedCount++;
    }

    // Clean up states for removed zombies
    for (const [id] of entityStates.zombies) {
      if (!this.state.zombies[id]) {
        entityStates.zombies.delete(id);
      }
    }

    // Interpolate other players (not local player) with same approach
    for (const [id, player] of Object.entries(this.state.players)) {
      if (id === this.playerId) continue; // Skip local player

      let state = entityStates.players.get(id);

      if (!state) {
        state = {
          displayX: player.x,
          displayY: player.y,
          targetX: player.x,
          targetY: player.y,
          velocityX: 0,
          velocityY: 0,
          lastUpdateTime: now
        };
        entityStates.players.set(id, state);
      }

      // Check if server position changed
      if (player.x !== state.targetX || player.y !== state.targetY) {
        const timeSinceLastUpdate = now - state.lastUpdateTime;
        if (timeSinceLastUpdate > 0 && timeSinceLastUpdate < 500) {
          state.velocityX = (player.x - state.targetX) / timeSinceLastUpdate * 1000;
          state.velocityY = (player.y - state.targetY) / timeSinceLastUpdate * 1000;
        }
        state.targetX = player.x;
        state.targetY = player.y;
        state.lastUpdateTime = now;
      }

      // Extrapolate and smooth
      const timeSinceUpdate = now - state.lastUpdateTime;
      let predictedX = state.targetX;
      let predictedY = state.targetY;

      if (timeSinceUpdate < 200) {
        predictedX += state.velocityX * timeSinceUpdate / 1000;
        predictedY += state.velocityY * timeSinceUpdate / 1000;
      }

      state.displayX += (predictedX - state.displayX) * smoothFactor;
      state.displayY += (predictedY - state.displayY) * smoothFactor;

      player.x = state.displayX;
      player.y = state.displayY;
      interpolatedCount++;
    }

    // Clean up states for removed players
    for (const [id] of entityStates.players) {
      if (!this.state.players[id]) {
        entityStates.players.delete(id);
      }
    }

    // Update debug stats
    this.debugStats.interpolatedEntities = interpolatedCount;
  }

  /**
   * Clean up orphaned entities that no longer exist on server
   * Entities that haven't been updated in > 10 seconds are removed
   * CORRECTION: Increased from 3s to 10s to handle temporary network lag without removing entities
   */
  cleanupOrphanedEntities() {
    const now = Date.now();
    const ORPHAN_TIMEOUT = 10000; // 10 seconds (increased to handle lag)

    // Mark entities with last seen timestamp
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

          // Clean interpolation cache
          if (this.interpolation.previousPositions[type]) {
            delete this.interpolation.previousPositions[type][id];
          }
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
   * Update debug statistics
   */
  updateDebugStats() {
    this.debugStats.entitiesCount = {
      players: Object.keys(this.state.players).length,
      zombies: Object.keys(this.state.zombies).length,
      bullets: Object.keys(this.state.bullets).length,
      particles: Object.keys(this.state.particles || {}).length,
      powerups: Object.keys(this.state.powerups || {}).length,
      loot: Object.keys(this.state.loot || {}).length
    };
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
   * Moves bullets and removes expired ones
   */
  updatePredictedBullets() {
    if (!this.bulletPredictionEnabled) {
      return;
    }

    const now = Date.now();
    const bulletIds = Object.keys(this.predictedBullets);

    for (let i = 0; i < bulletIds.length; i++) {
      const bulletId = bulletIds[i];
      const bullet = this.predictedBullets[bulletId];

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
    const RECONCILIATION_AGE = 100; // Remove predicted bullets older than 100ms when server data exists

    // If we have server bullets, remove old predicted bullets
    if (Object.keys(this.state.bullets).length > 0) {
      const bulletIds = Object.keys(this.predictedBullets);
      for (let i = 0; i < bulletIds.length; i++) {
        const bulletId = bulletIds[i];
        const bullet = this.predictedBullets[bulletId];
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
