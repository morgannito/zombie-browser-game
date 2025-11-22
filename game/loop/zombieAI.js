/**
 * ZOMBIE AI MODULE
 * Handles zombie special abilities and AI behaviors
 * Extracted from gameLoop.js for better code organization
 * @module zombieAI
 * @version 1.0.0
 */

const ConfigManager = require('../../lib/server/ConfigManager');
const { createParticles } = require('../lootFunctions');
const MathUtils = require('../../lib/MathUtils');

const { ZOMBIE_TYPES } = ConfigManager;

/**
 * Update all zombie special abilities
 * @param {Object} gameState - Game state
 * @param {Number} now - Current timestamp
 * @param {Object} io - Socket.IO instance
 * @param {Object} collisionManager - Collision manager
 * @param {Object} entityManager - Entity manager
 * @param {Object} zombieManager - Zombie manager
 */
function updateZombieAI(gameState, now, io, collisionManager, entityManager, zombieManager) {
  for (let zombieId in gameState.zombies) {
    const zombie = gameState.zombies[zombieId];

    // Healer zombie
    if (zombie.type === 'healer') {
      updateHealerZombie(zombie, zombieId, now, collisionManager, entityManager);
    }

    // Slower zombie
    else if (zombie.type === 'slower') {
      updateSlowerZombie(zombie, zombieId, now, collisionManager);
    }

    // Shooter zombie
    else if (zombie.type === 'shooter') {
      updateShooterZombie(zombie, zombieId, now, collisionManager, entityManager);
    }

    // Poison zombie
    else if (zombie.type === 'poison') {
      updatePoisonZombie(zombie, zombieId, now, gameState, entityManager);
    }

    // Note: Complex zombie types (teleporter, summoner, berserker, elite, boss)
    // are handled directly in gameLoop.js to avoid circular dependencies
    // This module only handles simple AI: healer, slower, shooter, poison
  }
}

/**
 * Update healer zombie
 */
function updateHealerZombie(zombie, zombieId, now, collisionManager, entityManager) {
  const healerType = ZOMBIE_TYPES.healer;
  if (!zombie.lastHeal || now - zombie.lastHeal >= healerType.healCooldown) {
    zombie.lastHeal = now;

    const nearbyZombies = collisionManager.findZombiesInRadius(
      zombie.x, zombie.y, healerType.healRadius, zombieId
    );

    for (let other of nearbyZombies) {
      if (other.health < other.maxHealth) {
        other.health = Math.min(other.health + healerType.healAmount, other.maxHealth);
        createParticles(other.x, other.y, '#00ffff', 5, entityManager);
      }
    }
  }
}

/**
 * Update slower zombie
 */
function updateSlowerZombie(zombie, zombieId, now, collisionManager) {
  const slowerType = ZOMBIE_TYPES.slower;
  const nearbyPlayers = collisionManager.findPlayersInRadius(
    zombie.x, zombie.y, slowerType.slowRadius
  );

  for (let player of nearbyPlayers) {
    player.slowedUntil = now + slowerType.slowDuration;
    player.slowAmount = slowerType.slowAmount;
  }
}

/**
 * Update shooter zombie
 */
function updateShooterZombie(zombie, zombieId, now, collisionManager, entityManager) {
  const shooterType = ZOMBIE_TYPES.shooter;

  if (!zombie.lastShot || now - zombie.lastShot >= shooterType.shootCooldown) {
    const targetPlayer = collisionManager.findClosestPlayer(
      zombie.x, zombie.y, shooterType.shootRange,
      { ignoreSpawnProtection: true, ignoreInvisible: false }
    );

    if (targetPlayer) {
      zombie.lastShot = now;
      const angle = Math.atan2(targetPlayer.y - zombie.y, targetPlayer.x - zombie.x);

      entityManager.createBullet({
        x: zombie.x,
        y: zombie.y,
        vx: MathUtils.fastCos(angle) * shooterType.bulletSpeed,
        vy: MathUtils.fastSin(angle) * shooterType.bulletSpeed,
        zombieId: zombieId,
        damage: zombie.damage,
        color: shooterType.bulletColor,
        isZombieBullet: true,
        piercing: 0,
        piercedZombies: [],
        explosiveRounds: false,
        explosionRadius: 0,
        explosionDamagePercent: 0
      });

      createParticles(zombie.x, zombie.y, shooterType.bulletColor, 5, entityManager);
    }
  }
}

/**
 * Update poison zombie
 */
function updatePoisonZombie(zombie, zombieId, now, gameState, entityManager) {
  const poisonType = ZOMBIE_TYPES.poison;

  if (!zombie.lastPoisonTrail || now - zombie.lastPoisonTrail >= poisonType.poisonTrailInterval) {
    zombie.lastPoisonTrail = now;

    const trailId = gameState.nextPoisonTrailId++;
    gameState.poisonTrails[trailId] = {
      id: trailId,
      x: zombie.x,
      y: zombie.y,
      radius: poisonType.poisonRadius,
      damage: poisonType.poisonDamage,
      createdAt: now,
      duration: poisonType.poisonDuration
    };

    createParticles(zombie.x, zombie.y, poisonType.color, 8, entityManager);
  }
}

module.exports = {
  updateZombieAI,
  updateHealerZombie,
  updateSlowerZombie,
  updateShooterZombie,
  updatePoisonZombie
};
