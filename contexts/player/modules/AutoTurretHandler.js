/**
 * @fileoverview Auto-turret logic - targeting and bullet firing
 */

const { CONFIG, GAMEPLAY_CONSTANTS } = require('../../../lib/server/ConfigManager');
const MathUtils = require('../../../lib/MathUtils');
const { createParticles } = require("../../../game/lootFunctions");

/**
 * Update auto-turret for a player: find closest zombie and fire if cooldown elapsed.
 * @param {Object} player - Player state object
 * @param {string} playerId - Socket ID of the player
 * @param {number} now - Current timestamp (ms)
 * @param {Object} collisionManager - CollisionManager instance
 * @param {Object} entityManager - EntityManager instance
 * @param {Object} gameState - Global game state
 * @returns {void}
 */
function updateAutoTurrets(player, playerId, now, collisionManager, entityManager, gameState) {
  if (!player.autoTurrets || player.autoTurrets <= 0) {
    return;
  }
  if (!player.hasNickname || player.spawnProtection) {
    return;
  }

  const autoFireCooldown = GAMEPLAY_CONSTANTS.AUTO_TURRET_BASE_COOLDOWN / player.autoTurrets;

  if (now - player.lastAutoShot < autoFireCooldown) {
    return;
  }

  const closestZombie = collisionManager.findClosestZombie(
    player.x,
    player.y,
    GAMEPLAY_CONSTANTS.AUTO_TURRET_RANGE
  );

  if (closestZombie) {
    fireAutoTurret(player, playerId, closestZombie, now, entityManager, gameState);
  }
}

/**
 * Fire a single auto-turret bullet toward the target zombie.
 * @param {Object} player - Player state object
 * @param {string} playerId - Socket ID of the player
 * @param {Object} closestZombie - Closest zombie target {x, y}
 * @param {number} now - Current timestamp (ms)
 * @param {Object} entityManager - EntityManager instance
 * @param {Object} gameState - Global game state
 * @returns {void}
 */
function fireAutoTurret(player, playerId, closestZombie, now, entityManager, gameState) {
  const angle = Math.atan2(closestZombie.y - player.y, closestZombie.x - player.x);
  const baseDamage = CONFIG.BULLET_DAMAGE * 0.6;
  const mutatorDamageMultiplier = gameState?.mutatorEffects?.playerDamageMultiplier || 1;
  const damage = baseDamage * (player.damageMultiplier || 1) * mutatorDamageMultiplier;

  entityManager.createBullet({
    x: player.x,
    y: player.y,
    vx: MathUtils.fastCos(angle) * CONFIG.BULLET_SPEED,
    vy: MathUtils.fastSin(angle) * CONFIG.BULLET_SPEED,
    playerId: playerId,
    damage: damage,
    color: '#00ffaa',
    piercing: 0,
    explosiveRounds: false,
    explosionRadius: 0,
    explosionDamagePercent: 0,
    isAutoTurret: true
  });

  player.lastAutoShot = now;
  createParticles(player.x, player.y, '#00ffaa', 3, entityManager);
}

module.exports = { updateAutoTurrets, fireAutoTurret };
