/**
 * @fileoverview Special zombie type updaters
 * @description Handles updates for special zombie types (teleporter, summoner, berserker, necromancer, brute, mimic)
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const { distance } = require('../../utilityFunctions');
const { createParticles } = require('../../lootFunctions');

const { ZOMBIE_TYPES } = ConfigManager;

/**
 * Update teleporter zombie
 */
function updateTeleporterZombie(zombie, zombieId, now, collisionManager, entityManager, gameState) {
  if (zombie.type !== 'teleporter') {
    return;
  }

  const teleporterType = ZOMBIE_TYPES.teleporter;
  if (!zombie.lastTeleport || now - zombie.lastTeleport >= teleporterType.teleportCooldown) {
    const closestPlayer = collisionManager.findClosestPlayer(
      zombie.x, zombie.y, Infinity,
      { ignoreSpawnProtection: true, ignoreInvisible: false }
    );

    if (closestPlayer) {
      const distToPlayer = distance(zombie.x, zombie.y, closestPlayer.x, closestPlayer.y);

      if (distToPlayer > teleporterType.teleportRange) {
        executeTeleport(zombie, closestPlayer, teleporterType, now, gameState, entityManager);
      }
    }
  }
}

/**
 * Execute teleport logic
 */
function executeTeleport(zombie, closestPlayer, teleporterType, now, gameState, entityManager) {
  zombie.lastTeleport = now;

  const angleToPlayer = Math.atan2(closestPlayer.y - zombie.y, closestPlayer.x - zombie.x);
  const teleportDistance = teleporterType.teleportMinRange +
    Math.random() * (teleporterType.teleportRange - teleporterType.teleportMinRange);

  const newX = closestPlayer.x - Math.cos(angleToPlayer) * teleportDistance;
  const newY = closestPlayer.y - Math.sin(angleToPlayer) * teleportDistance;

  const roomManager = gameState.roomManager;
  if (roomManager && !roomManager.checkWallCollision(newX, newY, zombie.size)) {
    createParticles(zombie.x, zombie.y, teleporterType.color, 15, entityManager);
    zombie.x = newX;
    zombie.y = newY;
    createParticles(zombie.x, zombie.y, teleporterType.color, 15, entityManager);
  }
}

/**
 * Update summoner zombie
 */
function updateSummonerZombie(zombie, zombieId, now, zombieManager, entityManager, gameState) {
  if (zombie.type !== 'summoner') {
    return;
  }

  const summonerType = ZOMBIE_TYPES.summoner;
  const currentMinions = countMinions(zombie, zombieId, gameState);
  zombie.minionCount = currentMinions;

  if (shouldSpawnMinions(zombie, currentMinions, summonerType, now)) {
    spawnMinions(zombie, zombieId, currentMinions, summonerType, zombieManager, entityManager, now);
  }
}

/**
 * Count current minions for summoner
 */
function countMinions(zombie, zombieId, gameState) {
  let count = 0;
  for (const zId in gameState.zombies) {
    if (gameState.zombies[zId].summonerId === zombieId) {
      count++;
    }
  }
  return count;
}

/**
 * Check if summoner should spawn minions
 */
function shouldSpawnMinions(zombie, currentMinions, summonerType, now) {
  return currentMinions < summonerType.maxMinions &&
    (!zombie.lastSummon || now - zombie.lastSummon >= summonerType.summonCooldown);
}

/**
 * Spawn minions for summoner
 */
function spawnMinions(zombie, zombieId, currentMinions, summonerType, zombieManager, entityManager, now) {
  zombie.lastSummon = now;

  const minionsToSpawn = Math.min(
    summonerType.minionsPerSummon,
    summonerType.maxMinions - currentMinions
  );

  for (let i = 0; i < minionsToSpawn; i++) {
    const spawned = zombieManager.spawnMinion(zombieId, zombie.x, zombie.y);
    if (spawned) {
      zombie.minionCount++;
    }
  }

  if (minionsToSpawn > 0) {
    createParticles(zombie.x, zombie.y, summonerType.color, 20, entityManager);
  }
}

/**
 * Update berserker zombie
 */
function updateBerserkerZombie(zombie, zombieId, now, collisionManager, entityManager, _gameState) {
  if (zombie.type !== 'berserker') {
    return;
  }

  const berserkerType = ZOMBIE_TYPES.berserker;
  updateRageState(zombie, berserkerType, entityManager);
  updateDashAbility(zombie, now, berserkerType, collisionManager, entityManager);
}

/**
 * Update berserker rage state
 */
function updateRageState(zombie, berserkerType, entityManager) {
  const healthPercent = zombie.health / zombie.maxHealth;
  const wasRaged = zombie.isRaged;
  const wasExtremeRaged = zombie.isExtremeRaged;

  if (healthPercent <= berserkerType.extremeRageThreshold) {
    zombie.isExtremeRaged = true;
    zombie.isRaged = true;
  } else if (healthPercent <= berserkerType.rageThreshold) {
    zombie.isExtremeRaged = false;
    zombie.isRaged = true;
  } else {
    zombie.isExtremeRaged = false;
    zombie.isRaged = false;
  }

  if (!wasRaged && zombie.isRaged) {
    createParticles(zombie.x, zombie.y, '#ff0000', 20, entityManager);
    zombie.color = berserkerType.rageColor;
  } else if (!wasExtremeRaged && zombie.isExtremeRaged) {
    createParticles(zombie.x, zombie.y, '#ff0000', 30, entityManager);
  }

  zombie.color = zombie.isRaged ? berserkerType.rageColor : berserkerType.color;

  if (zombie.isExtremeRaged) {
    zombie.rageSpeedMultiplier = berserkerType.extremeRageSpeedMultiplier;
    zombie.rageDamageMultiplier = berserkerType.extremeRageDamageMultiplier;
  } else if (zombie.isRaged) {
    zombie.rageSpeedMultiplier = berserkerType.rageSpeedMultiplier;
    zombie.rageDamageMultiplier = berserkerType.rageDamageMultiplier;
  } else {
    zombie.rageSpeedMultiplier = 1.0;
    zombie.rageDamageMultiplier = 1.0;
  }
}

/**
 * Update berserker dash ability
 */
function updateDashAbility(zombie, now, berserkerType, collisionManager, entityManager) {
  if (!zombie.isExtremeRaged) {
    zombie.isDashing = false;
    return;
  }

  if (zombie.isDashing && now < zombie.dashEndTime) {
    return;
  }

  if (zombie.isDashing && now >= zombie.dashEndTime) {
    zombie.isDashing = false;
  }

  if (!zombie.isDashing && (!zombie.lastDash || now - zombie.lastDash >= berserkerType.dashCooldown)) {
    const closestPlayer = collisionManager.findClosestPlayer(
      zombie.x, zombie.y, 400,
      { ignoreSpawnProtection: false, ignoreInvisible: false }
    );

    if (closestPlayer) {
      startDash(zombie, closestPlayer, now, berserkerType, entityManager);
    }
  }
}

/**
 * Start berserker dash
 */
function startDash(zombie, closestPlayer, now, berserkerType, entityManager) {
  zombie.lastDash = now;
  zombie.isDashing = true;
  zombie.dashEndTime = now + berserkerType.dashDuration;
  zombie.dashAngle = Math.atan2(closestPlayer.y - zombie.y, closestPlayer.x - zombie.x);
  createParticles(zombie.x, zombie.y, '#ff4400', 15, entityManager);
}

/**
 * Update necromancer zombie
 */
function updateNecromancerZombie(zombie, zombieId, now, entityManager, gameState) {
  if (zombie.type !== 'necromancer') {
    return;
  }

  const necroType = ZOMBIE_TYPES.necromancer;

  if (!zombie.lastRevive || now - zombie.lastRevive >= necroType.reviveCooldown) {
    const revivedCount = reviveNearbyZombies(zombie, necroType, gameState, entityManager);

    if (revivedCount > 0) {
      zombie.lastRevive = now;
      createParticles(zombie.x, zombie.y, necroType.color, 25, entityManager);
    }
  }
}

/**
 * Revive nearby dead zombies
 */
function reviveNearbyZombies(zombie, necroType, gameState, entityManager) {
  let revivedCount = 0;
  const deadZombiesNearby = [];

  for (const corpseId in gameState.deadZombies) {
    const corpse = gameState.deadZombies[corpseId];
    const dist = distance(zombie.x, zombie.y, corpse.x, corpse.y);

    if (dist <= necroType.reviveRadius) {
      deadZombiesNearby.push(corpseId);
    }
  }

  for (let i = 0; i < Math.min(deadZombiesNearby.length, necroType.maxRevives); i++) {
    const corpseId = deadZombiesNearby[i];
    const corpse = gameState.deadZombies[corpseId];

    const revivedId = gameState.nextZombieId++;
    gameState.zombies[revivedId] = {
      id: revivedId,
      x: corpse.x,
      y: corpse.y,
      size: corpse.size * 0.8,
      color: '#44ff44',
      type: 'revivedMinion',
      health: corpse.maxHealth * necroType.reviveHealthPercent,
      maxHealth: corpse.maxHealth * necroType.reviveHealthPercent,
      speed: corpse.speed * 0.9,
      damage: corpse.damage * 0.7,
      goldDrop: Math.floor(corpse.goldDrop * 0.5),
      xpDrop: Math.floor(corpse.xpDrop * 0.5)
    };

    delete gameState.deadZombies[corpseId];
    createParticles(corpse.x, corpse.y, '#00ff00', 15, entityManager);
    revivedCount++;
  }

  return revivedCount;
}

/**
 * Update brute zombie
 */
function updateBruteZombie(zombie, zombieId, now, collisionManager, entityManager, gameState) {
  if (zombie.type !== 'brute') {
    return;
  }

  const bruteType = ZOMBIE_TYPES.brute;

  if (!zombie.lastGroundSlam || now - zombie.lastGroundSlam >= bruteType.slamCooldown) {
    const closestPlayer = collisionManager.findClosestPlayer(
      zombie.x, zombie.y, bruteType.slamRange,
      { ignoreSpawnProtection: false, ignoreInvisible: false }
    );

    if (closestPlayer) {
      executeGroundSlam(zombie, zombieId, now, bruteType, gameState, entityManager);
    }
  }
}

/**
 * Execute brute ground slam
 */
function executeGroundSlam(zombie, zombieId, now, bruteType, gameState, entityManager) {
  zombie.lastGroundSlam = now;
  createParticles(zombie.x, zombie.y, bruteType.color, 30, entityManager);

  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player.alive || player.spawnProtection || player.invisible) {
      continue;
    }

    const dist = distance(zombie.x, zombie.y, player.x, player.y);
    if (dist <= bruteType.slamRange) {
      player.health -= bruteType.slamDamage;
      player.stunnedUntil = now + bruteType.slamStunDuration;
      createParticles(player.x, player.y, '#ffaa00', 10, entityManager);
    }
  }
}

/**
 * Update mimic zombie
 */
function updateMimicZombie(zombie, zombieId, now, collisionManager, entityManager, gameState) {
  if (zombie.type !== 'mimic') {
    return;
  }

  const mimicType = ZOMBIE_TYPES.mimic;

  if (!zombie.lastTransform || now - zombie.lastTransform >= mimicType.transformCooldown) {
    transformMimic(zombie, now, mimicType, gameState, entityManager);
  }
}

/**
 * Transform mimic to random zombie type
 */
function transformMimic(zombie, now, mimicType, gameState, entityManager) {
  zombie.lastTransform = now;

  const availableTypes = ['tank', 'fast', 'healer', 'shooter', 'slower'];
  const randomType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
  const targetType = ZOMBIE_TYPES[randomType];

  zombie.mimickedType = randomType;
  zombie.color = targetType.color;
  zombie.speed = targetType.speed;
  zombie.size = targetType.size;

  createParticles(zombie.x, zombie.y, targetType.color, 20, entityManager);
}

module.exports = {
  updateTeleporterZombie,
  updateSummonerZombie,
  updateBerserkerZombie,
  updateNecromancerZombie,
  updateBruteZombie,
  updateMimicZombie
};
