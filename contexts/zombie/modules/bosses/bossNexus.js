/**
 * @fileoverview Boss Nexus abilities (wave 180)
 */

const { createParticles } = require('../../../../game/lootFunctions');
const { emitAOI, moveZombieSafely } = require('./shared');

const VOID_RIFT_COOLDOWN = 9000;
const TELEPORT_COOLDOWN = 6000;
const TELEPORT_DISTANCE = 250;
const SUMMON_COOLDOWN = 18000;
const SUMMON_COUNT = 8;
const SUMMON_RADIUS = 180;
const REALITY_WARP_COOLDOWN = 25000;
const REALITY_WARP_DURATION = 5000;

/** @type {string[]} */
const VOID_MINION_TYPES = ['voidwalker', 'shadowfiend'];

/**
 * Create a void rift hazard at the boss position.
 * @param {object} zombie
 * @param {number} now
 * @param {object} entityManager
 * @param {object} gameState
 */
function _createVoidRift(zombie, now, entityManager, gameState) {
  if (zombie.lastRift && now - zombie.lastRift < VOID_RIFT_COOLDOWN) {
return;
}
  zombie.lastRift = now;

  if (gameState.hazardManager) {
    gameState.hazardManager.createHazard('voidRift', zombie.x, zombie.y, 120, 45, 12000);
  }
  createParticles(zombie.x, zombie.y, '#9400d3', 50, entityManager);
}

/**
 * Teleport the boss to a position near the closest player.
 * @param {object} zombie
 * @param {number} now
 * @param {object} entityManager
 * @param {object} gameState
 * @param {object|null} collisionManager
 */
function _teleportNearPlayer(zombie, now, entityManager, gameState, collisionManager) {
  if (zombie.lastTeleport && now - zombie.lastTeleport < TELEPORT_COOLDOWN) {
return;
}
  zombie.lastTeleport = now;

  const closestPlayer = collisionManager?.findClosestPlayer(zombie.x, zombie.y, Infinity, {
    ignoreSpawnProtection: true,
    ignoreInvisible: false
  });
  if (!closestPlayer) {
return;
}

  const angle = Math.atan2(closestPlayer.y - zombie.y, closestPlayer.x - zombie.x);
  const newX = closestPlayer.x - Math.cos(angle) * TELEPORT_DISTANCE;
  const newY = closestPlayer.y - Math.sin(angle) * TELEPORT_DISTANCE;

  const oldX = zombie.x;
  const oldY = zombie.y;
  if (moveZombieSafely(zombie, newX, newY, gameState)) {
    createParticles(oldX, oldY, '#9400d3', 30, entityManager);
    createParticles(zombie.x, zombie.y, '#9400d3', 30, entityManager);
  }
}

/**
 * Summon void and shadow minions in phase 2+ (health <= 66%).
 * @param {object} zombie
 * @param {string} zombieId
 * @param {number} now
 * @param {number} healthPercent
 * @param {import('socket.io').Server} io
 * @param {object} zombieManager
 * @param {object} perfIntegration
 * @param {object} entityManager
 * @param {object} gameState
 */
function _summonVoidMinions(zombie, zombieId, now, healthPercent, io, zombieManager, perfIntegration, entityManager, gameState) {
  if (healthPercent > 0.66) {
return;
}
  if (zombie.lastSummon && now - zombie.lastSummon < SUMMON_COOLDOWN) {
return;
}
  zombie.lastSummon = now;

  for (let i = 0; i < SUMMON_COUNT; i++) {
    let zombieCount = 0;
    for (const _ in gameState.zombies) {
zombieCount++;
}
    if (!perfIntegration.canSpawnZombie(zombieCount)) {
continue;
}

    const angle = (Math.PI * 2 * i) / SUMMON_COUNT;
    zombieManager.spawnSpecificZombie(
      VOID_MINION_TYPES[i % 2],
      zombie.x + Math.cos(angle) * SUMMON_RADIUS,
      zombie.y + Math.sin(angle) * SUMMON_RADIUS
    );
  }

  createParticles(zombie.x, zombie.y, '#9400d3', 40, entityManager);
  emitAOI(io, 'bossVoidMinions', { bossId: zombieId }, zombie.x, zombie.y, gameState);
}

/**
 * Invert player controls for all alive players in phase 3+ (health <= 33%).
 * @param {object} zombie
 * @param {string} zombieId
 * @param {number} now
 * @param {number} healthPercent
 * @param {import('socket.io').Server} io
 * @param {object} entityManager
 * @param {object} gameState
 */
function _applyRealityWarp(zombie, zombieId, now, healthPercent, io, entityManager, gameState) {
  if (healthPercent > 0.33) {
return;
}
  if (zombie.lastRealityWarp && now - zombie.lastRealityWarp < REALITY_WARP_COOLDOWN) {
return;
}
  zombie.lastRealityWarp = now;

  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player.alive) {
continue;
}

    player.controlsInverted = true;
    player.controlsInvertedUntil = now + REALITY_WARP_DURATION;
    createParticles(player.x, player.y, '#9400d3', 15, entityManager);
  }

  emitAOI(io, 'bossRealityWarp', { bossId: zombieId, duration: REALITY_WARP_DURATION }, zombie.x, zombie.y, gameState);
}

/**
 * Update Boss Nexus abilities each game tick.
 * @param {object} zombie
 * @param {string} zombieId
 * @param {number} now  Current timestamp (ms).
 * @param {import('socket.io').Server} io
 * @param {object} zombieManager
 * @param {object} perfIntegration
 * @param {object} entityManager
 * @param {object} gameState
 * @param {object|null} collisionManager
 */
function updateBossNexus(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState, collisionManager) {
  if (zombie.type !== 'bossNexus') {
return;
}

  const healthPercent = zombie.health / zombie.maxHealth;

  _createVoidRift(zombie, now, entityManager, gameState);
  _teleportNearPlayer(zombie, now, entityManager, gameState, collisionManager);
  _summonVoidMinions(zombie, zombieId, now, healthPercent, io, zombieManager, perfIntegration, entityManager, gameState);
  _applyRealityWarp(zombie, zombieId, now, healthPercent, io, entityManager, gameState);
}

module.exports = { updateBossNexus };
