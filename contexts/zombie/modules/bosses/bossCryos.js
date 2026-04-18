/**
 * @fileoverview Boss Cryos abilities (wave 140)
 */

const { createParticles } = require('../../../../game/lootFunctions');
const { distance } = require('../../../../game/utilityFunctions');
const { emitAOI, applyDamage, killPlayer } = require('./shared');

const ICE_SPIKES_COOLDOWN = 6000;
const ICE_SPIKES_COUNT = 8;
const ICE_SPIKES_RADIUS = 200;
const ICE_CLONES_COOLDOWN = 20000;
const ICE_CLONES_COUNT = 3;
const ICE_CLONES_RADIUS = 120;
const FREEZE_AURA_COOLDOWN = 2000;
const FREEZE_AURA_RADIUS = 150;
const BLIZZARD_COOLDOWN = 10000;
const BLIZZARD_DURATION = 8000;
const BLIZZARD_TICK_INTERVAL = 500;
const BLIZZARD_DAMAGE_PER_SEC = 15;

/**
 * Spawn radial ice spike hazards around the boss.
 * @param {object} zombie
 * @param {string} zombieId
 * @param {number} now
 * @param {import('socket.io').Server} io
 * @param {object} entityManager
 * @param {object} gameState
 */
function _spawnIceSpikes(zombie, zombieId, now, io, entityManager, gameState) {
  if (zombie.lastSpikes && now - zombie.lastSpikes < ICE_SPIKES_COOLDOWN) {
return;
}
  zombie.lastSpikes = now;

  for (let i = 0; i < ICE_SPIKES_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / ICE_SPIKES_COUNT;
    const spikeX = zombie.x + Math.cos(angle) * ICE_SPIKES_RADIUS;
    const spikeY = zombie.y + Math.sin(angle) * ICE_SPIKES_RADIUS;

    if (gameState.hazardManager) {
      gameState.hazardManager.createHazard('iceSpike', spikeX, spikeY, 50, 50, 3000);
    }
    createParticles(spikeX, spikeY, '#00bfff', 20, entityManager);
  }

  emitAOI(io, 'bossIceSpikes', { bossId: zombieId }, zombie.x, zombie.y, gameState);
}

/**
 * Summon ice clone minions in phase 2+ (health <= 66%).
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
function _summonIceClones(zombie, zombieId, now, healthPercent, io, zombieManager, perfIntegration, entityManager, gameState) {
  if (healthPercent > 0.66) {
return;
}
  if (zombie.lastIceClones && now - zombie.lastIceClones < ICE_CLONES_COOLDOWN) {
return;
}
  zombie.lastIceClones = now;

  for (let i = 0; i < ICE_CLONES_COUNT; i++) {
    let zombieCount = 0;
    for (const _ in gameState.zombies) {
zombieCount++;
}
    if (!perfIntegration.canSpawnZombie(zombieCount)) {
continue;
}

    const angle = (Math.PI * 2 * i) / ICE_CLONES_COUNT;
    zombieManager.spawnSpecificZombie(
      'glacier',
      zombie.x + Math.cos(angle) * ICE_CLONES_RADIUS,
      zombie.y + Math.sin(angle) * ICE_CLONES_RADIUS
    );
  }

  createParticles(zombie.x, zombie.y, '#00bfff', 60, entityManager);
  emitAOI(io, 'bossIceClones', { bossId: zombieId }, zombie.x, zombie.y, gameState);
}

/**
 * Apply freeze aura slow to nearby players in phase 3 (health <= 33%).
 * @param {object} zombie
 * @param {number} now
 * @param {number} healthPercent
 * @param {object} entityManager
 * @param {object} gameState
 */
function _applyFreezeAura(zombie, now, healthPercent, entityManager, gameState) {
  if (healthPercent > 0.33) {
return;
}
  if (zombie.lastFreezeAura && now - zombie.lastFreezeAura < FREEZE_AURA_COOLDOWN) {
return;
}
  zombie.lastFreezeAura = now;

  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player.alive || player.spawnProtection || player.invisible) {
continue;
}

    if (distance(zombie.x, zombie.y, player.x, player.y) < FREEZE_AURA_RADIUS) {
      player.slowedUntil = now + 2000;
      player.slowAmount = 0.5;
      createParticles(player.x, player.y, '#aaddff', 4, entityManager);
    }
  }
}

/**
 * Trigger a blizzard that lasts BLIZZARD_DURATION ms in phase 3 (health <= 33%).
 * @param {object} zombie
 * @param {string} zombieId
 * @param {number} now
 * @param {number} healthPercent
 * @param {import('socket.io').Server} io
 * @param {object} gameState
 */
function _triggerBlizzard(zombie, zombieId, now, healthPercent, io, gameState) {
  if (healthPercent > 0.33) {
return;
}
  if (zombie.lastBlizzard && now - zombie.lastBlizzard < BLIZZARD_COOLDOWN) {
return;
}
  zombie.lastBlizzard = now;
  zombie.blizzardActive = true;
  zombie.blizzardEnd = now + BLIZZARD_DURATION;

  emitAOI(io, 'bossBlizzard', { bossId: zombieId, duration: BLIZZARD_DURATION }, zombie.x, zombie.y, gameState);
}

/**
 * Apply ongoing blizzard damage each tick; deactivate when expired.
 * @param {object} zombie
 * @param {number} now
 * @param {object} entityManager
 * @param {object} gameState
 */
function _applyBlizzardTick(zombie, now, entityManager, gameState) {
  if (!zombie.blizzardActive) {
return;
}

  if (now >= zombie.blizzardEnd) {
    zombie.blizzardActive = false;
    return;
  }

  if (zombie.lastBlizzardTick && now - zombie.lastBlizzardTick < BLIZZARD_TICK_INTERVAL) {
return;
}
  zombie.lastBlizzardTick = now;

  const tickDamage = BLIZZARD_DAMAGE_PER_SEC / 2;
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player.alive) {
continue;
}

    applyDamage(player, tickDamage);
    createParticles(player.x, player.y, '#aaddff', 3, entityManager);
    if (player.health <= 0) {
killPlayer(player);
}
  }
}

/**
 * Update Boss Cryos abilities each game tick.
 * @param {object} zombie
 * @param {string} zombieId
 * @param {number} now  Current timestamp (ms).
 * @param {import('socket.io').Server} io
 * @param {object} zombieManager
 * @param {object} perfIntegration
 * @param {object} entityManager
 * @param {object} gameState
 */
function updateBossCryos(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState) {
  if (zombie.type !== 'bossCryos') {
return;
}

  const healthPercent = zombie.health / zombie.maxHealth;

  _spawnIceSpikes(zombie, zombieId, now, io, entityManager, gameState);
  _summonIceClones(zombie, zombieId, now, healthPercent, io, zombieManager, perfIntegration, entityManager, gameState);
  _applyFreezeAura(zombie, now, healthPercent, entityManager, gameState);
  _triggerBlizzard(zombie, zombieId, now, healthPercent, io, gameState);
  _applyBlizzardTick(zombie, now, entityManager, gameState);
}

module.exports = { updateBossCryos };
