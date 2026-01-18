/**
 * @fileoverview Main zombie update logic
 * @description Core zombie update function and movement
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const MathUtils = require('../../../lib/MathUtils');
const { distance } = require('../../utilityFunctions');
const { createParticles } = require('../../lootFunctions');

const { CONFIG, ZOMBIE_TYPES } = ConfigManager;

// LATENCY OPTIMIZATION: Cache boss/special updaters to avoid repeated requires
const {
  updateTeleporterZombie, updateSummonerZombie, updateBerserkerZombie,
  updateNecromancerZombie, updateBruteZombie, updateMimicZombie
} = require('./SpecialZombieUpdater');

const {
  updateBossCharnier, updateBossInfect, updateBossColosse, updateBossRoi, updateBossOmega,
  updateBossInfernal, updateBossCryos, updateBossVortex, updateBossNexus, updateBossApocalypse
} = require('./BossUpdater');

/**
 * Main zombie update function
 * LATENCY OPTIMIZATION: Fast-path guards to skip boss/special updates for regular zombies
 */
function updateZombies(gameState, now, io, collisionManager, entityManager, zombieManager, perfIntegration) {
  const zombies = gameState.zombies;
  const zombieIds = Object.keys(zombies);

  for (let i = 0; i < zombieIds.length; i++) {
    const zombieId = zombieIds[i];
    const zombie = zombies[zombieId];

    if (!zombie) {
      continue;
    } // Fast path: destroyed

    const zombieType = zombie.type;

    // LATENCY OPTIMIZATION: Early returns for type-specific abilities
    if (zombieType === 'healer') {
      processHealerAbility(zombie, zombieId, now, collisionManager, entityManager);
    }
    if (zombieType === 'slower') {
      processSlowerAbility(zombie, now, collisionManager);
    }
    if (zombieType === 'shooter') {
      processShooterAbility(zombie, zombieId, now, collisionManager, entityManager);
    }
    if (zombieType === 'poison') {
      processPoisonTrail(zombie, now, gameState, entityManager);
    }

    // LATENCY OPTIMIZATION: Type guards prevent calling boss functions for regular zombies
    if (zombieType === 'teleporter') {
      updateTeleporterZombie(zombie, zombieId, now, collisionManager, entityManager, gameState);
    }
    if (zombieType === 'summoner') {
      updateSummonerZombie(zombie, zombieId, now, zombieManager, entityManager, gameState);
    }
    if (zombieType === 'berserker') {
      updateBerserkerZombie(zombie, zombieId, now, collisionManager, entityManager, gameState);
    }
    if (zombieType === 'necromancer') {
      updateNecromancerZombie(zombie, zombieId, now, entityManager, gameState);
    }
    if (zombieType === 'brute') {
      updateBruteZombie(zombie, zombieId, now, collisionManager, entityManager, gameState);
    }
    if (zombieType === 'mimic') {
      updateMimicZombie(zombie, zombieId, now, collisionManager, entityManager, gameState);
    }

    // Boss updates (rare, so grouped together)
    if (zombieType === 'charnier') {
      updateBossCharnier(zombie, now, zombieManager, perfIntegration, entityManager, gameState);
    }
    if (zombieType === 'infect') {
      updateBossInfect(zombie, now, entityManager, gameState);
    }
    if (zombieType === 'colosse') {
      updateBossColosse(zombie, zombieId, now, io, entityManager);
    }
    if (zombieType === 'roi') {
      updateBossRoi(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState, collisionManager);
    }
    if (zombieType === 'omega') {
      updateBossOmega(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState, collisionManager);
    }
    if (zombieType === 'infernal') {
      updateBossInfernal(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState);
    }
    if (zombieType === 'cryos') {
      updateBossCryos(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState);
    }
    if (zombieType === 'vortex') {
      updateBossVortex(zombie, zombieId, now, io, entityManager, gameState);
    }
    if (zombieType === 'nexus') {
      updateBossNexus(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState, collisionManager);
    }
    if (zombieType === 'apocalypse') {
      updateBossApocalypse(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState, collisionManager);
    }

    moveZombie(zombie, zombieId, collisionManager, gameState);
  }
}

/**
 * Process healer zombie ability
 */
function processHealerAbility(zombie, zombieId, now, collisionManager, entityManager) {
  if (zombie.type !== 'healer') {
    return;
  }

  const healerType = ZOMBIE_TYPES.healer;
  if (!zombie.lastHeal || now - zombie.lastHeal >= healerType.healCooldown) {
    zombie.lastHeal = now;

    const nearbyZombies = collisionManager.findZombiesInRadius(
      zombie.x, zombie.y, healerType.healRadius, zombieId
    );

    for (const other of nearbyZombies) {
      if (other.health < other.maxHealth) {
        other.health = Math.min(other.health + healerType.healAmount, other.maxHealth);
        createParticles(other.x, other.y, '#00ffff', 5, entityManager);
      }
    }
  }
}

/**
 * Process slower zombie ability
 */
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

/**
 * Process shooter zombie ability
 */
function processShooterAbility(zombie, zombieId, now, collisionManager, entityManager) {
  if (zombie.type !== 'shooter') {
    return;
  }

  const shooterType = ZOMBIE_TYPES.shooter;

  if (!zombie.lastShot || now - zombie.lastShot >= shooterType.shootCooldown) {
    // SSSS OPTIMIZATION: Use cached pathfinding for shooter targeting
    const targetPlayer = collisionManager.findClosestPlayerCached(
      zombieId, zombie.x, zombie.y, shooterType.shootRange,
      { ignoreSpawnProtection: true, ignoreInvisible: false }
    );

    if (targetPlayer) {
      shootAtPlayer(zombie, zombieId, targetPlayer, shooterType, now, entityManager);
    }
  }
}

/**
 * Shoot bullet at player
 */
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

/**
 * Process poison trail for poison zombie
 */
function processPoisonTrail(zombie, now, gameState, entityManager) {
  if (zombie.type !== 'poison') {
    return;
  }

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

    createParticles(zombie.x, zombie.y, poisonType.color, 3, entityManager);
  }
}

/**
 * Move zombie towards player or randomly
 * SSSS OPTIMIZATION: Uses cached pathfinding for performance
 * FIX: Added deltaTime for frame-rate independent movement
 */
function moveZombie(zombie, zombieId, collisionManager, gameState) {
  // SSSS OPTIMIZATION: Use cached pathfinding for movement (called every frame for all zombies)
  const closestPlayer = collisionManager.findClosestPlayerCached(
    zombieId, zombie.x, zombie.y, Infinity,
    { ignoreSpawnProtection: true, ignoreInvisible: false }
  );

  const now = Date.now();
  const roomManager = gameState.roomManager;

  // FIX: Calculate deltaTime for frame-rate independent movement
  // Target is 60 FPS (16.67ms per frame)
  const lastUpdate = zombie.lastMoveUpdate || now;
  const deltaTime = Math.min((now - lastUpdate) / 16.67, 3); // Cap at 3x to prevent teleporting on lag spikes
  zombie.lastMoveUpdate = now;

  // FIX: Apply zombie-zombie separation to prevent stacking
  applyZombieSeparation(zombie, zombieId, collisionManager);

  if (closestPlayer) {
    moveTowardsPlayer(zombie, zombieId, closestPlayer, roomManager, collisionManager, gameState, now, deltaTime);
  } else {
    moveRandomly(zombie, now, roomManager, deltaTime);
  }
}

/**
 * Apply separation force between zombies to prevent stacking
 * FIX: Prevents zombie-zombie overlap that causes blocking
 */
function applyZombieSeparation(zombie, zombieId, collisionManager) {
  const separationRadius = zombie.size * 2;
  const nearbyZombies = collisionManager.findZombiesInRadius(zombie.x, zombie.y, separationRadius, zombieId);

  if (nearbyZombies.length === 0) {
    return;
  }

  let separationX = 0;
  let separationY = 0;
  const separationForce = 0.5; // Strength of push-apart force

  for (const other of nearbyZombies) {
    if (!other || other.id === zombie.id) {
      continue;
    }

    const dx = zombie.x - other.x;
    const dy = zombie.y - other.y;
    const distSq = dx * dx + dy * dy;
    const minDist = (zombie.size + other.size) * 0.8; // 80% of combined sizes
    const minDistSq = minDist * minDist;

    if (distSq < minDistSq && distSq > 0.01) {
      const dist = Math.sqrt(distSq);
      const overlap = minDist - dist;
      // Push away from overlapping zombie
      separationX += (dx / dist) * overlap * separationForce;
      separationY += (dy / dist) * overlap * separationForce;
    }
  }

  // Apply separation (will be bounded by wall collision later)
  zombie.x += separationX;
  zombie.y += separationY;
}

/**
 * Move zombie towards closest player
 * FIX: Added deltaTime parameter for frame-rate independent movement
 */
function moveTowardsPlayer(zombie, zombieId, closestPlayer, roomManager, collisionManager, gameState, now, deltaTime) {
  const angle = Math.atan2(closestPlayer.y - zombie.y, closestPlayer.x - zombie.x);

  if (zombie.type === 'shielded') {
    zombie.facingAngle = angle;
  }

  const effectiveSpeed = calculateEffectiveSpeed(zombie, angle);
  const { newX, newY } = calculateNewPosition(zombie, angle, effectiveSpeed, deltaTime);
  const { finalX, finalY } = resolveWallCollisions(zombie, newX, newY, roomManager);

  zombie.x = finalX;
  zombie.y = finalY;

  checkPlayerCollisions(zombie, zombieId, collisionManager, gameState, now);
}

/**
 * Calculate zombie effective speed
 * FIX: Added speed capping to prevent teleportation on extreme multipliers
 */
function calculateEffectiveSpeed(zombie, angle) {
  let effectiveSpeed = zombie.speed;

  if (zombie.type === 'berserker' && zombie.rageSpeedMultiplier) {
    effectiveSpeed *= zombie.rageSpeedMultiplier;
  }

  if (zombie.type === 'berserker' && zombie.isDashing) {
    const berserkerType = ZOMBIE_TYPES.berserker;
    effectiveSpeed = berserkerType.dashSpeed;
  }

  if (zombie.type === 'brute' && zombie.isCharging) {
    const bruteType = ZOMBIE_TYPES.brute;
    effectiveSpeed = bruteType.chargeSpeed;
  }

  // FIX: Cap maximum speed to prevent teleportation
  // Max speed = 15 pixels per frame at 60fps (900 pixels/sec)
  const MAX_SPEED = 15;
  return Math.min(effectiveSpeed, MAX_SPEED);
}

/**
 * Calculate new zombie position
 * FIX: Added deltaTime for frame-rate independent movement
 */
function calculateNewPosition(zombie, angle, effectiveSpeed, deltaTime = 1) {
  if (zombie.isDashing) {
    angle = zombie.dashAngle;
  }
  if (zombie.isCharging) {
    angle = zombie.chargeAngle;
  }

  // FIX: Multiply by deltaTime for consistent movement regardless of frame rate
  const frameSpeed = effectiveSpeed * deltaTime;

  return {
    newX: zombie.x + MathUtils.fastCos(angle) * frameSpeed,
    newY: zombie.y + MathUtils.fastSin(angle) * frameSpeed
  };
}

/**
 * Resolve wall collisions with sliding
 * FIX: Added fallback boundary check when roomManager is null
 */
function resolveWallCollisions(zombie, newX, newY, roomManager) {
  let finalX = zombie.x;
  let finalY = zombie.y;

  // FIX: If roomManager is null, use basic boundary check to prevent out-of-bounds
  if (!roomManager) {
    const margin = zombie.size + CONFIG.WALL_THICKNESS;
    const maxX = CONFIG.ROOM_WIDTH - margin;
    const maxY = CONFIG.ROOM_HEIGHT - margin;

    finalX = Math.max(margin, Math.min(newX, maxX));
    finalY = Math.max(margin, Math.min(newY, maxY));
    return { finalX, finalY };
  }

  if (!roomManager.checkWallCollision(newX, newY, zombie.size)) {
    finalX = newX;
    finalY = newY;
  } else {
    // Wall sliding: try X only, then Y only
    if (!roomManager.checkWallCollision(newX, zombie.y, zombie.size)) {
      finalX = newX;
    }
    if (!roomManager.checkWallCollision(zombie.x, newY, zombie.size)) {
      finalY = newY;
    }
  }

  return { finalX, finalY };
}

/**
 * Check and handle player collisions
 */
function checkPlayerCollisions(zombie, zombieId, collisionManager, gameState, now) {
  const nearbyPlayers = collisionManager.findPlayersInRadius(
    zombie.x,
    zombie.y,
    zombie.size + CONFIG.PLAYER_SIZE
  );

  for (const player of nearbyPlayers) {
    if (player.spawnProtection || player.invisible) {
      continue;
    }

    if (distance(zombie.x, zombie.y, player.x, player.y) < zombie.size) {
      if (Math.random() < (player.dodgeChance || 0)) {
        continue;
      }

      applyPlayerDamage(zombie, zombieId, player, gameState, now);
    }
  }
}

/**
 * Apply damage to player from zombie collision
 */
function applyPlayerDamage(zombie, zombieId, player, gameState, now) {
  if (!player.lastDamageTime) {
    player.lastDamageTime = {};
  }
  const lastDamage = player.lastDamageTime[zombieId] || 0;
  const DAMAGE_INTERVAL = 100;

  if (now - lastDamage >= DAMAGE_INTERVAL) {
    let damageDealt = zombie.damage * (DAMAGE_INTERVAL / 1000);

    if (zombie.type === 'berserker' && zombie.rageDamageMultiplier) {
      damageDealt *= zombie.rageDamageMultiplier;
    }

    player.health -= damageDealt;
    player.lastDamageTime[zombieId] = now;

    if (player.thorns > 0) {
      const thornsDamage = damageDealt * player.thorns;
      zombie.health -= thornsDamage;
    }

    if (player.health <= 0) {
      const handlePlayerDeathProgression = require('../../gameLoop').handlePlayerDeathProgression;
      handlePlayerDeathProgression(player, player.id, gameState, now, false);
    }
  }
}

/**
 * Move zombie randomly when no player visible
 * FIX: Added deltaTime for frame-rate independent movement
 */
function moveRandomly(zombie, now, roomManager, deltaTime = 1) {
  if (!zombie.randomMoveTimer || now - zombie.randomMoveTimer > 2000) {
    zombie.randomAngle = Math.random() * Math.PI * 2;
    zombie.randomMoveTimer = now;
  }

  // FIX: Apply deltaTime for consistent random movement
  const frameSpeed = zombie.speed * deltaTime;
  const newX = zombie.x + Math.cos(zombie.randomAngle) * frameSpeed;
  const newY = zombie.y + Math.sin(zombie.randomAngle) * frameSpeed;

  // FIX: Use resolveWallCollisions for consistent boundary handling
  const { finalX, finalY } = resolveWallCollisions(zombie, newX, newY, roomManager);

  if (finalX !== zombie.x || finalY !== zombie.y) {
    zombie.x = finalX;
    zombie.y = finalY;
  } else {
    // Hit a wall, change direction
    zombie.randomAngle = Math.random() * Math.PI * 2;
  }
}

module.exports = {
  updateZombies,
  moveZombie
};
