/**
 * @fileoverview Bullet special effects
 * @description Handles explosive, chain lightning, poison dart, and ice cannon effects
 * OPTIMIZED: Use distanceSquared to avoid sqrt, optimized loops
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const MathUtils = require('../../../lib/MathUtils');
const { createParticles, createExplosion, createLoot } = require('../../../game/lootFunctions');

/**
 * Handle explosive bullet effect
 */
function handleExplosiveBullet(bullet, zombie, zombieId, gameState, entityManager, collisionManager) {
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

  applyExplosionDamage(bullet, zombie, zombieId, gameState, entityManager, collisionManager);
}

/**
 * Apply explosion damage to nearby zombies
 * PERF: quadtree radius query (O(log n + k)) instead of Object.keys full scan
 * over every zombie. Falls back to the scan when the quadtree isn't available
 * (tests / bootstrap phases).
 */
function applyExplosionDamage(bullet, zombie, zombieId, gameState, entityManager, collisionManager) {
  const radius = bullet.explosionRadius;
  const radiusSq = radius * radius;
  const explosionDmg = (bullet.rocketExplosionDamage !== null && bullet.rocketExplosionDamage !== undefined) ?
    bullet.rocketExplosionDamage :
    (bullet.damage * bullet.explosionDamagePercent);

  const candidates = collisionManager && collisionManager.quadtree
    ? collisionManager.quadtree.queryRadius(zombie.x, zombie.y, radius)
    : null;

  if (candidates) {
    for (let i = 0; i < candidates.length; i++) {
      const wrap = candidates[i];
      if (wrap.type !== 'zombie' || wrap.entityId === zombieId) {
        continue;
      }
      const other = gameState.zombies[wrap.entityId];
      if (!other) {
        continue;
      }
      other.health -= explosionDmg;
      createParticles(other.x, other.y, other.color, 8, entityManager);
      if (other.health <= 0) {
        handleChainKill(other, wrap.entityId, bullet, gameState, entityManager);
      }
    }
    return;
  }

  // Fallback (no quadtree yet): original full scan.
  for (const otherId in gameState.zombies) {
    if (otherId === zombieId) {
      continue;
    }
    const other = gameState.zombies[otherId];
    const distSq = MathUtils.distanceSquared(zombie.x, zombie.y, other.x, other.y);
    if (distSq < radiusSq) {
      other.health -= explosionDmg;
      createParticles(other.x, other.y, other.color, 8, entityManager);
      if (other.health <= 0) {
        handleChainKill(other, otherId, bullet, gameState, entityManager);
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

  // Reuse Set from bullet if already built; only create once per chain sequence.
  if (!bullet._chainedSet) {
    bullet._chainedSet = new Set(bullet.chainedZombies);
  }
  const chainedSet = bullet._chainedSet;

  for (const otherId in gameState.zombies) {
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
  if (bullet._chainedSet) {
    bullet._chainedSet.add(target.id);
  }

  // FIX: Use chainDamage for current chain effect without modifying bullet.damage
  // This preserves original damage for any subsequent piercing hits
  const chainDamage = (bullet.chainDamage || bullet.damage) * weapon.chainDamageReduction;
  target.zombie.health -= chainDamage;

  applyChainLifeSteal(bullet, chainDamage, gameState);
  createChainVisuals(sourceZombie, target.zombie, weapon, entityManager);

  if (target.zombie.health <= 0) {
    handleChainKill(target.zombie, target.id, bullet, gameState, entityManager);
  }

  // FIX: Store chain damage separately instead of overwriting bullet.damage
  bullet.chainDamage = chainDamage;
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
  gameState.collisionManager?.invalidatePathfindingCache(zombieId);
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

    for (const otherId in gameState.zombies) {
      if (otherId === zombieId) {
        continue;
      }
      const other = gameState.zombies[otherId];
      if (other.poisoned) {
        continue;
      }
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
  // FIX: Get the true original speed, not the currently reduced speed
  // Priority: existing frozen originalSpeed > existing slowed originalSpeed > baseSpeed > current speed
  const trueOriginalSpeed = zombie.frozen?.originalSpeed ||
                            zombie.slowed?.originalSpeed ||
                            zombie.baseSpeed ||
                            zombie.speed;

  zombie.frozen = {
    startTime: now,
    duration: weapon.freezeDuration,
    originalSpeed: trueOriginalSpeed
  };
  zombie.speed = 0;

  createParticles(zombie.x, zombie.y, '#00ffff', 20, entityManager);
}

/**
 * Slow zombie
 */
function slowZombie(zombie, weapon, now, entityManager) {
  if (!zombie.slowed || zombie.slowed.endTime < now + weapon.slowDuration) {
    // FIX: Get the true original speed, not the currently reduced speed
    // Priority: existing slowed originalSpeed > existing frozen originalSpeed > baseSpeed > current speed
    const trueOriginalSpeed = zombie.slowed?.originalSpeed ||
                              zombie.frozen?.originalSpeed ||
                              zombie.baseSpeed ||
                              zombie.speed;

    zombie.slowed = {
      startTime: now,
      endTime: now + weapon.slowDuration,
      originalSpeed: trueOriginalSpeed,
      slowAmount: weapon.slowAmount
    };
    zombie.speed = trueOriginalSpeed * (1 - weapon.slowAmount);

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

  for (const otherId in gameState.zombies) {
    if (otherId === zombieId) {
      continue;
    }
    const other = gameState.zombies[otherId];
    if (other.slowed && other.slowed.endTime >= now + halfSlowDuration) {
      continue;
    }
    const distSq = MathUtils.distanceSquared(zombie.x, zombie.y, other.x, other.y);
    if (distSq < iceRadiusSq) {
      // BUGFIX: when zombie is already slowed/frozen, other.speed is the
      // already-reduced value. Snapshotting it as 'originalSpeed' bakes in
      // the slow → after expiry the zombie never recovers true base speed.
      // Resolve through the existing chain (mirrors freezeZombie/slowZombie).
      const trueOriginalSpeed =
        (other.slowed && other.slowed.originalSpeed) ||
        (other.frozen && other.frozen.originalSpeed) ||
        other.baseSpeed ||
        other.speed;
      other.slowed = {
        startTime: now,
        endTime: now + halfSlowDuration,
        originalSpeed: trueOriginalSpeed,
        slowAmount: reducedSlowAmount
      };
      other.speed = trueOriginalSpeed * (1 - reducedSlowAmount);

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
