/**
 * @fileoverview Bullet special effects
 * @description Handles explosive, chain lightning, poison dart, and ice cannon effects
 * OPTIMIZED: Use distanceSquared to avoid sqrt, optimized loops
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const { distance } = require('../../utilityFunctions');
const MathUtils = require('../../../lib/MathUtils');
const { createParticles, createExplosion, createLoot } = require('../../lootFunctions');

/**
 * Handle explosive bullet effect
 */
function handleExplosiveBullet(bullet, zombie, zombieId, gameState, entityManager) {
  if (!bullet.explosiveRounds || bullet.explosionRadius <= 0) {
    return;
  }

  const explosionColor = bullet.isRocket ? '#ff0000' : '#ff8800';
  const particleCount = bullet.isRocket ? 40 : 20;

  createExplosion(zombie.x, zombie.y, bullet.explosionRadius, bullet.isRocket, entityManager);
  createParticles(zombie.x, zombie.y, explosionColor, particleCount, entityManager);

  if (bullet.isRocket) {
    createParticles(zombie.x, zombie.y, '#ff8800', 30, entityManager);
    createParticles(zombie.x, zombie.y, '#ffff00', 20, entityManager);
  }

  applyExplosionDamage(bullet, zombie, zombieId, gameState, entityManager);
}

/**
 * Apply explosion damage to nearby zombies
 * OPTIMIZED: Use distanceSquared to avoid expensive sqrt
 */
function applyExplosionDamage(bullet, zombie, zombieId, gameState, entityManager) {
  // OPTIMIZATION: Pre-calculate squared radius to avoid sqrt in loop
  const radiusSq = bullet.explosionRadius * bullet.explosionRadius;
  const explosionDmg = (bullet.rocketExplosionDamage !== null && bullet.rocketExplosionDamage !== undefined) ?
    bullet.rocketExplosionDamage :
    (bullet.damage * bullet.explosionDamagePercent);

  const zombieIds = Object.keys(gameState.zombies);
  for (let i = 0; i < zombieIds.length; i++) {
    const otherId = zombieIds[i];
    if (otherId !== zombieId) {
      const other = gameState.zombies[otherId];
      // OPTIMIZATION: Use distanceSquared instead of distance (avoids sqrt)
      const distSq = MathUtils.distanceSquared(zombie.x, zombie.y, other.x, other.y);
      if (distSq < radiusSq) {
        other.health -= explosionDmg;
        createParticles(other.x, other.y, other.color, 8, entityManager);
      }
    }
  }
}

/**
 * Handle chain lightning effect
 */
function handleChainLightning(bullet, zombie, zombieId, gameState, entityManager, collisionManager, io) {
  if (!bullet.isChainLightning) {
    return;
  }

  if (!bullet.chainJumps) {
    bullet.chainJumps = 0;
    bullet.chainedZombies = [zombieId];
  }

  const weapon = ConfigManager.WEAPONS.chainLightning;

  if (bullet.chainJumps < weapon.chainMaxJumps) {
    const target = findNextChainTarget(bullet, zombie, weapon, gameState);

    if (target) {
      processChainJump(bullet, zombie, target, weapon, gameState, entityManager, collisionManager, io);
    }
  }
}

/**
 * Find next chain lightning target
 * OPTIMIZED: Use distanceSquared and Set for O(1) lookup
 */
function findNextChainTarget(bullet, zombie, weapon, gameState) {
  // OPTIMIZATION: Pre-calculate squared range
  const chainRangeSq = weapon.chainRange * weapon.chainRange;
  let closestDistanceSq = chainRangeSq;
  let closestZombie = null;
  let closestZombieId = null;

  // OPTIMIZATION: Convert array to Set for O(1) lookup instead of O(n) includes()
  const chainedSet = new Set(bullet.chainedZombies);

  const zombieIds = Object.keys(gameState.zombies);
  for (let i = 0; i < zombieIds.length; i++) {
    const otherId = zombieIds[i];
    if (chainedSet.has(otherId)) {
      continue;
    }

    const other = gameState.zombies[otherId];
    // OPTIMIZATION: Use distanceSquared instead of distance
    const distSq = MathUtils.distanceSquared(zombie.x, zombie.y, other.x, other.y);

    if (distSq < closestDistanceSq) {
      closestDistanceSq = distSq;
      closestZombie = other;
      closestZombieId = otherId;
    }
  }

  return closestZombie ? { zombie: closestZombie, id: closestZombieId } : null;
}

/**
 * Process single chain lightning jump
 */
function processChainJump(bullet, sourceZombie, target, weapon, gameState, entityManager, collisionManager, io) {
  bullet.chainJumps++;
  bullet.chainedZombies.push(target.id);

  const chainDamage = bullet.damage * weapon.chainDamageReduction;
  target.zombie.health -= chainDamage;

  applyChainLifeSteal(bullet, chainDamage, gameState);
  createChainVisuals(sourceZombie, target.zombie, weapon, entityManager);

  if (target.zombie.health <= 0) {
    handleChainKill(target.zombie, target.id, bullet, gameState, entityManager);
  }

  bullet.damage = chainDamage;
  handleChainLightning(bullet, target.zombie, target.id, gameState, entityManager, collisionManager, io);
}

/**
 * Apply life steal from chain lightning
 */
function applyChainLifeSteal(bullet, chainDamage, gameState) {
  if (bullet.playerId) {
    const shooter = gameState.players[bullet.playerId];
    if (shooter && shooter.lifeSteal > 0) {
      const lifeStolen = chainDamage * shooter.lifeSteal;
      shooter.health = Math.min(shooter.health + lifeStolen, shooter.maxHealth);
    }
  }
}

/**
 * Create chain lightning visual effects
 */
function createChainVisuals(sourceZombie, targetZombie, weapon, entityManager) {
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const arcX = sourceZombie.x + (targetZombie.x - sourceZombie.x) * ratio;
    const arcY = sourceZombie.y + (targetZombie.y - sourceZombie.y) * ratio;
    const offset = Math.sin(i * Math.PI / 2) * 10;
    createParticles(arcX + offset, arcY, weapon.color, 2, entityManager);
  }

  createParticles(targetZombie.x, targetZombie.y, weapon.color, 8, entityManager);
}

/**
 * Handle zombie kill from chain lightning
 */
function handleChainKill(zombie, zombieId, bullet, gameState, entityManager) {
  createParticles(zombie.x, zombie.y, zombie.color, 15, entityManager);

  if (bullet.playerId) {
    const shooter = gameState.players[bullet.playerId];
    if (shooter) {
      shooter.combo = (shooter.combo || 0) + 1;
      shooter.comboTimer = Date.now();
      shooter.kills = (shooter.kills || 0) + 1;
      shooter.zombiesKilled = (shooter.zombiesKilled || 0) + 1;
    }
  }

  createLoot(zombie.x, zombie.y, zombie.goldDrop, zombie.xpDrop, gameState);
  delete gameState.zombies[zombieId];
  gameState.zombiesKilledThisWave++;
}

/**
 * Handle poison dart effect
 */
function handlePoisonDart(bullet, zombie, zombieId, gameState, entityManager) {
  if (!bullet.isPoisonDart) {
    return;
  }

  const weapon = ConfigManager.WEAPONS.poisonDart;
  const now = Date.now();

  if (!zombie.poisoned) {
    applyPoison(zombie, weapon, now, entityManager);
    spreadPoison(zombie, zombieId, weapon, gameState, now, entityManager);
  }
}

/**
 * Apply poison to zombie
 */
function applyPoison(zombie, weapon, now, entityManager) {
  zombie.poisoned = {
    damage: weapon.poisonDamage,
    duration: weapon.poisonDuration,
    startTime: now,
    lastTick: now,
    spreadRadius: weapon.poisonSpreadRadius,
    spreadChance: weapon.poisonSpreadChance
  };

  createParticles(zombie.x, zombie.y, '#00ff00', 10, entityManager);
}

/**
 * Spread poison to nearby zombies
 * OPTIMIZED: Use distanceSquared and optimized loop
 */
function spreadPoison(zombie, zombieId, weapon, gameState, now, entityManager) {
  if (Math.random() < weapon.poisonSpreadChance) {
    // OPTIMIZATION: Pre-calculate squared radius
    const spreadRadiusSq = weapon.poisonSpreadRadius * weapon.poisonSpreadRadius;

    const zombieIds = Object.keys(gameState.zombies);
    for (let i = 0; i < zombieIds.length; i++) {
      const otherId = zombieIds[i];
      if (otherId === zombieId) {
        continue;
      }

      const other = gameState.zombies[otherId];
      if (other.poisoned) {
        continue; // Early exit before distance calculation
      }

      // OPTIMIZATION: Use distanceSquared instead of distance
      const distSq = MathUtils.distanceSquared(zombie.x, zombie.y, other.x, other.y);

      if (distSq < spreadRadiusSq) {
        other.poisoned = {
          damage: weapon.poisonDamage * 0.7,
          duration: weapon.poisonDuration * 0.8,
          startTime: now,
          lastTick: now,
          spreadRadius: weapon.poisonSpreadRadius * 0.8,
          spreadChance: weapon.poisonSpreadChance * 0.5
        };

        createParticles(other.x, other.y, '#88ff00', 5, entityManager);
      }
    }
  }
}

/**
 * Handle ice cannon effect
 */
function handleIceCannon(bullet, zombie, zombieId, gameState, entityManager) {
  if (!bullet.isIceCannon) {
    return;
  }

  const weapon = ConfigManager.WEAPONS.iceCannon;
  const now = Date.now();

  const isFrozen = Math.random() < weapon.freezeChance;

  if (isFrozen) {
    freezeZombie(zombie, weapon, now, entityManager);
  } else {
    slowZombie(zombie, weapon, now, entityManager);
  }

  applyIceAreaEffect(zombie, zombieId, weapon, gameState, now, entityManager);
}

/**
 * Freeze zombie completely
 */
function freezeZombie(zombie, weapon, now, entityManager) {
  zombie.frozen = {
    startTime: now,
    duration: weapon.freezeDuration,
    originalSpeed: zombie.speed
  };
  zombie.speed = 0;

  createParticles(zombie.x, zombie.y, '#00ffff', 20, entityManager);
}

/**
 * Slow zombie
 */
function slowZombie(zombie, weapon, now, entityManager) {
  if (!zombie.slowed || zombie.slowed.endTime < now + weapon.slowDuration) {
    zombie.slowed = {
      startTime: now,
      endTime: now + weapon.slowDuration,
      originalSpeed: zombie.speed,
      slowAmount: weapon.slowAmount
    };
    zombie.speed = zombie.slowed.originalSpeed * (1 - weapon.slowAmount);

    createParticles(zombie.x, zombie.y, '#aaddff', 8, entityManager);
  }
}

/**
 * Apply ice area effect to nearby zombies
 * OPTIMIZED: Use distanceSquared and optimized loop
 */
function applyIceAreaEffect(zombie, zombieId, weapon, gameState, now, entityManager) {
  // OPTIMIZATION: Pre-calculate squared radius and common values
  const iceRadiusSq = weapon.iceExplosionRadius * weapon.iceExplosionRadius;
  const halfSlowDuration = weapon.slowDuration * 0.5;
  const reducedSlowAmount = weapon.slowAmount * 0.6;

  const zombieIds = Object.keys(gameState.zombies);
  for (let i = 0; i < zombieIds.length; i++) {
    const otherId = zombieIds[i];
    if (otherId === zombieId) {
      continue;
    }

    const other = gameState.zombies[otherId];

    // OPTIMIZATION: Early exit if already slowed long enough
    if (other.slowed && other.slowed.endTime >= now + halfSlowDuration) {
      continue;
    }

    // OPTIMIZATION: Use distanceSquared instead of distance
    const distSq = MathUtils.distanceSquared(zombie.x, zombie.y, other.x, other.y);

    if (distSq < iceRadiusSq) {
      other.slowed = {
        startTime: now,
        endTime: now + halfSlowDuration,
        originalSpeed: other.speed,
        slowAmount: reducedSlowAmount
      };
      other.speed = other.slowed.originalSpeed * (1 - reducedSlowAmount);

      createParticles(other.x, other.y, '#aaddff', 4, entityManager);
    }
  }
}

module.exports = {
  handleExplosiveBullet,
  handleChainLightning,
  handlePoisonDart,
  handleIceCannon
};
