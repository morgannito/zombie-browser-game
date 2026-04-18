/**
 * @fileoverview Shoot handler.
 * @description Validates shoot rate-limit, spawns bullet via entityManager,
 * handles muzzle effects and autoTurret. Seventh slice of the socketHandlers
 * split.
 */

const { SOCKET_EVENTS } = require('../events');
const { safeHandler } = require('../../../sockets/socketUtils');
const { checkRateLimit } = require('../../../sockets/rateLimitStore');
const { validateShootData } = require('../../../game/validationFunctions');
const logger = require('../../../infrastructure/logging/Logger');
const ConfigManager = require('../../../lib/server/ConfigManager');

const { CONFIG, WEAPONS } = ConfigManager;

// LAG COMPENSATION:
// Clients render remote entities ~150ms behind server time (interpolation
// buffer). When a player shoots, their crosshair is aligned with THAT past
// state, but by the time the bullet lands the zombie has moved (latency +
// interp_delay) ms forward. Bullets "visually hit" but server sees a miss.
// We tag new bullets with `spawnCompensationMs`; the BulletUpdater consumes
// this on the first tick and advances the bullet through its normal swept
// collision pipeline, which already handles zombies AND walls correctly.
const CLIENT_INTERP_DELAY_MS = 150;
const MAX_LAG_COMPENSATION_MS = 250;

/**
 * Compute effective fire rate for a player/weapon combination.
 * @param {Object} weapon
 * @param {Object} player
 * @param {Object} mutatorEffects
 * @returns {number} Fire rate in ms
 */
function _computeFireRate(weapon, player, mutatorEffects) {
  const cooldownMultiplier = mutatorEffects.playerFireRateCooldownMultiplier || 1;
  return weapon.fireRate * (player.fireRateMultiplier || 1) * cooldownMultiplier;
}

/**
 * Compute damage for a single bullet, applying multipliers and crit roll.
 * @param {Object} weapon
 * @param {Object} player
 * @param {Object} mutatorEffects
 * @returns {{ damage: number, isCritical: boolean }}
 */
function _rollBulletDamage(weapon, player, mutatorEffects) {
  let damage =
    weapon.damage *
    (player.damageMultiplier || 1) *
    (mutatorEffects.playerDamageMultiplier || 1);
  const totalCritChance = (player.criticalChance || 0) + (weapon.criticalChance || 0);
  const isCritical = Math.random() < totalCritChance;
  if (isCritical) {
    damage *= weapon.criticalMultiplier || 2;
  }
  return { damage, isCritical };
}

/**
 * Resolve bullet spawn origin: client-supplied if within sanity cap, else server position.
 * @param {Object} validatedData
 * @param {Object} player
 * @returns {{ originX: number, originY: number }}
 */
function _resolveBulletOrigin(validatedData, player) {
  const MAX_CLIENT_OFFSET = 300;
  if (
    typeof validatedData.x === 'number' &&
    typeof validatedData.y === 'number' &&
    Math.hypot(validatedData.x - player.x, validatedData.y - player.y) <= MAX_CLIENT_OFFSET
  ) {
    return { originX: validatedData.x, originY: validatedData.y };
  }
  return { originX: player.x, originY: player.y };
}

/**
 * Build and emit all bullets for a single shoot event.
 * @param {Object} entityManager
 * @param {Object} validatedData
 * @param {Object} player
 * @param {Object} weapon
 * @param {Object} mutatorEffects
 * @param {string} socketId
 * @param {number} now
 * @returns {void}
 */
function _spawnBullets(entityManager, validatedData, player, weapon, mutatorEffects, socketId, now) {
  const totalBullets = weapon.bulletCount + (player.extraBullets || 0);
  const MAX_TOTAL_BULLETS = 50;
  const safeBulletCount = Math.min(totalBullets, MAX_TOTAL_BULLETS);

  // Lag compensation removed: fast-forwarding the bullet against a
  // non-rewound zombie position produced trajectory mismatches.
  const compensationMs = 0;
  void CLIENT_INTERP_DELAY_MS; void MAX_LAG_COMPENSATION_MS;

  const weaponPiercing = weapon.piercing || weapon.plasmaPiercing || 0;
  const totalPiercing = (player.bulletPiercing || 0) + weaponPiercing;
  const { originX, originY } = _resolveBulletOrigin(validatedData, player);

  for (let i = 0; i < safeBulletCount; i++) {
    const spreadAngle = validatedData.angle + (Math.random() - 0.5) * weapon.spread;
    const { damage, isCritical } = _rollBulletDamage(weapon, player, mutatorEffects);
    const vx = Math.cos(spreadAngle) * weapon.bulletSpeed;
    const vy = Math.sin(spreadAngle) * weapon.bulletSpeed;

    entityManager.createBullet({
      x: originX,
      y: originY,
      vx,
      vy,
      spawnCompensationMs: compensationMs,
      playerId: socketId,
      damage,
      color: isCritical ? '#ff0000' : weapon.color,
      size: weapon.bulletSize || CONFIG.BULLET_SIZE,
      piercing: totalPiercing,
      explosiveRounds: player.explosiveRounds || weapon.hasExplosion || false,
      explosionRadius: weapon.hasExplosion ? weapon.explosionRadius : player.explosionRadius || 0,
      explosionDamagePercent: weapon.hasExplosion ? 1 : player.explosionDamagePercent || 0,
      rocketExplosionDamage: weapon.hasExplosion ? weapon.explosionDamage : 0,
      isRocket: (weapon.hasExplosion && !weapon.isGrenade) || false,
      isFlame: weapon.isFlame || false,
      isLaser: weapon.isLaser || false,
      isGrenade: weapon.isGrenade || false,
      isCrossbow: weapon.isCrossbow || false,
      isChainLightning: weapon.isChainLightning || false,
      isPoisonDart: weapon.isPoisonDart || false,
      isTeslaCoil: weapon.isTeslaCoil || false,
      isIceCannon: weapon.isIceCannon || false,
      isPlasmaRifle: weapon.isPlasmaRifle || false,
      ignoresWalls: weapon.ignoresWalls || false,
      gravity: weapon.gravity || 0,
      lifetime: weapon.lifetime ? now + weapon.lifetime : null,
      createdAt: now
    });
  }
}

/**
 * Register the shoot socket handler.
 * @param {import('socket.io').Socket} socket
 * @param {Object} gameState
 * @param {Object} entityManager
 * @param {Object} roomManager
 * @returns {void}
 */
function registerShootHandler(socket, gameState, entityManager, _roomManager) {
  socket.on(
    SOCKET_EVENTS.CLIENT.SHOOT,
    safeHandler('shoot', function (data) {
      if (socket.spectator) {
        return;
      }
      // DoS guard: a shoot payload is never more than a few fields.
      if (!data || Buffer.byteLength(JSON.stringify(data), 'utf8') > 512) {
        logger.warn('shoot: oversized payload rejected', { socketId: socket.id });
        return;
      }
      const validatedData = validateShootData(data);
      if (!validatedData) {
        logger.warn('Invalid shoot data received', { socketId: socket.id, data });
        return;
      }

      if (!checkRateLimit(socket.id, 'shoot')) {
        return;
      }

      /** @type {import('../../../types/jsdoc-types').PlayerState|undefined} */
      const player = gameState.players[socket.id];
      if (!player || !player.alive || !player.hasNickname) {
        return;
      }

      const now = Date.now();
      player.lastActivityTime = now;

      const weapon = WEAPONS[player.weapon] || WEAPONS.pistol;

      // Tesla Coil is passive — managed by game loop, no client-triggered bullets
      if (weapon.isTeslaCoil) {
        return;
      }

      const mutatorEffects = gameState.mutatorEffects || {};
      const fireRate = _computeFireRate(weapon, player, mutatorEffects);

      if (now - player.lastShot < fireRate) {
        return;
      }
      player.lastShot = now;

      _spawnBullets(entityManager, validatedData, player, weapon, mutatorEffects, socket.id, now);
    })
  );
}

module.exports = { registerShootHandler };
