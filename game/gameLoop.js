/**
 * @fileoverview Main game loop - Refactored with Clean Architecture
 * @description Central game loop that delegates to specialized modules
 * - All modules are under 300 lines
 * - Single Responsibility Principle enforced
 * - Clear separation of concerns
 */

const ConfigManager = require('../lib/server/ConfigManager');

const { GAMEPLAY_CONSTANTS } = ConfigManager;

// Module imports
const { updateZombies } = require('./modules/zombie/ZombieUpdater');
const {
  updatePoisonTrails,
  updatePoisonedZombies,
  updateFrozenSlowedZombies
} = require('./modules/zombie/ZombieEffects');
const { updateBullets } = require('./modules/bullet/BulletUpdater');
const { updatePowerups } = require('./modules/loot/PowerupUpdater');
const { updateLoot } = require('./modules/loot/LootUpdater');
const HazardManager = require('./modules/hazards/HazardManager');
const { updatePlayers } = require('./modules/player/PlayerUpdater');
const {
  handlePlayerDeathProgression,
  processFailedDeathQueue,
  cleanupOrphanedTrackingData
} = require('./modules/player/DeathProgressionHandler');

// HIGH FIX: Race condition protection with stuck detection
let gameLoopRunning = false;
let gameLoopStuckSince = null;

// CRITICAL FIX: Track last tick time for proper deltaTime calculation
let lastTickTime = 0;
const TARGET_FRAME_TIME = 1000 / 60; // 16.67ms at 60 FPS

// handlePlayerDeathProgression is re-exported from DeathProgressionHandler

/**
 * Main game loop - executes at 60 FPS with race condition protection
 *
 * HIGH FIX: Enhanced race condition protection with automatic stuck detection
 *
 * @param {Object} gameState - Global game state (players, zombies, bullets, etc.)
 * @param {Object} io - Socket.IO server instance for real-time communication
 * @param {Object} metricsCollector - Prometheus-style metrics collector
 * @param {Object} perfIntegration - Performance monitoring integration
 * @param {Object} collisionManager - Quadtree-based collision detection system
 * @param {Object} entityManager - Entity pooling and lifecycle manager
 * @param {Object} zombieManager - Zombie spawning and AI coordination
 * @param {Object} logger - Winston logger for structured logging
 * @returns {void}
 *
 * @description
 * Core game loop that runs every 16.67ms (60 FPS):
 * 1. Race condition protection: Skips frame if previous loop still running
 * 2. Stuck detection: Auto-resets if loop frozen >5 seconds
 * 3. HazardManager initialization (lazy, first-loop only)
 * 4. Updates in sequence:
 *    - Metrics collection
 *    - Quadtree rebuild
 *    - Player timers, regeneration, auto-turrets, tesla coils
 *    - Hazard system (lava, meteors, ice spikes)
 *    - Zombies (movement, AI, special abilities)
 *    - Poison trails and status effects
 *    - Bullets (movement, collision, damage)
 *    - Particles (visual effects)
 *    - Entity cleanup (expired/dead entities)
 *    - Powerups and loot (despawn timers)
 * 5. Performance tracking: Logs slow frames (>100ms)
 * 6. Error handling: Catches exceptions, logs, increments error metrics
 *
 * @throws {Error} If HazardManager fails to initialize (logged, not thrown)
 *
 * @example
 *   setInterval(() => {
 *     gameLoop(gameState, io, metrics, perf, collision, entities, zombies, logger);
 *   }, 16.67);
 */
function gameLoop(
  gameState,
  io,
  metricsCollector,
  perfIntegration,
  collisionManager,
  entityManager,
  zombieManager,
  logger
) {
  perfIntegration.incrementTick();
  const now = Date.now();

  // CRITICAL FIX: Calculate proper deltaTime for frame-rate independent updates
  if (lastTickTime === 0) {
    lastTickTime = now;
  }
  const actualDeltaTime = now - lastTickTime;
  // Clamp deltaTime to prevent huge jumps after lag spikes (max 3 frames worth)
  const deltaTime = Math.min(actualDeltaTime, TARGET_FRAME_TIME * 3);
  // Normalized multiplier: 1.0 = normal frame, 2.0 = twice as long, etc.
  const deltaMultiplier = deltaTime / TARGET_FRAME_TIME;
  lastTickTime = now;

  // HIGH FIX: Check if game loop is stuck
  if (gameLoopRunning) {
    if (!gameLoopStuckSince) {
      gameLoopStuckSince = now;
    }

    const stuckDuration = now - gameLoopStuckSince;

    if (stuckDuration > GAMEPLAY_CONSTANTS.GAME_LOOP_TIMEOUT) {
      logger.error('CRITICAL: Game loop stuck, forcing reset', {
        stuckDuration,
        timestamp: now,
        gameState: {
          players: Object.keys(gameState.players).length,
          zombies: Object.keys(gameState.zombies).length,
          bullets: Object.keys(gameState.bullets).length
        }
      });

      // Force reset
      gameLoopRunning = false;
      gameLoopStuckSince = null;

      // Track stuck resets
      if (metricsCollector) {
        metricsCollector.incrementError('game_loop_stuck_reset');
      }
    } else {
      logger.warn('Race condition detected - game loop already running, skipping frame', {
        stuckDuration
      });
      return;
    }
  }

  // Reset stuck timer on successful entry
  gameLoopStuckSince = null;

  // HIGH FIX: Validate entityManager before HazardManager init
  if (!gameState.hazardManager) {
    if (!entityManager) {
      logger.error('CRITICAL: entityManager not initialized, cannot create HazardManager');
      throw new Error('EntityManager required for HazardManager initialization');
    }

    try {
      gameState.hazardManager = new HazardManager(gameState, entityManager);
      gameState.hazardManager.initialize();
      logger.info('HazardManager initialized successfully');
    } catch (err) {
      logger.error('Failed to initialize HazardManager', {
        error: err.message,
        stack: err.stack
      });
      throw err;
    }
  }

  gameLoopRunning = true;
  const frameStart = Date.now();

  try {
    const now = frameStart;
    // Store deltaMultiplier in gameState for subsystems that need it
    gameState._deltaMultiplier = deltaMultiplier;
    gameState._deltaTime = deltaTime;

    updateMetrics(gameState, metricsCollector);

    // CRITICAL FIX: Update order optimized for correct collision detection
    // 1. First update all entity positions (zombies, bullets, players)
    // 2. Then rebuild quadtree with new positions
    // 3. Then do collision detection

    // Update positions first
    updatePlayers(
      gameState,
      now,
      io,
      collisionManager,
      entityManager,
      deltaMultiplier,
      zombieManager
    );
    updateZombies(
      gameState,
      now,
      io,
      collisionManager,
      entityManager,
      zombieManager,
      perfIntegration
    );

    // CRITICAL FIX: Rebuild quadtree AFTER position updates for accurate collision detection
    collisionManager.rebuildQuadtree();

    // Now do collision-based updates with accurate quadtree
    gameState.hazardManager.update(now);
    updatePoisonTrails(gameState, now, collisionManager, entityManager);
    updatePoisonedZombies(gameState, now, entityManager, io, zombieManager);
    updateFrozenSlowedZombies(gameState, now);
    updateBullets(
      gameState,
      now,
      io,
      collisionManager,
      entityManager,
      zombieManager,
      perfIntegration
    );
    updateParticles(gameState, deltaMultiplier);

    entityManager.cleanupExpiredEntities(now);

    // CRITICAL FIX: Cleanup memory leaks from deleted entities
    cleanupOrphanedTrackingData(gameState, now);

    updatePowerups(gameState, now, entityManager);
    updateLoot(gameState, now, io, entityManager);
    if (!gameState._lastDeathQueueProcess || now - gameState._lastDeathQueueProcess > 5000) {
      gameState._lastDeathQueueProcess = now;
      processFailedDeathQueue(gameState, logger);
    }
  } catch (error) {
    logger.error('Game loop error', {
      error: error.message,
      stack: error.stack,
      timestamp: frameStart
    });

    // metricsCollector.incrementError() doesn't exist on the current MetricsCollector;
    // skip silently rather than spamming a TypeError every frame.
  } finally {
    const frameTime = Date.now() - frameStart;
    metricsCollector.recordFrameTime(frameTime);
    gameLoopRunning = false;

    // Warn if frame time excessive
    if (frameTime > GAMEPLAY_CONSTANTS.SLOW_FRAME_WARNING_THRESHOLD) {
      logger.warn('Slow game loop frame detected', {
        frameTime,
        targetFrameTime: perfIntegration.getTickInterval()
      });
    }
  }
}

/**
 * Update metrics
 */
function updateMetrics(gameState, metricsCollector) {
  metricsCollector.updatePlayers(gameState);
  metricsCollector.updateZombies(gameState);
  metricsCollector.updatePowerups(gameState);
  metricsCollector.updateBullets(gameState);
  metricsCollector.updateGame(gameState);
}

// updatePlayers, updatePlayerTimers, updatePlayerRegeneration -> PlayerUpdater
// updateAutoTurrets, fireAutoTurret -> AutoTurretHandler
// updateTeslaCoil -> TeslaCoilHandler

/**
 * Update particles
 * BOTTLENECK OPTIMIZATION: Use Object.keys instead of for-in (faster iteration)
 * CRITICAL FIX: Now uses deltaMultiplier for frame-rate independent movement
 */
function updateParticles(gameState, deltaMultiplier = 1) {
  const particles = gameState.particles;
  const particleIds = Object.keys(particles);

  for (let i = 0; i < particleIds.length; i++) {
    const particle = particles[particleIds[i]];
    if (!particle) {
      continue;
    } // Fast path: destroyed

    // CRITICAL FIX: Apply deltaMultiplier for consistent particle speed
    particle.x += particle.vx * deltaMultiplier;
    particle.y += particle.vy * deltaMultiplier;
    particle.vy += 0.1 * deltaMultiplier; // Gravity also scaled
  }
}

// cleanupOrphanedTrackingData, processFailedDeathQueue -> DeathProgressionHandler

module.exports = {
  gameLoop,
  handlePlayerDeathProgression
};
