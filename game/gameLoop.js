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

const { CONFIG } = ConfigManager;

// Module imports
const { updateZombies } = require('./modules/zombie/ZombieUpdater');
const { updatePoisonTrails, updatePoisonedZombies, updateFrozenSlowedZombies } = require('./modules/zombie/ZombieEffects');
const { updateBullets } = require('./modules/bullet/BulletUpdater');
const { updatePowerups } = require('./modules/loot/PowerupUpdater');
const { updateLoot } = require('./modules/loot/LootUpdater');
const { handlePlayerLevelUp } = require('./modules/player/PlayerProgression');
const HazardManager = require('./modules/hazards/HazardManager');

// Race condition protection
let gameLoopRunning = false;

/**
 * Handle player death with progression integration
 * CRITICAL FIX: Proper error handling and retry queue
 */
function handlePlayerDeathProgression(player, playerId, gameState, now, isBoss = false, logger) {
  // CRITICAL FIX: Validate inputs
  if (!player || typeof player !== 'object') {
    if (logger) logger.error('❌ Invalid player object in handlePlayerDeathProgression', { playerId });
    return false;
  }

  if (typeof player.health !== 'number') {
    if (logger) logger.warn('⚠️  Player has invalid health value', { playerId, health: player.health });
    player.health = 0;
  }

  if (player.health > 0) return false;

  player.health = 0;
  const revived = gameState.progressionIntegration?.checkSecondChance(player);

  if (!revived) {
    player.alive = false;

    if (gameState.progressionIntegration && player.sessionId) {
      player.wave = gameState.wave;
      player.maxCombo = player.highestCombo || player.combo || 0;
      player.survivalTime = Math.floor((now - player.survivalTime) / 1000);
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
      gameState.progressionIntegration.handlePlayerDeath(player, player.sessionId, sessionStats)
        .catch(err => {
          if (logger) {
            logger.error('❌ CRITICAL: Failed to handle player death', {
              error: err.message,
              stack: err.stack,
              playerId: player.id || playerId,
              sessionId: player.sessionId,
              stats: sessionStats
            });
          } else {
            console.error('❌ CRITICAL: Failed to handle player death:', err);
          }

          // Initialize failed death queue if not exists
          if (!gameState.failedDeathQueue) {
            gameState.failedDeathQueue = [];
          }

          // Add to retry queue (max 100 entries to prevent memory leak)
          if (gameState.failedDeathQueue.length < 100) {
            gameState.failedDeathQueue.push({
              player: {
                id: player.id,
                sessionId: player.sessionId,
                nickname: player.nickname
              },
              sessionId: player.sessionId,
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
 * Main game loop function
 */
function gameLoop(gameState, io, metricsCollector, perfIntegration, collisionManager, entityManager, zombieManager, logger) {
  perfIntegration.incrementTick();

  if (gameLoopRunning) {
    logger.warn('Race condition detected - game loop already running, skipping frame');
    return;
  }

  // Initialize HazardManager on first run
  if (!gameState.hazardManager) {
    gameState.hazardManager = new HazardManager(gameState, entityManager);
    gameState.hazardManager.initialize();
  }

  gameLoopRunning = true;
  let frameStart = Date.now();

  try {
    const now = frameStart;

    updateMetrics(gameState, metricsCollector);
    collisionManager.rebuildQuadtree();

    updatePlayers(gameState, now, io, collisionManager, entityManager);
    gameState.hazardManager.update(now);
    updateZombies(gameState, now, io, collisionManager, entityManager, zombieManager, perfIntegration);
    updatePoisonTrails(gameState, now, collisionManager, entityManager);
    updatePoisonedZombies(gameState, now, entityManager);
    updateFrozenSlowedZombies(gameState, now);
    updateBullets(gameState, now, io, collisionManager, entityManager, zombieManager, perfIntegration);
    updateParticles(gameState);

    entityManager.cleanupExpiredEntities(now);
    updatePowerups(gameState, now, entityManager);
    updateLoot(gameState, now, io, entityManager);

  } catch (error) {
    logger.error('Game loop error', { error: error.message, stack: error.stack });
  } finally {
    const frameTime = Date.now() - frameStart;
    metricsCollector.recordFrameTime(frameTime);
    gameLoopRunning = false;
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
 */
function updatePlayers(gameState, now, io, collisionManager, entityManager) {
  for (let playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player.alive) continue;

    updatePlayerTimers(player, now, io, playerId);
    updatePlayerRegeneration(player, now);
    updateAutoTurrets(player, playerId, now, collisionManager, entityManager, gameState);
    updateTeslaCoil(player, playerId, now, collisionManager, entityManager, gameState);
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

  const COMBO_TIMEOUT = 5000;
  if (player.combo > 0 && player.comboTimer > 0 && now - player.comboTimer > COMBO_TIMEOUT) {
    player.combo = 0;
    player.comboTimer = 0;
    io.to(playerId).emit('comboReset');
  }
}

/**
 * Update player regeneration
 */
function updatePlayerRegeneration(player, now) {
  if (player.regeneration > 0) {
    if (!player.lastRegenTick || now - player.lastRegenTick >= 1000) {
      player.health = Math.min(player.health + player.regeneration, player.maxHealth);
      player.lastRegenTick = now;
    }
  }
}

/**
 * Update auto turrets
 */
function updateAutoTurrets(player, playerId, now, collisionManager, entityManager, gameState) {
  if (player.autoTurrets > 0 && player.hasNickname && !player.spawnProtection) {
    const autoFireCooldown = 600 / player.autoTurrets;

    if (now - player.lastAutoShot >= autoFireCooldown) {
      const closestZombie = collisionManager.findClosestZombie(player.x, player.y, 500);

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
 */
function updateTeslaCoil(player, playerId, now, collisionManager, entityManager, gameState) {
  if (player.weapon !== 'teslaCoil' || !player.hasNickname || player.spawnProtection) return;

  if (!player.lastTeslaShot) player.lastTeslaShot = 0;

  const teslaWeapon = ConfigManager.WEAPONS.teslaCoil;
  const teslaCooldown = teslaWeapon.fireRate * (player.fireRateMultiplier || 1);

  if (now - player.lastTeslaShot >= teslaCooldown) {
    fireTeslaCoil(player, teslaWeapon, now, collisionManager, entityManager, gameState);
  }
}

/**
 * Fire Tesla Coil
 */
function fireTeslaCoil(player, teslaWeapon, now, collisionManager, entityManager, gameState) {
  const zombiesInRange = collisionManager.findZombiesInRadius(player.x, player.y, teslaWeapon.teslaRange);
  const targets = zombiesInRange.slice(0, teslaWeapon.teslaMaxTargets);

  if (targets.length > 0) {
    const damage = teslaWeapon.damage * (player.damageMultiplier || 1);

    for (let zombie of targets) {
      applyTeslaDamage(zombie, damage, player, teslaWeapon, entityManager, gameState, now);
    }

    player.lastTeslaShot = now;
  }
}

/**
 * Apply Tesla Coil damage to zombie
 */
function applyTeslaDamage(zombie, damage, player, teslaWeapon, entityManager, gameState, now) {
  zombie.health -= damage;

  if (player.lifeSteal > 0) {
    const lifeStolen = damage * player.lifeSteal;
    player.health = Math.min(player.health + lifeStolen, player.maxHealth);
  }

  createTeslaVisuals(player, zombie, teslaWeapon, entityManager);

  if (zombie.health <= 0) {
    handleTeslaKill(zombie, player, gameState, entityManager, now);
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
 */
function handleTeslaKill(zombie, player, gameState, entityManager, now) {
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
}

/**
 * Update particles
 */
function updateParticles(gameState) {
  for (let particleId in gameState.particles) {
    const particle = gameState.particles[particleId];
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.1;
  }
}

module.exports = {
  gameLoop,
  handlePlayerDeathProgression
};
