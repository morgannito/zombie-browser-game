/**
 * @fileoverview Simple boss updaters
 * @description Handles Boss Charnier, Infect, Colosse, Roi and Omega.
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const { distance } = require('../../../game/utilityFunctions');
const { createParticles } = require('../../../game/lootFunctions');
const { handlePlayerDeathProgression } = require('../../player/modules/DeathProgressionHandler');
const { clampToRoomBounds, moveZombieSafely, canPlaceZombieAt } = require('./bosses/shared');
const {
  AURA_EFFECT_INTERVAL,
  MULTIPLIER_70_PCT,
  CLONE_DAMAGE_MULTIPLIER,
  CLONE_SPEED_MULTIPLIER,
  BOSS_TELEPORT_DISTANCE_MIN,
  PARTICLES_DEFAULT_COUNT
} = require('../constants');

const { ZOMBIE_TYPES } = ConfigManager;

// ─── Boss Charnier ────────────────────────────────────────────────────────────

/**
 * Update Boss Charnier — periodically spawns regular zombies.
 * @param {Object} zombie @param {number} now @param {Object} zombieManager
 * @param {Object} perfIntegration @param {Object} entityManager @param {Object} gameState
 */
function updateBossCharnier(zombie, now, zombieManager, perfIntegration, entityManager, gameState) {
  if (zombie.type !== 'bossCharnier') {
    return;
  }

  const bossType = ZOMBIE_TYPES.bossCharnier;
  if (!zombie.lastSpawn || now - zombie.lastSpawn >= bossType.spawnCooldown) {
    zombie.lastSpawn = now;
    for (let i = 0; i < bossType.spawnCount; i++) {
      let n = 0;
      for (const _ in gameState.zombies) {
        n++;
      }
      if (perfIntegration.canSpawnZombie(n) && zombieManager.spawnSingleZombie()) {
        createParticles(zombie.x, zombie.y, bossType.color, PARTICLES_DEFAULT_COUNT, entityManager);
      }
    }
  }
}

// ─── Boss Infect ──────────────────────────────────────────────────────────────

/** Drop a toxic pool at current position. */
function _infectToxicPool(zombie, now, bossType, entityManager, gameState) {
  zombie.lastToxicPool = now;
  gameState.toxicPools = gameState.toxicPools || [];
  gameState.toxicPools.push({
    id: `toxic_${now}_${Math.random()}`,
    x: zombie.x,
    y: zombie.y,
    radius: bossType.toxicPoolRadius,
    damage: bossType.toxicPoolDamage,
    createdAt: now,
    duration: bossType.toxicPoolDuration
  });
  createParticles(zombie.x, zombie.y, bossType.color, 25, entityManager);
}

/** Apply death-aura damage to nearby players. */
function _infectDeathAura(zombie, now, bossType, entityManager, gameState) {
  zombie.lastAuraDamage = now;
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player.alive || player.spawnProtection || player.invisible) {
      continue;
    }
    if (distance(zombie.x, zombie.y, player.x, player.y) < bossType.deathAuraRadius) {
      player.lastKillerType = zombie.type;
      player.health -= bossType.deathAuraDamage;
      createParticles(player.x, player.y, '#00ff00', 5, entityManager);
      if (player.health <= 0) {
        handlePlayerDeathProgression(player, playerId, gameState, now, true);
      }
    }
  }
  createParticles(zombie.x, zombie.y, '#00ff00', 12, entityManager);
}

/**
 * Update Boss Infect — toxic pools + death aura.
 * @param {Object} zombie @param {number} now @param {Object} entityManager @param {Object} gameState
 */
function updateBossInfect(zombie, now, entityManager, gameState) {
  if (zombie.type !== 'bossInfect') {
    return;
  }

  const bossType = ZOMBIE_TYPES.bossInfect;
  if (!zombie.lastToxicPool || now - zombie.lastToxicPool >= bossType.toxicPoolCooldown) {
    _infectToxicPool(zombie, now, bossType, entityManager, gameState);
  }
  if (!zombie.lastAuraDamage || now - zombie.lastAuraDamage >= AURA_EFFECT_INTERVAL) {
    _infectDeathAura(zombie, now, bossType, entityManager, gameState);
  }
}

// ─── Boss Colosse ─────────────────────────────────────────────────────────────

/**
 * Update Boss Colosse — shield before enrage, speed+damage boost on enrage.
 * @param {Object} zombie @param {string} zombieId @param {number} now
 * @param {Object} io @param {Object} entityManager
 */
function updateBossColosse(zombie, zombieId, now, io, entityManager) {
  if (zombie.type !== 'bossColosse') {
    return;
  }

  const bossType = ZOMBIE_TYPES.bossColosse;
  const healthPercent = zombie.health / zombie.maxHealth;

  if (!zombie.isEnraged) {
    zombie.hasShield = true;
    if (!zombie.lastShieldEffect || now - zombie.lastShieldEffect >= AURA_EFFECT_INTERVAL) {
      zombie.lastShieldEffect = now;
      createParticles(zombie.x, zombie.y, bossType.shieldColor, 8, entityManager);
    }
  } else {
    zombie.hasShield = false;
  }

  if (!zombie.isEnraged && healthPercent <= bossType.enrageThreshold) {
    zombie.isEnraged = true;
    zombie.hasShield = false;
    zombie.speed *= bossType.enrageSpeedMultiplier;
    zombie.damage = Math.floor(zombie.damage * bossType.enrageDamageMultiplier);
    createParticles(zombie.x, zombie.y, '#ff0000', 50, entityManager);
    io.emit('bossEnraged', { bossId: zombieId, message: 'LE COLOSSE EST ENRAGÉ!' });
  }
}

// ─── Boss Roi ─────────────────────────────────────────────────────────────────

/** @returns {number} current phase (1-3) */
function _roiDetectPhase(bossType, healthPercent) {
  if (healthPercent <= bossType.phase3Threshold) {
    return 3;
  }
  if (healthPercent <= bossType.phase2Threshold) {
    return 2;
  }
  return 1;
}

/** Teleport bossRoi near closest player (Phase 2+). */
function _roiTeleport(zombie, now, bossType, collisionManager, entityManager, gameState) {
  zombie.lastTeleport = now;
  const p = collisionManager.findClosestPlayer(zombie.x, zombie.y, Infinity, {
    ignoreSpawnProtection: true,
    ignoreInvisible: false
  });
  if (!p) {
    return;
  }
  const a = Math.atan2(p.y - zombie.y, p.x - zombie.x);
  const d = 200 + Math.random() * 200;
  const oldX = zombie.x,
    oldY = zombie.y;
  if (moveZombieSafely(zombie, p.x - Math.cos(a) * d, p.y - Math.sin(a) * d, gameState)) {
    createParticles(oldX, oldY, bossType.color, 30, entityManager);
    createParticles(zombie.x, zombie.y, bossType.color, 30, entityManager);
  }
}

/** Summon 5 regular zombies (Phase 3, non-clone only). */
function _roiSummon(
  zombie,
  now,
  bossType,
  zombieManager,
  perfIntegration,
  entityManager,
  gameState
) {
  zombie.lastSummon = now;
  for (let i = 0; i < 5; i++) {
    let n = 0;
    for (const _ in gameState.zombies) {
      n++;
    }
    if (perfIntegration.canSpawnZombie(n)) {
      zombieManager.spawnSingleZombie();
    }
  }
  createParticles(zombie.x, zombie.y, bossType.color, 40, entityManager);
}

/** Spawn clones around bossRoi (Phase 3, non-clone only). */
function _roiSpawnClones(zombie, zombieId, now, bossType, io, entityManager, gameState) {
  zombie.lastClone = now;
  for (let i = 0; i < bossType.cloneCount; i++) {
    const angle = (Math.PI * 2 * i) / bossType.cloneCount;
    const cloneSize = bossType.size * MULTIPLIER_70_PCT; // 70% of boss size
    const pos = clampToRoomBounds(
      { size: cloneSize },
      zombie.x + Math.cos(angle) * BOSS_TELEPORT_DISTANCE_MIN,
      zombie.y + Math.sin(angle) * BOSS_TELEPORT_DISTANCE_MIN
    );
    if (!canPlaceZombieAt({ size: cloneSize }, pos.x, pos.y, gameState)) {
      continue;
    }
    const cloneId = gameState.nextZombieId++;
    gameState.zombies[cloneId] = {
      id: cloneId,
      x: pos.x,
      y: pos.y,
      size: cloneSize,
      color: '#ff69b4',
      type: 'bossRoi',
      health: bossType.cloneHealth,
      maxHealth: bossType.cloneHealth,
      speed: bossType.speed * CLONE_SPEED_MULTIPLIER,
      damage: bossType.damage * CLONE_DAMAGE_MULTIPLIER,
      goldDrop: 100,
      xpDrop: 50,
      isBoss: false,
      isClone: true,
      phase: 1,
      createdAt: now,
      despawnTime: now + bossType.cloneDuration
    };
    createParticles(pos.x, pos.y, '#ff69b4', 30, entityManager);
  }
  createParticles(zombie.x, zombie.y, bossType.color, 50, entityManager);
  io.emit('bossClones', { bossId: zombieId, message: 'LE ROI INVOQUE SES CLONES!' });
}

/**
 * Update Boss Roi — 3 phases: teleport (P2), summon + clones (P3).
 * @param {Object} zombie @param {string} zombieId @param {number} now
 * @param {Object} io @param {Object} zombieManager @param {Object} perfIntegration
 * @param {Object} entityManager @param {Object} gameState @param {Object} collisionManager
 */
function updateBossRoi(
  zombie,
  zombieId,
  now,
  io,
  zombieManager,
  perfIntegration,
  entityManager,
  gameState,
  collisionManager
) {
  if (zombie.type !== 'bossRoi') {
    return;
  }

  const bossType = ZOMBIE_TYPES.bossRoi;
  const healthPercent = zombie.health / zombie.maxHealth;
  const currentPhase = _roiDetectPhase(bossType, healthPercent);

  if (currentPhase > zombie.phase) {
    zombie.phase = currentPhase;
    io.emit('bossPhaseChange', {
      bossId: zombieId,
      phase: currentPhase,
      message: `ROI ZOMBIE - PHASE ${currentPhase}!`
    });
    createParticles(zombie.x, zombie.y, bossType.color, 60, entityManager);
  }

  if (
    zombie.phase >= 2 &&
    (!zombie.lastTeleport || now - zombie.lastTeleport >= bossType.teleportCooldown)
  ) {
    _roiTeleport(zombie, now, bossType, collisionManager, entityManager, gameState);
  }

  if (
    !zombie.isClone &&
    zombie.phase >= 3 &&
    (!zombie.lastSummon || now - zombie.lastSummon >= bossType.summonCooldown)
  ) {
    _roiSummon(zombie, now, bossType, zombieManager, perfIntegration, entityManager, gameState);
  }

  if (
    !zombie.isClone &&
    zombie.phase >= 3 &&
    (!zombie.lastClone || now - zombie.lastClone >= bossType.cloneCooldown)
  ) {
    _roiSpawnClones(zombie, zombieId, now, bossType, io, entityManager, gameState);
  }

  // Despawn expired clones
  if (zombie.isClone && now >= zombie.despawnTime) {
    createParticles(zombie.x, zombie.y, '#ff69b4', 20, entityManager);
    delete gameState.zombies[zombieId];
    gameState.collisionManager?.invalidatePathfindingCache(zombieId);
  }
}

// ─── Boss Omega ───────────────────────────────────────────────────────────────

/** Drop a toxic pool at current position using boss config values.
 * @param {Object} zombie @param {number} now @param {Object} bossType
 * @param {Object} entityManager @param {Object} gameState
 */
function _omegaToxicPool(zombie, now, bossType, entityManager, gameState) {
  zombie.lastToxicPool = now;
  gameState.toxicPools = gameState.toxicPools || [];
  gameState.toxicPools.push({
    id: `toxic_${now}_${Math.random()}`,
    x: zombie.x,
    y: zombie.y,
    radius: bossType.toxicPoolRadius || 70,
    damage: bossType.toxicPoolDamage || 20,
    createdAt: now,
    duration: bossType.toxicPoolDuration || 10000
  });
  createParticles(zombie.x, zombie.y, '#00ff00', 30, entityManager);
}

/** Summon zombies (Phase 3). */
function _omegaSummon(
  zombie,
  now,
  bossType,
  zombieManager,
  perfIntegration,
  entityManager,
  gameState
) {
  zombie.lastSummon = now;
  for (let i = 0; i < 8; i++) {
    let n = 0;
    for (const _ in gameState.zombies) {
      n++;
    }
    if (perfIntegration.canSpawnZombie(n)) {
      zombieManager.spawnSingleZombie();
    }
  }
  createParticles(zombie.x, zombie.y, bossType.color, 50, entityManager);
}

/** @returns {number} current phase (1-4) */
function _omegaDetectPhase(bossType, healthPercent) {
  if (healthPercent <= bossType.phase4Threshold) {
    return 4;
  }
  if (healthPercent <= bossType.phase3Threshold) {
    return 3;
  }
  if (healthPercent <= bossType.phase2Threshold) {
    return 2;
  }
  return 1;
}

/** Teleport bossOmega near closest player (all phases). */
function _omegaTeleport(zombie, now, bossType, collisionManager, entityManager, gameState) {
  zombie.lastTeleport = now;
  const p = collisionManager.findClosestPlayer(zombie.x, zombie.y, Infinity, {
    ignoreSpawnProtection: true,
    ignoreInvisible: false
  });
  if (!p) {
    return;
  }
  const a = Math.atan2(p.y - zombie.y, p.x - zombie.x);
  const d = 150 + Math.random() * 200;
  const oldX = zombie.x,
    oldY = zombie.y;
  if (moveZombieSafely(zombie, p.x - Math.cos(a) * d, p.y - Math.sin(a) * d, gameState)) {
    createParticles(oldX, oldY, bossType.color, 40, entityManager);
    createParticles(zombie.x, zombie.y, bossType.color, 40, entityManager);
  }
}

/** Fire laser at closest player and apply damage (Phase 4). */
function _omegaLaser(
  zombie,
  zombieId,
  now,
  bossType,
  io,
  collisionManager,
  entityManager,
  gameState
) {
  zombie.lastLaser = now;
  const p = collisionManager.findClosestPlayer(zombie.x, zombie.y, bossType.laserRange, {
    ignoreSpawnProtection: true,
    ignoreInvisible: false
  });
  if (!p) {
    return;
  }

  const angle = Math.atan2(p.y - zombie.y, p.x - zombie.x);
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    createParticles(
      zombie.x + Math.cos(angle) * ((i * bossType.laserRange) / steps),
      zombie.y + Math.sin(angle) * ((i * bossType.laserRange) / steps),
      bossType.laserColor,
      2,
      entityManager
    );
  }

  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player.alive || player.spawnProtection || player.invisible) {
      continue;
    }
    const playerAngle = Math.atan2(player.y - zombie.y, player.x - zombie.x);
    const angleDiff = Math.abs(playerAngle - angle);
    const dist = distance(zombie.x, zombie.y, player.x, player.y);
    if (angleDiff < bossType.laserWidth / 2 / dist && dist < bossType.laserRange) {
      player.lastKillerType = zombie.type;
      player.health -= bossType.laserDamage;
      createParticles(player.x, player.y, '#ff0000', PARTICLES_DEFAULT_COUNT, entityManager);
      if (player.health <= 0) {
        handlePlayerDeathProgression(player, playerId, gameState, now, true);
      }
    }
  }

  createParticles(zombie.x, zombie.y, bossType.laserColor, 30, entityManager);
  io.emit('bossLaser', {
    bossId: zombieId,
    x: zombie.x,
    y: zombie.y,
    angle,
    range: bossType.laserRange,
    color: bossType.laserColor
  });
}

/**
 * Update Boss Omega — 4 phases: teleport (all), toxic pools (P2), summon (P3), laser (P4).
 * @param {Object} zombie @param {string} zombieId @param {number} now
 * @param {Object} io @param {Object} zombieManager @param {Object} perfIntegration
 * @param {Object} entityManager @param {Object} gameState @param {Object} collisionManager
 */
function updateBossOmega(
  zombie,
  zombieId,
  now,
  io,
  zombieManager,
  perfIntegration,
  entityManager,
  gameState,
  collisionManager
) {
  if (zombie.type !== 'bossOmega') {
    return;
  }

  const bossType = ZOMBIE_TYPES.bossOmega;
  const healthPercent = zombie.health / zombie.maxHealth;
  const currentPhase = _omegaDetectPhase(bossType, healthPercent);

  if (currentPhase > zombie.phase) {
    zombie.phase = currentPhase;
    io.emit('bossPhaseChange', {
      bossId: zombieId,
      phase: currentPhase,
      message: `OMEGA - PHASE ${currentPhase}!`
    });
    createParticles(zombie.x, zombie.y, bossType.color, 80, entityManager);
  }

  if (!zombie.lastTeleport || now - zombie.lastTeleport >= bossType.teleportCooldown) {
    _omegaTeleport(zombie, now, bossType, collisionManager, entityManager, gameState);
  }

  if (
    zombie.phase >= 2 &&
    (!zombie.lastToxicPool || now - zombie.lastToxicPool >= bossType.toxicPoolCooldown)
  ) {
    _omegaToxicPool(zombie, now, bossType, entityManager, gameState);
  }

  if (
    zombie.phase >= 3 &&
    (!zombie.lastSummon || now - zombie.lastSummon >= bossType.summonCooldown)
  ) {
    _omegaSummon(zombie, now, bossType, zombieManager, perfIntegration, entityManager, gameState);
  }

  if (
    zombie.phase >= 4 &&
    (!zombie.lastLaser || now - zombie.lastLaser >= bossType.laserCooldown)
  ) {
    _omegaLaser(zombie, zombieId, now, bossType, io, collisionManager, entityManager, gameState);
  }
}

module.exports = {
  updateBossCharnier,
  updateBossInfect,
  updateBossColosse,
  updateBossRoi,
  updateBossOmega
};
