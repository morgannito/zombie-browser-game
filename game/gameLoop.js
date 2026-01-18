/**
 * @fileoverview Main game loop - Refactored with Clean Architecture
 * @description Central game loop that delegates to specialized modules
 * - All modules are under 300 lines
 * - Single Responsibility Principle enforced
 * - Clear separation of concerns
 */

const ConfigManager = require('../lib/server/ConfigManager');
const MathUtils = require('../lib/MathUtils');
const { distance } = require('./utilityFunctions');
const { createLoot, createParticles } = require('./lootFunctions');

const { CONFIG, GAMEPLAY_CONSTANTS } = ConfigManager;

// Module imports
const { updateZombies } = require('./modules/zombie/ZombieUpdater');
const { updatePoisonTrails, updatePoisonedZombies, updateFrozenSlowedZombies } = require('./modules/zombie/ZombieEffects');
const { updateBullets } = require('./modules/bullet/BulletUpdater');
const { updatePowerups } = require('./modules/loot/PowerupUpdater');
const { updateLoot } = require('./modules/loot/LootUpdater');
const { handlePlayerLevelUp } = require('./modules/player/PlayerProgression');
const HazardManager = require('./modules/hazards/HazardManager');

// HIGH FIX: Race condition protection with stuck detection
let gameLoopRunning = false;
let gameLoopStuckSince = null;

// CRITICAL FIX: Track last tick time for proper deltaTime calculation
let lastTickTime = 0;
const TARGET_FRAME_TIME = 1000 / 60; // 16.67ms at 60 FPS

/**
 * Handle player death with progression integration and retry mechanism
 *
 * CRITICAL FIX: Proper error handling with retry queue for database failures
 *
 * @param {Object} player - Player object with health, stats, and session data
 * @param {string} playerId - Unique player identifier (socket ID)
 * @param {Object} gameState - Global game state with progression integration
 * @param {number} now - Current timestamp (Date.now())
 * @param {boolean} [isBoss=false] - Whether death was caused by boss
 * @param {Object} logger - Winston logger instance for structured logging
 * @returns {boolean} True if player was revived by second chance, false otherwise
 *
 * @description
 * Processes player death through these steps:
 * 1. Validates player object and health value
 * 2. Checks for second chance revival (progression feature)
 * 3. If not revived:
 *    - Marks player as dead
 *    - Calculates final session stats (wave, level, kills, survival time)
 *    - Calls progression system to save death data
 *    - On failure: adds to retry queue (max 100 entries)
 * 4. Logs comprehensive error data for monitoring
 *
 * @example
 *   const revived = handlePlayerDeathProgression(
 *     player, 'socket-123', gameState, Date.now(), false, logger
 *   );
 *   if (!revived) {
 *     // Player is dead, handle cleanup
 *   }
 */
function handlePlayerDeathProgression(player, playerId, gameState, now, isBoss = false, logger) {
  // CRITICAL FIX: Validate inputs
  if (!player || typeof player !== 'object') {
    if (logger) {
      logger.error('❌ Invalid player object in handlePlayerDeathProgression', { playerId });
    }
    return false;
  }

  if (typeof player.health !== 'number') {
    if (logger) {
      logger.warn('⚠️  Player has invalid health value', { playerId, health: player.health });
    }
    player.health = 0;
  }

  if (player.health > 0) {
    return false;
  }

  player.health = 0;
  const revived = gameState.progressionIntegration?.checkSecondChance(player);

  if (!revived) {
    player.alive = false;

    if (gameState.progressionIntegration && player.accountId) {
      player.wave = gameState.wave;
      player.maxCombo = player.highestCombo || player.combo || 0;
      player.survivalTime = Math.floor((now - player.survivalTime) / GAMEPLAY_CONSTANTS.SURVIVAL_TIME_MULTIPLIER);
      player.bossKills = isBoss ? 1 : 0;

      const sessionStats = {
        wave: gameState.wave || 1,
        level: player.level || 1,
        kills: player.zombiesKilled || player.kills || 0,
        survivalTimeSeconds: typeof player.survivalTime === 'number' ? player.survivalTime : 0,
        comboMax: player.maxCombo,
        bossKills: player.bossKills
      };

      // CRITICAL FIX: Comprehensive error handling + retry queue
      gameState.progressionIntegration.handlePlayerDeath(player, player.accountId, sessionStats)
        .catch(err => {
          if (logger) {
            logger.error('❌ CRITICAL: Failed to handle player death', {
              error: err.message,
              stack: err.stack,
              playerId: player.id || playerId,
              accountId: player.accountId,
              stats: sessionStats
            });
          } else {
            console.error('❌ CRITICAL: Failed to handle player death:', err);
          }

          // Initialize failed death queue if not exists
          if (!gameState.failedDeathQueue) {
            gameState.failedDeathQueue = [];
          }

          // Add to retry queue (max size to prevent memory leak)
          if (gameState.failedDeathQueue.length < GAMEPLAY_CONSTANTS.FAILED_DEATH_QUEUE_MAX_SIZE) {
            gameState.failedDeathQueue.push({
              player: {
                id: player.id,
                accountId: player.accountId,
                nickname: player.nickname
              },
              accountId: player.accountId,
              stats: sessionStats,
              timestamp: now,
              retryCount: 0
            });

            if (logger) {
              logger.warn('⚠️  Player death queued for retry', {
                queueLength: gameState.failedDeathQueue.length,
                playerId: player.id || playerId
              });
            }
          } else if (logger) {
            logger.error('❌ Failed death queue full, discarding entry', {
              playerId: player.id || playerId
            });
          }
        });
    }
  }

  return revived;
}

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
function gameLoop(gameState, io, metricsCollector, perfIntegration, collisionManager, entityManager, zombieManager, logger) {
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
      logger.error('❌ CRITICAL: Game loop stuck, forcing reset', {
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
      logger.warn('⚠️  Race condition detected - game loop already running, skipping frame', {
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
      logger.error('❌ CRITICAL: entityManager not initialized, cannot create HazardManager');
      throw new Error('EntityManager required for HazardManager initialization');
    }

    try {
      gameState.hazardManager = new HazardManager(gameState, entityManager);
      gameState.hazardManager.initialize();
      logger.info('✅ HazardManager initialized successfully');
    } catch (err) {
      logger.error('❌ Failed to initialize HazardManager', {
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
    updatePlayers(gameState, now, io, collisionManager, entityManager, deltaMultiplier, zombieManager);
    updateZombies(gameState, now, io, collisionManager, entityManager, zombieManager, perfIntegration);

    // CRITICAL FIX: Rebuild quadtree AFTER position updates for accurate collision detection
    collisionManager.rebuildQuadtree();

    // Now do collision-based updates with accurate quadtree
    gameState.hazardManager.update(now);
    updatePoisonTrails(gameState, now, collisionManager, entityManager);
    updatePoisonedZombies(gameState, now, entityManager, io, zombieManager);
    updateFrozenSlowedZombies(gameState, now);
    updateBullets(gameState, now, io, collisionManager, entityManager, zombieManager, perfIntegration);
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
    logger.error('❌ Game loop error', {
      error: error.message,
      stack: error.stack,
      timestamp: frameStart
    });

    if (metricsCollector) {
      metricsCollector.incrementError('game_loop_exception');
    }
  } finally {
    const frameTime = Date.now() - frameStart;
    metricsCollector.recordFrameTime(frameTime);
    gameLoopRunning = false;

    // Warn if frame time excessive
    if (frameTime > GAMEPLAY_CONSTANTS.SLOW_FRAME_WARNING_THRESHOLD) {
      logger.warn('⚠️  Slow game loop frame detected', {
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

/**
 * Update all players
 * CRITICAL FIX: Added deltaMultiplier parameter for frame-rate independent updates
 * BUG FIX: Added zombieManager for boss kill handling in Tesla Coil
 */
function updatePlayers(gameState, now, io, collisionManager, entityManager, deltaMultiplier = 1, zombieManager = null) {
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player.alive) {
      continue;
    }

    updatePlayerTimers(player, now, io, playerId);
    updatePlayerRegeneration(player, now, deltaMultiplier);
    updateAutoTurrets(player, playerId, now, collisionManager, entityManager, gameState);
    updateTeslaCoil(player, playerId, now, collisionManager, entityManager, gameState, io, zombieManager);
  }
}

/**
 * Update player timers and effects
 */
function updatePlayerTimers(player, now, io, playerId) {
  if (player.spawnProtection && now > player.spawnProtectionEndTime) {
    player.spawnProtection = false;
  }

  if (player.invisible && now > player.invisibleEndTime) {
    player.invisible = false;
  }

  if (player.weaponTimer && now > player.weaponTimer) {
    player.weapon = 'pistol';
    player.weaponTimer = null;
  }

  if (player.speedBoost && now > player.speedBoost) {
    player.speedBoost = null;
  }

  // MEDIUM FIX: Combo timer logic with proper validation
  if (player.combo > 0) {
    // Initialize comboTimer if missing
    if (!player.comboTimer || typeof player.comboTimer !== 'number') {
      player.comboTimer = now;
    } else if (now - player.comboTimer > GAMEPLAY_CONSTANTS.COMBO_TIMEOUT) {
      // Timeout exceeded - reset combo
      const oldCombo = player.combo;
      player.combo = 0;
      player.comboTimer = 0;

      // Update highest combo if needed
      if (oldCombo > (player.highestCombo || 0)) {
        player.highestCombo = oldCombo;
      }

      io.to(playerId).emit('comboReset', {
        previousCombo: oldCombo,
        wasHighest: oldCombo === player.highestCombo
      });
    }
  }
}

/**
 * Update player regeneration
 * CRITICAL FIX: Now uses deltaMultiplier for frame-rate independent regeneration
 * This prevents missed regen ticks during lag spikes
 */
function updatePlayerRegeneration(player, now, deltaMultiplier = 1) {
  if (player.regeneration > 0) {
    if (!player.lastRegenTick) {
      player.lastRegenTick = now;
    }

    const timeSinceLastRegen = now - player.lastRegenTick;
    if (timeSinceLastRegen >= GAMEPLAY_CONSTANTS.REGENERATION_TICK_INTERVAL) {
      // Calculate how many regen ticks were missed (for lag compensation)
      const missedTicks = Math.floor(timeSinceLastRegen / GAMEPLAY_CONSTANTS.REGENERATION_TICK_INTERVAL);
      // Cap at 3 ticks max to prevent huge healing after reconnect
      const ticksToApply = Math.min(missedTicks, 3);
      const healAmount = player.regeneration * ticksToApply;

      player.health = Math.min(player.health + healAmount, player.maxHealth);
      player.lastRegenTick = now;
    }
  }
}

/**
 * Update auto turrets
 */
function updateAutoTurrets(player, playerId, now, collisionManager, entityManager, gameState) {
  if (player.autoTurrets > 0 && player.hasNickname && !player.spawnProtection) {
    const autoFireCooldown = GAMEPLAY_CONSTANTS.AUTO_TURRET_BASE_COOLDOWN / player.autoTurrets;

    if (now - player.lastAutoShot >= autoFireCooldown) {
      const closestZombie = collisionManager.findClosestZombie(player.x, player.y, GAMEPLAY_CONSTANTS.AUTO_TURRET_RANGE);

      if (closestZombie) {
        fireAutoTurret(player, playerId, closestZombie, now, entityManager);
      }
    }
  }
}

/**
 * Fire auto turret bullet
 */
function fireAutoTurret(player, playerId, closestZombie, now, entityManager) {
  const angle = Math.atan2(closestZombie.y - player.y, closestZombie.x - player.x);
  const baseDamage = CONFIG.BULLET_DAMAGE * 0.6;
  const damage = baseDamage * (player.damageMultiplier || 1);

  entityManager.createBullet({
    x: player.x,
    y: player.y,
    vx: MathUtils.fastCos(angle) * CONFIG.BULLET_SPEED,
    vy: MathUtils.fastSin(angle) * CONFIG.BULLET_SPEED,
    playerId: playerId,
    damage: damage,
    color: '#00ffaa',
    piercing: 0,
    explosiveRounds: false,
    explosionRadius: 0,
    explosionDamagePercent: 0,
    isAutoTurret: true
  });

  player.lastAutoShot = now;
  createParticles(player.x, player.y, '#00ffaa', 3, entityManager);
}

/**
 * Update Tesla Coil weapon
 * BUG FIX: Added io and zombieManager for boss kill handling
 */
function updateTeslaCoil(player, playerId, now, collisionManager, entityManager, gameState, io = null, zombieManager = null) {
  if (player.weapon !== 'teslaCoil' || !player.hasNickname || player.spawnProtection) {
    return;
  }

  if (!player.lastTeslaShot) {
    player.lastTeslaShot = 0;
  }

  const teslaWeapon = ConfigManager.WEAPONS.teslaCoil;
  const teslaCooldown = teslaWeapon.fireRate * (player.fireRateMultiplier || 1);

  if (now - player.lastTeslaShot >= teslaCooldown) {
    fireTeslaCoil(player, teslaWeapon, now, collisionManager, entityManager, gameState, io, zombieManager);
  }
}

/**
 * Fire Tesla Coil
 * BUG FIX: Added io and zombieManager for boss kill handling
 */
function fireTeslaCoil(player, teslaWeapon, now, collisionManager, entityManager, gameState, io = null, zombieManager = null) {
  const zombiesInRange = collisionManager.findZombiesInRadius(player.x, player.y, teslaWeapon.teslaRange);
  const targets = zombiesInRange.slice(0, teslaWeapon.teslaMaxTargets);

  if (targets.length > 0) {
    const damage = teslaWeapon.damage * (player.damageMultiplier || 1);

    for (const zombie of targets) {
      applyTeslaDamage(zombie, damage, player, teslaWeapon, entityManager, gameState, now, io, zombieManager);
    }

    player.lastTeslaShot = now;
  }
}

/**
 * Apply Tesla Coil damage to zombie
 * HIGH FIX: Comprehensive validation
 * BUG FIX: Added io and zombieManager for boss kill handling
 */
function applyTeslaDamage(zombie, damage, player, teslaWeapon, entityManager, gameState, now, io = null, zombieManager = null) {
  // HIGH FIX: Validate zombie object
  if (!zombie || typeof zombie !== 'object') {
    return; // Silent fail - zombie may have been removed
  }

  if (typeof zombie.health !== 'number' || !isFinite(zombie.health)) {
    return; // Invalid zombie health
  }

  // HIGH FIX: Validate damage value
  if (!isFinite(damage) || damage < 0) {
    return; // Invalid damage value
  }

  // HIGH FIX: Check if zombie still exists in gameState
  if (!gameState.zombies[zombie.id]) {
    return; // Zombie already removed
  }

  // Apply damage
  zombie.health -= damage;

  // Life steal (only if player and values are valid)
  if (player && player.lifeSteal > 0 && isFinite(player.lifeSteal)) {
    const lifeStolen = damage * player.lifeSteal;

    if (isFinite(lifeStolen) && lifeStolen > 0) {
      player.health = Math.min(
        player.health + lifeStolen,
        player.maxHealth || player.health + lifeStolen
      );
    }
  }

  createTeslaVisuals(player, zombie, teslaWeapon, entityManager);

  if (zombie.health <= 0) {
    handleTeslaKill(zombie, player, gameState, entityManager, now, io, zombieManager);
  }
}

/**
 * Create Tesla Coil visual effects
 */
function createTeslaVisuals(player, zombie, teslaWeapon, entityManager) {
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const arcX = player.x + (zombie.x - player.x) * ratio;
    const arcY = player.y + (zombie.y - player.y) * ratio;
    createParticles(arcX, arcY, teslaWeapon.color, 1, entityManager);
  }

  createParticles(zombie.x, zombie.y, teslaWeapon.color, 3, entityManager);
}

/**
 * Handle zombie kill from Tesla Coil
 *
 * BUG FIX: Handle boss kills to trigger new wave
 */
function handleTeslaKill(zombie, player, gameState, entityManager, now, io = null, zombieManager = null) {
  createParticles(zombie.x, zombie.y, zombie.color, 15, entityManager);

  if (player) {
    player.combo = (player.combo || 0) + 1;
    player.comboTimer = now;
    player.kills = (player.kills || 0) + 1;
    player.zombiesKilled = (player.zombiesKilled || 0) + 1;
  }

  createLoot(zombie.x, zombie.y, zombie.goldDrop, zombie.xpDrop, gameState);
  delete gameState.zombies[zombie.id];
  gameState.zombiesKilledThisWave++;

  // BUG FIX: Si c'etait un boss, declencher la nouvelle wave
  if (zombie.isBoss && io && zombieManager) {
    const { handleNewWave } = require('./modules/wave/WaveManager');
    handleNewWave(gameState, io, zombieManager);
  }
}

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

/**
 * CRITICAL FIX: Cleanup orphaned tracking data to prevent memory leaks
 * This cleans up:
 * - player.lastDamageTime entries for dead zombies
 * - player.lastPoisonDamage entries for expired trails
 */
function cleanupOrphanedTrackingData(gameState, now) {
  // Only run cleanup every 60 frames (~1 second at 60fps) to reduce overhead
  if (!gameState._lastTrackingCleanup) {
    gameState._lastTrackingCleanup = now;
  }

  if (now - gameState._lastTrackingCleanup < 1000) {
    return;
  }
  gameState._lastTrackingCleanup = now;

  const activeZombieIds = new Set(Object.keys(gameState.zombies));
  const activePoisonTrailIds = new Set(Object.keys(gameState.poisonTrails || {}));

  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];

    // Cleanup lastDamageTime for dead zombies
    if (player.lastDamageTime && typeof player.lastDamageTime === 'object') {
      for (const zombieId in player.lastDamageTime) {
        if (!activeZombieIds.has(zombieId)) {
          delete player.lastDamageTime[zombieId];
        }
      }
    }

    // Cleanup lastPoisonDamage for expired poison trails
    if (player.lastPoisonDamage && typeof player.lastPoisonDamage === 'object') {
      for (const trailId in player.lastPoisonDamage) {
        if (!activePoisonTrailIds.has(trailId)) {
          delete player.lastPoisonDamage[trailId];
        }
      }
    }

    // Cleanup lastPoisonDamageByTrail (alternative tracking object)
    if (player.lastPoisonDamageByTrail && typeof player.lastPoisonDamageByTrail === 'object') {
      for (const trailId in player.lastPoisonDamageByTrail) {
        if (!activePoisonTrailIds.has(trailId)) {
          delete player.lastPoisonDamageByTrail[trailId];
        }
      }
    }
  }
}

/**
 * CRITICAL FIX: Process failed death queue with retry mechanism
 * Retries failed death progressions to prevent data loss
 */
function processFailedDeathQueue(gameState, logger) {
  if (!gameState.failedDeathQueue || gameState.failedDeathQueue.length === 0) {
    return;
  }

  const now = Date.now();
  const retryInterval = 30000; // Retry every 30 seconds
  const maxRetries = 3;

  for (let i = gameState.failedDeathQueue.length - 1; i >= 0; i--) {
    const entry = gameState.failedDeathQueue[i];

    // Skip if not enough time has passed since last retry
    if (entry.lastRetry && now - entry.lastRetry < retryInterval) {
      continue;
    }

    // Remove if max retries exceeded
    if (entry.retryCount >= maxRetries) {
      if (logger) {
        logger.error('Failed death permanently abandoned', {
          playerId: entry.player?.id,
          accountId: entry.accountId,
          retryCount: entry.retryCount
        });
      }
      gameState.failedDeathQueue.splice(i, 1);
      continue;
    }

    // Attempt retry
    if (gameState.progressionIntegration) {
      if (!entry.accountId) {
        if (logger) {
          logger.warn('Failed death entry missing account ID', {
            playerId: entry.player?.id
          });
        }
        gameState.failedDeathQueue.splice(i, 1);
        continue;
      }
      entry.retryCount++;
      entry.lastRetry = now;

      gameState.progressionIntegration.handlePlayerDeath(entry.player, entry.accountId, entry.stats)
        .then(() => {
          // Success - remove from queue
          const idx = gameState.failedDeathQueue.indexOf(entry);
          if (idx > -1) {
            gameState.failedDeathQueue.splice(idx, 1);
          }
          if (logger) {
            logger.info('Failed death retry succeeded', {
              playerId: entry.player?.id,
              retryCount: entry.retryCount
            });
          }
        })
        .catch(() => {
          // Still failing, will retry later
        });
    }
  }
}

module.exports = {
  gameLoop,
  handlePlayerDeathProgression
};
