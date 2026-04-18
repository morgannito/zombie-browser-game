/**
 * @fileoverview Boss Apocalypse abilities (wave 200 - Final Boss)
 */

const { createParticles } = require('../../../../game/lootFunctions');
const { distance } = require('../../../../game/utilityFunctions');
const { emitAOI, applyDamage, killPlayer } = require('./shared');

const METEOR_SHOWER_COOLDOWN = 6000;
const METEOR_SHOWER_COUNT = 5;
const METEOR_SHOWER_RADIUS = 500;
const ICE_PRISON_COOLDOWN = 15000;
const ICE_PRISON_DURATION = 3000;
const CHAIN_LIGHTNING_COOLDOWN = 8000;
const CHAIN_LIGHTNING_RANGE = 600;
const CHAIN_LIGHTNING_DAMAGE = 50;
const CHAIN_LIGHTNING_FALLOFF = 0.7;
const CHAIN_LIGHTNING_MAX_JUMPS = 8;
const CHAIN_LIGHTNING_JUMP_RADIUS = 200;
const APOCALYPSE_COOLDOWN = 30000;
const APOCALYPSE_RADIUS = 400;
const APOCALYPSE_DAMAGE = 200;

/**
 * Spawn a shower of meteor hazards in random directions from the boss.
 * @param {object} zombie
 * @param {number} now
 * @param {object} entityManager
 * @param {object} gameState
 */
function _spawnMeteorShower(zombie, now, entityManager, gameState) {
  if (zombie.lastMeteorShower && now - zombie.lastMeteorShower < METEOR_SHOWER_COOLDOWN) {
return;
}
  zombie.lastMeteorShower = now;

  for (let i = 0; i < METEOR_SHOWER_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * METEOR_SHOWER_RADIUS;
    const meteorX = zombie.x + Math.cos(angle) * dist;
    const meteorY = zombie.y + Math.sin(angle) * dist;

    if (gameState.hazardManager) {
      gameState.hazardManager.createHazard('meteor', meteorX, meteorY, 100, 80, 2000);
    }
    createParticles(meteorX, meteorY, '#ff0000', 30, entityManager);
  }
}

/**
 * Freeze all alive players in phase 2+ (health <= 75%).
 * @param {object} zombie
 * @param {string} zombieId
 * @param {number} now
 * @param {number} healthPercent
 * @param {import('socket.io').Server} io
 * @param {object} entityManager
 * @param {object} gameState
 */
function _applyIcePrison(zombie, zombieId, now, healthPercent, io, entityManager, gameState) {
  if (healthPercent > 0.75) {
return;
}
  if (zombie.lastIcePrison && now - zombie.lastIcePrison < ICE_PRISON_COOLDOWN) {
return;
}
  zombie.lastIcePrison = now;

  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player.alive) {
continue;
}

    player.frozen = true;
    player.frozenUntil = now + ICE_PRISON_DURATION;
    createParticles(player.x, player.y, '#00ffff', 20, entityManager);
  }

  emitAOI(io, 'bossIcePrison', { bossId: zombieId }, zombie.x, zombie.y, gameState);
}

/**
 * Chain lightning that jumps between nearby players with damage falloff.
 * @param {object} zombie
 * @param {number} now
 * @param {number} healthPercent
 * @param {object} entityManager
 * @param {object} gameState
 * @param {object|null} collisionManager
 */
function _fireChainLightning(zombie, now, healthPercent, entityManager, gameState, collisionManager) {
  if (healthPercent > 0.5) {
return;
}
  if (zombie.lastChainLightning && now - zombie.lastChainLightning < CHAIN_LIGHTNING_COOLDOWN) {
return;
}
  zombie.lastChainLightning = now;

  const firstTarget = collisionManager?.findClosestPlayer(zombie.x, zombie.y, CHAIN_LIGHTNING_RANGE, {
    ignoreSpawnProtection: true,
    ignoreInvisible: false
  });
  if (!firstTarget) {
return;
}

  let currentTarget = firstTarget;
  let jumps = 0;
  const hitTargets = new Set([firstTarget]);

  while (jumps < CHAIN_LIGHTNING_MAX_JUMPS) {
    applyDamage(currentTarget, CHAIN_LIGHTNING_DAMAGE * Math.pow(CHAIN_LIGHTNING_FALLOFF, jumps));
    createParticles(currentTarget.x, currentTarget.y, '#ffff00', 15, entityManager);

    const nextTarget = _findNearestUnhitPlayer(currentTarget, hitTargets, gameState);
    if (!nextTarget) {
break;
}

    hitTargets.add(nextTarget);
    currentTarget = nextTarget;
    jumps++;
  }
}

/**
 * Find the nearest alive player not already hit by chain lightning.
 * @param {object} current
 * @param {Set<object>} hitTargets
 * @param {object} gameState
 * @returns {object|null}
 */
function _findNearestUnhitPlayer(current, hitTargets, gameState) {
  let nextTarget = null;
  let minDist = Infinity;

  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player.alive || hitTargets.has(player)) {
continue;
}

    const dist = distance(current.x, current.y, player.x, player.y);
    if (dist < CHAIN_LIGHTNING_JUMP_RADIUS && dist < minDist) {
      minDist = dist;
      nextTarget = player;
    }
  }
  return nextTarget;
}

/**
 * Trigger the Apocalypse ultimate AoE in phase 4 (health <= 25%).
 * @param {object} zombie
 * @param {string} zombieId
 * @param {number} now
 * @param {number} healthPercent
 * @param {import('socket.io').Server} io
 * @param {object} entityManager
 * @param {object} gameState
 */
function _triggerApocalypseUltimate(zombie, zombieId, now, healthPercent, io, entityManager, gameState) {
  if (healthPercent > 0.25) {
return;
}
  if (zombie.lastApocalypse && now - zombie.lastApocalypse < APOCALYPSE_COOLDOWN) {
return;
}
  zombie.lastApocalypse = now;

  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player.alive) {
continue;
}

    if (distance(zombie.x, zombie.y, player.x, player.y) < APOCALYPSE_RADIUS) {
      applyDamage(player, APOCALYPSE_DAMAGE);
      createParticles(player.x, player.y, '#8b0000', 30, entityManager);
      if (player.health <= 0) {
killPlayer(player);
}
    }
  }

  createParticles(zombie.x, zombie.y, '#8b0000', 100, entityManager);
  emitAOI(io, 'bossApocalypse', { bossId: zombieId, message: 'APOCALYPSE FINALE!' }, zombie.x, zombie.y, gameState);
}

/**
 * Update Boss Apocalypse abilities each game tick.
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
function updateBossApocalypse(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState, collisionManager) {
  if (zombie.type !== 'bossApocalypse') {
return;
}

  const healthPercent = zombie.health / zombie.maxHealth;

  _spawnMeteorShower(zombie, now, entityManager, gameState);
  _applyIcePrison(zombie, zombieId, now, healthPercent, io, entityManager, gameState);
  _fireChainLightning(zombie, now, healthPercent, entityManager, gameState, collisionManager);
  _triggerApocalypseUltimate(zombie, zombieId, now, healthPercent, io, entityManager, gameState);
}

module.exports = { updateBossApocalypse };
