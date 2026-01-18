/**
 * @fileoverview Bullet collision handlers
 * @description Handles collisions between bullets and zombies/players
 * OPTIMIZED: All requires moved to module level to avoid repeated lookups
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const { distance } = require('../../utilityFunctions');
const MathUtils = require('../../../lib/MathUtils');
const { createParticles, createLoot } = require('../../lootFunctions');

const { CONFIG, ZOMBIE_TYPES } = ConfigManager;

// OPTIMIZATION: Pre-load all dependencies at module level instead of inside loops
const { handleSplitterDeath } = require('../zombie/ZombieEffects');
const { handleNewWave } = require('../wave/WaveManager');
const { updatePlayerCombo } = require('../player/PlayerProgression');

// OPTIMIZATION: Pre-load BulletEffects at module level
const BulletEffects = require('./BulletEffects');

// Lazy-loaded reference for circular dependency (gameLoop)
let handlePlayerDeathProgressionRef = null;
function getHandlePlayerDeathProgression() {
  if (!handlePlayerDeathProgressionRef) {
    handlePlayerDeathProgressionRef = require('../../gameLoop').handlePlayerDeathProgression;
  }
  return handlePlayerDeathProgressionRef;
}

/**
 * Handle zombie bullet collisions with players
 */
function handleZombieBulletCollisions(bullet, bulletId, gameState, entityManager) {
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];

    if (!player.alive || !player.hasNickname || player.spawnProtection || player.invisible) {
      continue;
    }

    if (distance(bullet.x, bullet.y, player.x, player.y) < CONFIG.PLAYER_SIZE) {
      if (Math.random() < (player.dodgeChance || 0)) {
        entityManager.destroyBullet(bulletId);
        break;
      }

      player.health -= bullet.damage;

      if (player.health <= 0) {
        // OPTIMIZATION: Use cached reference instead of require() in loop
        getHandlePlayerDeathProgression()(player, playerId, gameState, Date.now(), false);
      }

      createParticles(player.x, player.y, '#ff0000', 8, entityManager);
      entityManager.destroyBullet(bulletId);
      break;
    }
  }
}

/**
 * Handle player bullet collisions with zombies
 */
function handlePlayerBulletCollisions(bullet, bulletId, gameState, io, collisionManager, entityManager, zombieManager, perfIntegration) {
  const hitZombies = collisionManager.checkBulletZombieCollisions(bullet);

  for (const {id: zombieId, zombie} of hitZombies) {
    if (bullet.piercedZombies && bullet.piercedZombies.includes(zombieId)) {
      continue;
    }

    const finalDamage = calculateFinalDamage(bullet, zombie, entityManager);
    zombie.health -= finalDamage;

    applyLifeSteal(bullet, gameState, finalDamage);
    handlePiercing(bullet, bulletId, zombieId, entityManager);

    // OPTIMIZATION: BulletEffects already imported at module level
    BulletEffects.handleExplosiveBullet(bullet, zombie, zombieId, gameState, entityManager);
    BulletEffects.handleChainLightning(bullet, zombie, zombieId, gameState, entityManager, collisionManager, io);
    BulletEffects.handlePoisonDart(bullet, zombie, zombieId, gameState, entityManager);
    BulletEffects.handleIceCannon(bullet, zombie, zombieId, gameState, entityManager);

    createParticles(zombie.x, zombie.y, zombie.color, 5, entityManager);

    if (zombie.health <= 0) {
      handleZombieDeath(zombie, zombieId, bullet, gameState, io, entityManager, zombieManager, perfIntegration);
    }
    break;
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
    finalDamage *= (1 - bossType.shieldDamageReduction);
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
 */
function handleZombieDeath(zombie, zombieId, bullet, gameState, io, entityManager, zombieManager, perfIntegration) {
  createParticles(zombie.x, zombie.y, zombie.color, 15, entityManager);

  if (zombie.type === 'explosive') {
    handleExplosiveZombieDeath(zombie, zombieId, gameState, entityManager);
  }

  if (zombie.type === 'splitter') {
    // OPTIMIZATION: handleSplitterDeath imported at module level
    handleSplitterDeath(zombie, zombieId, gameState, entityManager);
    delete gameState.zombies[zombieId];
    gameState.zombiesKilledThisWave++;
    return;
  }

  saveDeadZombie(zombie, gameState);

  const { goldBonus, xpBonus } = calculateLootBonus(bullet, zombie, gameState, io);
  createLoot(zombie.x, zombie.y, goldBonus, xpBonus, gameState);

  cleanupZombieDamageTracking(zombieId, gameState);

  delete gameState.zombies[zombieId];
  gameState.zombiesKilledThisWave++;

  if (zombie.isBoss) {
    // OPTIMIZATION: handleNewWave imported at module level
    handleNewWave(gameState, io, zombieManager);
  }
}

/**
 * Handle explosive zombie death
 */
// OPTIMIZATION: createExplosion imported at module level via lootFunctions
const { createExplosion } = require('../../lootFunctions');

function handleExplosiveZombieDeath(zombie, zombieId, gameState, entityManager) {
  const explosiveType = ZOMBIE_TYPES.explosive;
  createExplosion(zombie.x, zombie.y, explosiveType.explosionRadius, false, entityManager);

  for (const otherId in gameState.zombies) {
    if (otherId !== zombieId) {
      const other = gameState.zombies[otherId];
      const dist = distance(zombie.x, zombie.y, other.x, other.y);
      if (dist < explosiveType.explosionRadius) {
        other.health -= explosiveType.explosionDamage;
        createParticles(other.x, other.y, other.color, 8, entityManager);
      }
    }
  }

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
        // OPTIMIZATION: Use cached reference instead of require() in loop
        getHandlePlayerDeathProgression()(player, playerId, gameState, Date.now(), false);
      }
    }
  }
}

/**
 * Save dead zombie for necromancer
 */
function saveDeadZombie(zombie, gameState) {
  if (!gameState.deadZombies) {
    gameState.deadZombies = {};
  }
  const deadZombieId = `dead_${Date.now()}_${Math.random()}`;
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
    deathTime: Date.now()
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
  handlePlayerBulletCollisions
};
