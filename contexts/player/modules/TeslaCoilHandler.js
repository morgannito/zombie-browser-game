/**
 * @fileoverview Tesla Coil weapon logic - targeting, damage, and visual effects
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const { createParticles, createLoot } = require("../../../game/lootFunctions");

/**
 * Update tesla coil for a player: check cooldown and fire if ready.
 * @param {Object} player - Player state object
 * @param {string} playerId - Socket ID of the player
 * @param {number} now - Current timestamp (ms)
 * @param {Object} collisionManager - CollisionManager instance
 * @param {Object} entityManager - EntityManager instance
 * @param {Object} gameState - Global game state
 * @param {Object|null} io - Socket.IO server instance
 * @param {Object|null} zombieManager - ZombieManager instance
 * @returns {void}
 */
function updateTeslaCoil(
  player,
  playerId,
  now,
  collisionManager,
  entityManager,
  gameState,
  io = null,
  zombieManager = null
) {
  if (player.weapon !== 'teslaCoil' || !player.hasNickname || player.spawnProtection) {
    return;
  }

  if (!player.lastTeslaShot) {
    player.lastTeslaShot = 0;
  }

  const teslaWeapon = ConfigManager.WEAPONS.teslaCoil;
  const fireRateCooldownMultiplier =
    gameState.mutatorEffects?.playerFireRateCooldownMultiplier || 1;
  const teslaCooldown =
    teslaWeapon.fireRate * (player.fireRateMultiplier || 1) * fireRateCooldownMultiplier;

  if (now - player.lastTeslaShot >= teslaCooldown) {
    _fireTeslaCoil(
      player,
      teslaWeapon,
      now,
      collisionManager,
      entityManager,
      gameState,
      io,
      zombieManager
    );
  }
}

/**
 * Fire tesla coil: collect targets and apply damage to each
 */
function _fireTeslaCoil(
  player,
  teslaWeapon,
  now,
  collisionManager,
  entityManager,
  gameState,
  io,
  zombieManager
) {
  const zombiesInRange = collisionManager.findZombiesInRadius(
    player.x,
    player.y,
    teslaWeapon.teslaRange
  );
  const targets = zombiesInRange.slice(0, teslaWeapon.teslaMaxTargets);

  if (targets.length === 0) {
    return;
  }

  const mutatorDamageMultiplier = gameState.mutatorEffects?.playerDamageMultiplier || 1;
  const damage = teslaWeapon.damage * (player.damageMultiplier || 1) * mutatorDamageMultiplier;

  for (const zombie of targets) {
    _applyTeslaDamage(
      zombie,
      damage,
      player,
      teslaWeapon,
      entityManager,
      gameState,
      now,
      io,
      zombieManager
    );
  }

  player.lastTeslaShot = now;
}

/**
 * Apply tesla damage to a single zombie with full validation
 */
function _applyTeslaDamage(
  zombie,
  damage,
  player,
  teslaWeapon,
  entityManager,
  gameState,
  now,
  io,
  zombieManager
) {
  if (!zombie || typeof zombie !== 'object') {
    return;
  }
  if (typeof zombie.health !== 'number' || !isFinite(zombie.health)) {
    return;
  }
  if (!isFinite(damage) || damage < 0) {
    return;
  }
  if (!gameState.zombies[zombie.id]) {
    return;
  }

  zombie.health -= damage;
  _applyLifeSteal(player, damage);
  _createTeslaVisuals(player, zombie, teslaWeapon, entityManager);

  if (zombie.health <= 0) {
    _handleTeslaKill(zombie, player, gameState, entityManager, now, io, zombieManager);
  }
}

/**
 * Apply life steal to player if applicable
 */
function _applyLifeSteal(player, damage) {
  if (!player || !player.lifeSteal || !isFinite(player.lifeSteal)) {
    return;
  }

  const lifeStolen = damage * player.lifeSteal;
  if (isFinite(lifeStolen) && lifeStolen > 0) {
    player.health = Math.min(
      player.health + lifeStolen,
      player.maxHealth || player.health + lifeStolen
    );
  }
}

/**
 * Create arc and impact particle effects for tesla coil
 */
function _createTeslaVisuals(player, zombie, teslaWeapon, entityManager) {
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const arcX = player.x + (zombie.x - player.x) * ratio;
    const arcY = player.y + (zombie.y - player.y) * ratio;
    createParticles(arcX, arcY, teslaWeapon.color, 1, entityManager);
  }

  createParticles(zombie.x, zombie.y, teslaWeapon.color, 3, entityManager);
}

/**
 * Handle zombie killed by tesla coil, including boss wave trigger
 */
function _handleTeslaKill(zombie, player, gameState, entityManager, now, io, zombieManager) {
  createParticles(zombie.x, zombie.y, zombie.color, 15, entityManager);

  if (player) {
    player.combo = (player.combo || 0) + 1;
    player.comboTimer = now;
    player.kills = (player.kills || 0) + 1;
    player.zombiesKilled = (player.zombiesKilled || 0) + 1;
  }

  createLoot(zombie.x, zombie.y, zombie.goldDrop, zombie.xpDrop, gameState);
  delete gameState.zombies[zombie.id];
  gameState.zombiesKilledThisWave++;

  if (zombie.isBoss && io && zombieManager) {
    const { handleNewWave } = require("../../../game/modules/wave/WaveManager");
    handleNewWave(gameState, io, zombieManager);
  }
}

module.exports = { updateTeslaCoil };
