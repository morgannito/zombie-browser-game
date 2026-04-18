/**
 * @fileoverview Boss Vortex abilities (wave 160)
 */

const { createParticles } = require('../../../../game/lootFunctions');
const { distance } = require('../../../../game/utilityFunctions');
const { applyDamage, killPlayer } = require('./shared');

const TORNADO_COOLDOWN = 7000;
const TORNADO_RADIUS = 180;
const TORNADO_DAMAGE = 20;
const TORNADO_PULL_SPEED = 3;
const LIGHTNING_COOLDOWN = 4000;
const LIGHTNING_COUNT = 6;
const LIGHTNING_MAX_DIST = 400;
const HURRICANE_SLOW_COOLDOWN = 1500;
const HURRICANE_VISUAL_COOLDOWN = 3000;

/**
 * Pull nearby players toward the boss and deal damage (tornado effect).
 * @param {object} zombie
 * @param {number} now
 * @param {object} entityManager
 * @param {object} gameState
 */
function _applyTornadoPull(zombie, now, entityManager, gameState) {
  if (zombie.lastTornado && now - zombie.lastTornado < TORNADO_COOLDOWN) {
return;
}
  zombie.lastTornado = now;

  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player.alive) {
continue;
}

    if (distance(zombie.x, zombie.y, player.x, player.y) < TORNADO_RADIUS) {
      const angle = Math.atan2(zombie.y - player.y, zombie.x - player.x);
      player.x += Math.cos(angle) * TORNADO_PULL_SPEED;
      player.y += Math.sin(angle) * TORNADO_PULL_SPEED;

      applyDamage(player, TORNADO_DAMAGE);
      createParticles(player.x, player.y, '#00ced1', 8, entityManager);
      if (player.health <= 0) {
killPlayer(player);
}
    }
  }

  createParticles(zombie.x, zombie.y, '#00ced1', 30, entityManager);
}

/**
 * Spawn random lightning strike hazards in phase 2+ (health <= 66%).
 * @param {object} zombie
 * @param {number} now
 * @param {number} healthPercent
 * @param {object} entityManager
 * @param {object} gameState
 */
function _spawnLightningStrikes(zombie, now, healthPercent, entityManager, gameState) {
  if (healthPercent > 0.66) {
return;
}
  if (zombie.lastLightning && now - zombie.lastLightning < LIGHTNING_COOLDOWN) {
return;
}
  zombie.lastLightning = now;

  for (let i = 0; i < LIGHTNING_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * LIGHTNING_MAX_DIST;
    const strikeX = zombie.x + Math.cos(angle) * dist;
    const strikeY = zombie.y + Math.sin(angle) * dist;

    if (gameState.hazardManager) {
      gameState.hazardManager.createHazard('lightning', strikeX, strikeY, 60, 40, 1000);
    }
    createParticles(strikeX, strikeY, '#ffff00', 25, entityManager);
  }
}

/**
 * Apply hurricane slow to all living players in phase 3+ (health <= 33%).
 * @param {object} zombie
 * @param {number} now
 * @param {number} healthPercent
 * @param {object} entityManager
 * @param {object} gameState
 */
function _applyHurricaneSlow(zombie, now, healthPercent, entityManager, gameState) {
  if (healthPercent > 0.33) {
return;
}

  if (!zombie.lastHurricane || now - zombie.lastHurricane >= HURRICANE_SLOW_COOLDOWN) {
    zombie.lastHurricane = now;

    for (const playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.alive || player.spawnProtection || player.invisible) {
continue;
}

      player.slowedUntil = now + 1500;
      player.slowAmount = 0.3;
      createParticles(player.x, player.y, '#00ced1', 3, entityManager);
    }
  }

  if (!zombie.lastHurricaneVisual || now - zombie.lastHurricaneVisual >= HURRICANE_VISUAL_COOLDOWN) {
    zombie.lastHurricaneVisual = now;
    createParticles(zombie.x, zombie.y, '#00ced1', 40, entityManager);
  }
}

/**
 * Update Boss Vortex abilities each game tick.
 * @param {object} zombie
 * @param {string} zombieId
 * @param {number} now  Current timestamp (ms).
 * @param {import('socket.io').Server} io
 * @param {object} entityManager
 * @param {object} gameState
 */
function updateBossVortex(zombie, zombieId, now, io, entityManager, gameState) {
  if (zombie.type !== 'bossVortex') {
return;
}

  const healthPercent = zombie.health / zombie.maxHealth;

  _applyTornadoPull(zombie, now, entityManager, gameState);
  _spawnLightningStrikes(zombie, now, healthPercent, entityManager, gameState);
  _applyHurricaneSlow(zombie, now, healthPercent, entityManager, gameState);
}

module.exports = { updateBossVortex };
