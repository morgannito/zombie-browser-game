/**
 * @fileoverview Boss Infernal abilities (wave 115)
 */

const ConfigManager = require('../../../../lib/server/ConfigManager');
const { createParticles } = require('../../../../game/lootFunctions');
const { distance } = require('../../../../game/utilityFunctions');
const { emitAOI, applyDamage, killPlayer } = require('./shared');

const { CONFIG: _CONFIG, ZOMBIE_TYPES } = ConfigManager;

const FIRE_AURA_COOLDOWN = 1000;
const FIRE_AURA_RADIUS = 120;
const FIRE_AURA_DAMAGE = 8;
const METEOR_COOLDOWN = 8000;
const FIRE_MINIONS_COOLDOWN = 15000;
const FIRE_MINIONS_COUNT = 5;
const FIRE_MINIONS_SPAWN_RADIUS = 150;

/**
 * Pick a random alive player from gameState.
 * @param {object} gameState
 * @returns {object|null}
 */
function _pickRandomAlivePlayer(gameState) {
  let aliveCount = 0;
  for (const id in gameState.players) {
    if (gameState.players[id].alive) aliveCount++;
  }
  if (aliveCount === 0) return null;

  let pick = Math.floor(Math.random() * aliveCount);
  for (const id in gameState.players) {
    if (gameState.players[id].alive && pick-- === 0) {
      return gameState.players[id];
    }
  }
  return null;
}

/**
 * Apply fire aura passive damage to players within radius.
 * @param {object} zombie
 * @param {number} now
 * @param {object} entityManager
 * @param {object} gameState
 */
function _applyFireAura(zombie, now, entityManager, gameState) {
  if (zombie.lastAuraDamage && now - zombie.lastAuraDamage < FIRE_AURA_COOLDOWN) return;
  zombie.lastAuraDamage = now;

  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player.alive || player.spawnProtection || player.invisible) continue;

    if (distance(zombie.x, zombie.y, player.x, player.y) < FIRE_AURA_RADIUS) {
      applyDamage(player, FIRE_AURA_DAMAGE);
      createParticles(player.x, player.y, '#ff4500', 6, entityManager);
      if (player.health <= 0) killPlayer(player);
    }
  }

  createParticles(zombie.x, zombie.y, '#ff4500', 10, entityManager);
}

/**
 * Launch a meteor strike at a random alive player.
 * @param {object} zombie
 * @param {string} zombieId
 * @param {number} now
 * @param {import('socket.io').Server} io
 * @param {object} entityManager
 * @param {object} gameState
 */
function _launchMeteorStrike(zombie, zombieId, now, io, entityManager, gameState) {
  if (zombie.lastMeteor && now - zombie.lastMeteor < METEOR_COOLDOWN) return;
  zombie.lastMeteor = now;

  const target = _pickRandomAlivePlayer(gameState);
  if (!target) return;

  if (gameState.hazardManager) {
    gameState.hazardManager.createHazard('meteor', target.x, target.y, 100, 60, 2000);
  }

  createParticles(target.x, target.y, '#ff0000', 40, entityManager);
  emitAOI(io, 'bossMeteor', { bossId: zombieId, x: target.x, y: target.y }, target.x, target.y, gameState);
}

/**
 * Summon fire minions in phase 2+ (health <= 66%).
 * Guard uses a phaseTriggered flag to prevent double-trigger on same tick.
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
function _summonFireMinions(zombie, zombieId, now, healthPercent, io, zombieManager, perfIntegration, entityManager, gameState) {
  if (healthPercent > 0.66) return;
  if (zombie.lastFireMinions && now - zombie.lastFireMinions < FIRE_MINIONS_COOLDOWN) return;
  zombie.lastFireMinions = now;

  for (let i = 0; i < FIRE_MINIONS_COUNT; i++) {
    let zombieCount = 0;
    for (const _ in gameState.zombies) zombieCount++;
    if (!perfIntegration.canSpawnZombie(zombieCount)) continue;

    const angle = (Math.PI * 2 * i) / FIRE_MINIONS_COUNT;
    zombieManager.spawnSpecificZombie(
      'inferno',
      zombie.x + Math.cos(angle) * FIRE_MINIONS_SPAWN_RADIUS,
      zombie.y + Math.sin(angle) * FIRE_MINIONS_SPAWN_RADIUS
    );
  }

  createParticles(zombie.x, zombie.y, '#ff4500', 50, entityManager);
  emitAOI(io, 'bossFireMinions', { bossId: zombieId }, zombie.x, zombie.y, gameState);
}

/**
 * Update Boss Infernal abilities each game tick.
 * @param {object} zombie
 * @param {string} zombieId
 * @param {number} now  Current timestamp (ms).
 * @param {import('socket.io').Server} io
 * @param {object} zombieManager
 * @param {object} perfIntegration
 * @param {object} entityManager
 * @param {object} gameState
 */
function updateBossInfernal(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState) {
  if (zombie.type !== 'bossInfernal') return;
  if (!ZOMBIE_TYPES.bossInfernal) return;

  const healthPercent = zombie.health / zombie.maxHealth;

  _applyFireAura(zombie, now, entityManager, gameState);
  _launchMeteorStrike(zombie, zombieId, now, io, entityManager, gameState);
  _summonFireMinions(zombie, zombieId, now, healthPercent, io, zombieManager, perfIntegration, entityManager, gameState);
}

module.exports = { updateBossInfernal };
