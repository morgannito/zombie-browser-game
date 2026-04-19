/**
 * @fileoverview Bullet collision handlers
 * @description Handles collisions between bullets and zombies/players
 * OPTIMIZED: All requires moved to module level to avoid repeated lookups
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const { distance } = require('../../../game/utilityFunctions');
const { createParticles, createLoot, createExplosion } = require('../../../game/lootFunctions');
const MathUtils = require('../../../lib/MathUtils');

let _deadZombieCounter = 0;

const { CONFIG, ZOMBIE_TYPES } = ConfigManager;

// OPTIMIZATION: Pre-load all dependencies at module level instead of inside loops
const { handleSplitterDeath } = require('../../zombie/modules/ZombieEffects');
const { handleNewWave } = require('../../wave/modules/WaveManager');
const { updatePlayerCombo } = require('../../player/modules/PlayerProgression');

// OPTIMIZATION: Pre-load BulletEffects at module level
const BulletEffects = require('./BulletEffects');

// Direct import: DeathProgressionHandler is a leaf module (depends only on
// ConfigManager) so no cycle risk. Previously routed through gameLoop.
const { handlePlayerDeathProgression } = require('../../player/modules/DeathProgressionHandler');

/**
 * Handle zombie bullet collisions with players.
 * Destroys the bullet on first hit; applies dodge chance.
 * @param {Object} bullet
 * @param {string} bulletId
 * @param {Object} gameState
 * @param {Object} entityManager
 * @param {Object} collisionManager
 */
function handleZombieBulletCollisions(
  bullet,
  bulletId,
  gameState,
  entityManager,
  collisionManager
) {
  const bulletSize = bullet.size || CONFIG.BULLET_SIZE || 5;
  const candidates = collisionManager.findPlayersInRadius(
    bullet.x,
    bullet.y,
    CONFIG.PLAYER_SIZE + bulletSize
  );

  for (const player of candidates) {
    if (!player.alive || !player.hasNickname || player.spawnProtection || player.invisible) {
      continue;
    }

    if (
      !MathUtils.circleCollision(
        bullet.x,
        bullet.y,
        bulletSize,
        player.x,
        player.y,
        CONFIG.PLAYER_SIZE
      )
    ) {
      continue;
    }

    if (Math.random() < (player.dodgeChance || 0)) {
      entityManager.destroyBullet(bulletId);
      break;
    }

    player.health -= bullet.damage;

    if (player.health <= 0) {
      handlePlayerDeathProgression(player, player.id, gameState, Date.now(), false);
    }

    createParticles(player.x, player.y, '#ff0000', 8, entityManager);
    entityManager.destroyBullet(bulletId);
    break;
  }
}

/**
 * Handle player bullet collisions with zombies.
 * Applies damage, piercing logic, special effects, and triggers zombie death.
 * @param {Object} bullet
 * @param {string} bulletId
 * @param {Object} gameState
 * @param {Object} io
 * @param {Object} collisionManager
 * @param {Object} entityManager
 * @param {Object} zombieManager
 * @param {*} _perfIntegration
 */
function handlePlayerBulletCollisions(
  bullet,
  bulletId,
  gameState,
  io,
  collisionManager,
  entityManager,
  zombieManager,
  _perfIntegration
) {
  const hitZombies = collisionManager.checkBulletZombieCollisions(bullet);

  for (const { id: zombieId, zombie } of hitZombies) {
    // FIX: Check if bullet was destroyed (e.g., by exceeding pierce limit)
    if (!gameState.bullets[bulletId]) {
      break;
    }

    if (bullet.piercedZombies && bullet.piercedZombies.includes(zombieId)) {
      continue;
    }

    const finalDamage = calculateFinalDamage(bullet, zombie, entityManager);
    zombie.health -= finalDamage;

    applyLifeSteal(bullet, gameState, finalDamage);
    handlePiercing(bullet, bulletId, zombieId, entityManager);

    // OPTIMIZATION: BulletEffects already imported at module level
    BulletEffects.handleExplosiveBullet(
      bullet,
      zombie,
      zombieId,
      gameState,
      entityManager,
      collisionManager
    );
    BulletEffects.handleChainLightning(
      bullet,
      zombie,
      zombieId,
      gameState,
      entityManager,
      collisionManager,
      io
    );
    BulletEffects.handlePoisonDart(bullet, zombie, zombieId, gameState, entityManager);
    BulletEffects.handleIceCannon(bullet, zombie, zombieId, gameState, entityManager);

    createParticles(zombie.x, zombie.y, zombie.color, 5, entityManager);

    if (zombie.health <= 0) {
      handleZombieDeath(
        zombie,
        zombieId,
        bullet,
        gameState,
        io,
        entityManager,
        zombieManager,
        _perfIntegration
      );
    }

    // FIX: Only break if bullet has no piercing or was destroyed
    // Piercing bullets continue to hit multiple zombies in the same frame
    if (!gameState.bullets[bulletId]) {
      break;
    }
  }
}

/**
 * Calculate final damage with shield reductions
 */
function calculateFinalDamage(bullet, zombie, entityManager) {
  let finalDamage = bullet.damage;

  if (zombie.type === 'shielded' && zombie.facingAngle !== null) {
    const shieldedType = ZOMBIE_TYPES.shielded;
    const bulletAngle = Math.atan2(bullet.vy, bullet.vx);

    let angleDiff = bulletAngle - zombie.facingAngle;
    while (angleDiff > Math.PI) {
      angleDiff -= Math.PI * 2;
    }
    while (angleDiff < -Math.PI) {
      angleDiff += Math.PI * 2;
    }

    if (Math.abs(angleDiff) < shieldedType.shieldAngle) {
      finalDamage *= shieldedType.frontDamageReduction;
      createParticles(zombie.x, zombie.y, '#00ffff', 10, entityManager);
    }
  }

  if (zombie.type === 'bossColosse' && zombie.hasShield) {
    const bossType = ZOMBIE_TYPES.bossColosse;
    finalDamage *= 1 - bossType.shieldDamageReduction;
    createParticles(zombie.x, zombie.y, bossType.shieldColor, 15, entityManager);
  }

  return finalDamage;
}

/**
 * Apply life steal to shooter
 */
function applyLifeSteal(bullet, gameState, damage) {
  if (bullet.playerId) {
    const shooter = gameState.players[bullet.playerId];
    if (shooter && shooter.lifeSteal > 0) {
      const lifeStolen = damage * shooter.lifeSteal;
      shooter.health = Math.min(shooter.health + lifeStolen, shooter.maxHealth);
    }
  }
}

/**
 * Handle piercing bullets
 */
function handlePiercing(bullet, bulletId, zombieId, entityManager) {
  if (bullet.piercing > 0 && bullet.piercedZombies) {
    bullet.piercedZombies.push(zombieId);
    if (bullet.piercedZombies.length > bullet.piercing) {
      entityManager.destroyBullet(bulletId);
    }
  } else {
    entityManager.destroyBullet(bulletId);
  }
}

/**
 * Handle zombie death from bullet
 * @param {Object} zombie
 * @param {string} zombieId
 * @param {Object} bullet
 * @param {Object} gameState
 * @param {Object} io
 * @param {Object} entityManager
 * @param {Object} zombieManager
 * @param {*} _perfIntegration
 */
function handleZombieDeath(
  zombie,
  zombieId,
  bullet,
  gameState,
  io,
  entityManager,
  zombieManager,
  _perfIntegration
) {
  createParticles(zombie.x, zombie.y, zombie.color, 15, entityManager);

  if (zombie.type === 'explosive') {
    handleExplosiveZombieDeath(zombie, zombieId, gameState, entityManager);
  }

  if (zombie.type === 'splitter') {
    handleSplitterDeath(zombie, zombieId, gameState, entityManager);
    delete gameState.zombies[zombieId];
    gameState.collisionManager?.invalidatePathfindingCache(zombieId);
    gameState.zombiesKilledThisWave++;
    return;
  }

  handleNonSplitterZombieDeath(
    zombie,
    zombieId,
    bullet,
    gameState,
    io,
    entityManager,
    zombieManager
  );
}

/**
 * Finalize death for non-splitter zombies: loot, cleanup, wave progression.
 * @param {Object} zombie
 * @param {string} zombieId
 * @param {Object} bullet
 * @param {Object} gameState
 * @param {Object} io
 * @param {Object} entityManager
 * @param {Object} zombieManager
 */
function handleNonSplitterZombieDeath(
  zombie,
  zombieId,
  bullet,
  gameState,
  io,
  entityManager,
  zombieManager
) {
  saveDeadZombie(zombie, gameState);

  const { goldBonus, xpBonus } = calculateLootBonus(bullet, zombie, gameState, io);
  createLoot(zombie.x, zombie.y, goldBonus, xpBonus, gameState);

  cleanupZombieDamageTracking(zombieId, gameState);

  delete gameState.zombies[zombieId];
  gameState.collisionManager?.invalidatePathfindingCache(zombieId);
  gameState.zombiesKilledThisWave++;

  if (zombie.isBoss) {
    handleNewWave(gameState, io, zombieManager);
  }
}

/**
 * Handle explosive zombie death: chain explosion to nearby zombies and players.
 * @param {Object} zombie - The dying explosive zombie
 * @param {string} zombieId
 * @param {Object} gameState
 * @param {Object} entityManager
 */
function handleExplosiveZombieDeath(zombie, zombieId, gameState, entityManager) {
  const explosiveType = ZOMBIE_TYPES.explosive;
  createExplosion(zombie.x, zombie.y, explosiveType.explosionRadius, false, entityManager);
  _applyExplosiveZombieDamageToZombies(zombie, zombieId, explosiveType, gameState, entityManager);
  _applyExplosiveZombieDamageToPlayers(zombie, explosiveType, gameState, entityManager);
}

/**
 * Apply explosive zombie splash damage to nearby zombies.
 * BUG FIX: use entity.entityId (not entity.id) when reading quadtree wrappers.
 * @param {Object} zombie
 * @param {string} zombieId
 * @param {Object} explosiveType
 * @param {Object} gameState
 * @param {Object} entityManager
 */
function _applyExplosiveZombieDamageToZombies(
  zombie,
  zombieId,
  explosiveType,
  gameState,
  entityManager
) {
  const radius = explosiveType.explosionRadius;
  const radiusSq = radius * radius;
  const cm = gameState.collisionManager;
  const candidates =
    cm && cm.quadtree && typeof cm.quadtree.queryRadius === 'function'
      ? cm.quadtree.queryRadius(zombie.x, zombie.y, radius)
      : null;

  if (candidates) {
    for (const entity of candidates) {
      // BUG FIX: quadtree wrappers use entityId, not id
      if (!entity || entity.entityId === undefined) {
        continue;
      }
      if (String(entity.entityId) === String(zombieId)) {
        continue;
      }
      const other = gameState.zombies[entity.entityId];
      if (!other) {
        continue;
      }
      const dx = zombie.x - other.x;
      const dy = zombie.y - other.y;
      if (dx * dx + dy * dy < radiusSq) {
        other.health -= explosiveType.explosionDamage;
        createParticles(other.x, other.y, other.color, 8, entityManager);
      }
    }
  } else {
    for (const otherId in gameState.zombies) {
      if (otherId === zombieId) {
        continue;
      }
      const other = gameState.zombies[otherId];
      const dx = zombie.x - other.x;
      const dy = zombie.y - other.y;
      if (dx * dx + dy * dy < radiusSq) {
        other.health -= explosiveType.explosionDamage;
        createParticles(other.x, other.y, other.color, 8, entityManager);
      }
    }
  }
}

/**
 * Apply explosive zombie splash damage to nearby players.
 * @param {Object} zombie
 * @param {Object} explosiveType
 * @param {Object} gameState
 * @param {Object} entityManager
 */
function _applyExplosiveZombieDamageToPlayers(zombie, explosiveType, gameState, entityManager) {
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player.alive || player.spawnProtection || player.invisible) {
      continue;
    }
    const dist = distance(zombie.x, zombie.y, player.x, player.y);
    if (dist < explosiveType.explosionRadius) {
      player.health -= explosiveType.explosionDamage;
      createParticles(player.x, player.y, '#ff8800', 10, entityManager);
      if (player.health <= 0) {
        handlePlayerDeathProgression(player, playerId, gameState, Date.now(), false);
      }
    }
  }
}

/**
 * Save dead zombie for necromancer
 */
const DEAD_ZOMBIE_TTL_MS = 30000;

function evictExpiredDeadZombies(deadZombies, now) {
  for (const id in deadZombies) {
    if (now - deadZombies[id].deathTime > DEAD_ZOMBIE_TTL_MS) {
      delete deadZombies[id];
    }
  }
}

function saveDeadZombie(zombie, gameState) {
  if (!gameState.deadZombies) {
    gameState.deadZombies = {};
  }
  const now = Date.now();
  evictExpiredDeadZombies(gameState.deadZombies, now);
  const deadZombieId = 'dead_' + ++_deadZombieCounter;
  gameState.deadZombies[deadZombieId] = {
    x: zombie.x,
    y: zombie.y,
    type: zombie.type,
    size: zombie.size,
    color: zombie.color,
    maxHealth: zombie.maxHealth,
    speed: zombie.speed,
    damage: zombie.damage,
    goldDrop: zombie.goldDrop,
    xpDrop: zombie.xpDrop,
    deathTime: now
  };
}

/**
 * Calculate loot bonus with combo
 */
function calculateLootBonus(bullet, zombie, gameState, io) {
  let goldBonus = zombie.goldDrop;
  let xpBonus = zombie.xpDrop;

  if (bullet.playerId) {
    // OPTIMIZATION: updatePlayerCombo imported at module level
    const comboResult = updatePlayerCombo(bullet.playerId, zombie, gameState, io);
    if (comboResult) {
      goldBonus = comboResult.goldBonus;
      xpBonus = comboResult.xpBonus;
    }
  }

  return { goldBonus, xpBonus };
}

/**
 * Cleanup zombie damage tracking
 */
function cleanupZombieDamageTracking(zombieId, gameState) {
  for (const playerId in gameState.players) {
    const p = gameState.players[playerId];
    if (p.lastDamageTime && p.lastDamageTime[zombieId]) {
      delete p.lastDamageTime[zombieId];
    }
  }
}

module.exports = {
  handleZombieBulletCollisions,
  handlePlayerBulletCollisions,
  // Exported for unit tests
  calculateFinalDamage,
  applyLifeSteal,
  handlePiercing,
  saveDeadZombie,
  evictExpiredDeadZombies,
  calculateLootBonus,
  cleanupZombieDamageTracking,
  // Exported for regression tests (audit round 2)
  handleExplosiveZombieDeath,
  // Internal helpers exported for testing
  _applyExplosiveZombieDamageToZombies,
  _applyExplosiveZombieDamageToPlayers
};
