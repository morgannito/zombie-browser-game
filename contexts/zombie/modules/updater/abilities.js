/**
 * @fileoverview Per-type zombie ability processors (healer/slower/shooter/poison).
 * Extracted from ZombieUpdater.js for SRP. Each processor early-exits on type
 * mismatch so callers can fan out blindly via ABILITY_HANDLERS.
 */

const ConfigManager = require('../../../../lib/server/ConfigManager');
const MathUtils = require('../../../../lib/MathUtils');
const { createParticles } = require('../../../../game/lootFunctions');

const { ZOMBIE_TYPES } = ConfigManager;

function processHealerAbility(zombie, zombieId, now, collisionManager, entityManager) {
  if (zombie.type !== 'healer') {
    return;
  }
  const healerType = ZOMBIE_TYPES.healer;
  if (zombie.lastHeal && now - zombie.lastHeal < healerType.healCooldown) {
    return;
  }
  zombie.lastHeal = now;

  const nearbyZombies = collisionManager.findZombiesInRadius(
    zombie.x, zombie.y, healerType.healRadius, zombieId
  );
  for (const other of nearbyZombies) {
    if (other.health >= other.maxHealth) {
      continue;
    }
    other.health = Math.min(other.health + healerType.healAmount, other.maxHealth);
    createParticles(other.x, other.y, '#00ffff', 5, entityManager);
  }
}

function processSlowerAbility(zombie, now, collisionManager) {
  if (zombie.type !== 'slower') {
    return;
  }
  const slowerType = ZOMBIE_TYPES.slower;
  const nearbyPlayers = collisionManager.findPlayersInRadius(
    zombie.x, zombie.y, slowerType.slowRadius
  );
  for (const player of nearbyPlayers) {
    player.slowedUntil = now + slowerType.slowDuration;
    player.slowAmount = slowerType.slowAmount;
  }
}

function processShooterAbility(zombie, zombieId, now, collisionManager, entityManager) {
  if (zombie.type !== 'shooter') {
    return;
  }
  const shooterType = ZOMBIE_TYPES.shooter;
  if (zombie.lastShot && now - zombie.lastShot < shooterType.shootCooldown) {
    return;
  }
  const targetPlayer = collisionManager.findClosestPlayerCached(
    zombieId, zombie.x, zombie.y, shooterType.shootRange,
    { ignoreSpawnProtection: true, ignoreInvisible: false }
  );
  if (targetPlayer) {
    shootAtPlayer(zombie, zombieId, targetPlayer, shooterType, now, entityManager);
  }
}

function shootAtPlayer(zombie, zombieId, targetPlayer, shooterType, now, entityManager) {
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

function processPoisonTrail(zombie, now, gameState, entityManager) {
  if (zombie.type !== 'poison') {
    return;
  }
  const poisonType = ZOMBIE_TYPES.poison;
  if (zombie.lastPoisonTrail && now - zombie.lastPoisonTrail < poisonType.poisonTrailInterval) {
    return;
  }
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
  createParticles(zombie.x, zombie.y, poisonType.color, 3, entityManager);
}

module.exports = {
  processHealerAbility,
  processSlowerAbility,
  processShooterAbility,
  processPoisonTrail,
  shootAtPlayer
};
