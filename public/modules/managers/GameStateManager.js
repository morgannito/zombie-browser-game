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
   * Apply visual interpolation to entities for smooth movement
   * Uses velocity-based extrapolation with adaptive smoothing
   * Call this in the render loop, not in network handlers
   *
   * FIXED: Properly separates server position tracking from display position
   * to avoid velocity corruption and jitter caused by comparing display vs target
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
        // FIXED: Track serverX/serverY separately to detect real server updates
        state = {
          serverX: zombie.x,    // Last known server position
          serverY: zombie.y,
          displayX: zombie.x,   // Current rendered position
          displayY: zombie.y,
          targetX: zombie.x,    // Interpolation target (may include extrapolation)
          targetY: zombie.y,
          velocityX: 0,
          velocityY: 0,
          lastUpdateTime: now
        };
        entityStates.zombies.set(id, state);
      }

      // FIXED: Compare against stored server position, not zombie.x (which may be displayX)
      // This detects REAL server updates, not our own interpolation modifications
      if (zombie.x !== state.serverX || zombie.y !== state.serverY) {
        // Real server update received - calculate velocity from server position delta
        const timeSinceLastUpdate = now - state.lastUpdateTime;
        if (timeSinceLastUpdate > 0 && timeSinceLastUpdate < 500) {
          // Velocity based on server-to-server position change
          state.velocityX = (zombie.x - state.serverX) / timeSinceLastUpdate * 1000;
          state.velocityY = (zombie.y - state.serverY) / timeSinceLastUpdate * 1000;
        } else {
          // Too long since last update or first update - reset velocity
          state.velocityX = 0;
          state.velocityY = 0;
        }
        // Update stored server position
        state.serverX = zombie.x;
        state.serverY = zombie.y;
        state.targetX = zombie.x;
        state.targetY = zombie.y;
        state.lastUpdateTime = now;
      }

      // Extrapolate position based on velocity (dead reckoning)
      // FIXED: Limit extrapolation to avoid overshooting and reduce jitter
      const timeSinceUpdate = now - state.lastUpdateTime;
      let predictedX = state.targetX;
      let predictedY = state.targetY;

      // Only extrapolate for short periods (< 100ms) to avoid overshooting
      // FIXED: Reduced from 200ms to 100ms and added velocity clamping
      if (timeSinceUpdate < 100 && timeSinceUpdate > 0) {
        const extrapolationFactor = timeSinceUpdate / 1000;
        // Clamp extrapolation to prevent extreme jumps
        const maxExtrapolation = 50; // Max 50px extrapolation
        const extraX = Math.max(-maxExtrapolation, Math.min(maxExtrapolation, state.velocityX * extrapolationFactor));
        const extraY = Math.max(-maxExtrapolation, Math.min(maxExtrapolation, state.velocityY * extrapolationFactor));
        predictedX += extraX;
        predictedY += extraY;
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

    // Interpolate other players (not local player) with same fixed approach
    for (const [id, player] of Object.entries(this.state.players)) {
      if (id === this.playerId) continue; // Skip local player

      let state = entityStates.players.get(id);

      if (!state) {
        // FIXED: Track serverX/serverY separately for players too
        state = {
          serverX: player.x,    // Last known server position
          serverY: player.y,
          displayX: player.x,   // Current rendered position
          displayY: player.y,
          targetX: player.x,    // Interpolation target
          targetY: player.y,
          velocityX: 0,
          velocityY: 0,
          lastUpdateTime: now
        };
        entityStates.players.set(id, state);
      }

      // FIXED: Compare against stored server position to detect REAL server updates
      if (player.x !== state.serverX || player.y !== state.serverY) {
        const timeSinceLastUpdate = now - state.lastUpdateTime;
        if (timeSinceLastUpdate > 0 && timeSinceLastUpdate < 500) {
          // Velocity based on server-to-server position change
          state.velocityX = (player.x - state.serverX) / timeSinceLastUpdate * 1000;
          state.velocityY = (player.y - state.serverY) / timeSinceLastUpdate * 1000;
        } else {
          state.velocityX = 0;
          state.velocityY = 0;
        }
        // Update stored server position
        state.serverX = player.x;
        state.serverY = player.y;
        state.targetX = player.x;
        state.targetY = player.y;
        state.lastUpdateTime = now;
      }

      // Extrapolate and smooth with clamping
      const timeSinceUpdate = now - state.lastUpdateTime;
      let predictedX = state.targetX;
      let predictedY = state.targetY;

      // FIXED: Reduced extrapolation window and added clamping
      if (timeSinceUpdate < 100 && timeSinceUpdate > 0) {
        const extrapolationFactor = timeSinceUpdate / 1000;
        const maxExtrapolation = 50;
        const extraX = Math.max(-maxExtrapolation, Math.min(maxExtrapolation, state.velocityX * extrapolationFactor));
        const extraY = Math.max(-maxExtrapolation, Math.min(maxExtrapolation, state.velocityY * extrapolationFactor));
        predictedX += extraX;
        predictedY += extraY;
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
   * FIX: Added zombie and wall collision detection for visual consistency
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

      if (!bullet) continue;

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

      // FIX: Check collision with walls (client-side visual feedback)
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

      // FIX: Check collision with zombies (client-side visual feedback)
      // This prevents bullets from visually passing through zombies
      const bulletSize = bullet.size || bulletBaseSize;
      let hitZombie = false;
      for (const zombieId in zombies) {
        const zombie = zombies[zombieId];
        if (!zombie || zombie.isDead) continue;

        // Circle-circle collision
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
   * FIX: Improved reconciliation logic with network latency awareness
   */
  reconcilePredictedBullets() {
    const now = Date.now();
    // FIX: Use network latency to determine reconciliation age
    // Add buffer for processing delays (min 150ms to account for RTT + server processing)
    const RECONCILIATION_AGE = Math.max(150, this.networkLatency * 1.5 + 50);

    // If we have server bullets, remove old predicted bullets
    const serverBulletCount = Object.keys(this.state.bullets).length;
    if (serverBulletCount > 0) {
      const bulletIds = Object.keys(this.predictedBullets);
      for (let i = 0; i < bulletIds.length; i++) {
        const bulletId = bulletIds[i];
        const bullet = this.predictedBullets[bulletId];
        if (!bullet) continue;

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
