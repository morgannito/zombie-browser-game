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
const MetricsCollector = require('../../../infrastructure/metrics/MetricsCollector');
const ConfigManager = require('../../../lib/server/ConfigManager');

const { CONFIG, WEAPONS } = ConfigManager;

// LAG COMPENSATION:
// Clients render remote entities ~150ms behind server time (interpolation
// buffer). When a player shoots, their crosshair is aligned with THAT past
// state, but by the time the bullet lands the zombie has moved (latency +
// interp_delay) ms forward. Bullets "visually hit" but server sees a miss.
// We advance the bullet spawn position by (latency + interp_delay) of travel,
// clamped to a safe maximum, and stopped at walls to avoid warping through.
const TARGET_FRAME_MS = 1000 / 60;
const CLIENT_INTERP_DELAY_MS = 150;
const MAX_LAG_COMPENSATION_MS = 250;
const COMPENSATION_SUBSTEP = 15;

function _lagCompensateSpawn(startX, startY, vx, vy, compensationMs, roomManager) {
  const framesAhead = compensationMs / TARGET_FRAME_MS;
  const advanceX = vx * framesAhead;
  const advanceY = vy * framesAhead;
  const distance = Math.hypot(advanceX, advanceY);
  if (distance <= COMPENSATION_SUBSTEP) {
    // Single step is enough, just check destination.
    const tx = startX + advanceX;
    const ty = startY + advanceY;
    if (
      tx < 0 || tx > CONFIG.ROOM_WIDTH || ty < 0 || ty > CONFIG.ROOM_HEIGHT ||
      (roomManager && roomManager.checkWallCollision &&
        roomManager.checkWallCollision(tx, ty, CONFIG.BULLET_SIZE))
    ) {
      return { x: startX, y: startY };
    }
    return { x: tx, y: ty };
  }
  const steps = Math.ceil(distance / COMPENSATION_SUBSTEP);
  const stepX = advanceX / steps;
  const stepY = advanceY / steps;
  let cx = startX;
  let cy = startY;
  for (let i = 0; i < steps; i++) {
    const nx = cx + stepX;
    const ny = cy + stepY;
    if (
      nx < 0 || nx > CONFIG.ROOM_WIDTH || ny < 0 || ny > CONFIG.ROOM_HEIGHT ||
      (roomManager && roomManager.checkWallCollision &&
        roomManager.checkWallCollision(nx, ny, CONFIG.BULLET_SIZE))
    ) {
      break;
    }
    cx = nx;
    cy = ny;
  }
  return { x: cx, y: cy };
}

function registerShootHandler(socket, gameState, entityManager, roomManager) {
  socket.on(
    SOCKET_EVENTS.CLIENT.SHOOT,
    safeHandler('shoot', function (data) {
      // VALIDATION: Vérifier et sanitize les données d'entrée
      const validatedData = validateShootData(data);
      if (!validatedData) {
        logger.warn('Invalid shoot data received', { socketId: socket.id, data });
        return;
      }

      // Rate limiting
      if (!checkRateLimit(socket.id, 'shoot')) {
        return;
      }

      const player = gameState.players[socket.id];
      if (!player || !player.alive || !player.hasNickname) {
        return;
      } // Pas de tir sans pseudo

      const now = Date.now();
      player.lastActivityTime = now; // Mettre à jour l'activité

      const weapon = WEAPONS[player.weapon] || WEAPONS.pistol;

      // Le Tesla Coil est une arme passive gérée automatiquement dans la game loop
      // Ne pas créer de bullets pour cette arme
      if (weapon.isTeslaCoil) {
        return;
      }

      const mutatorEffects = gameState.mutatorEffects || {};
      const fireRateCooldownMultiplier = mutatorEffects.playerFireRateCooldownMultiplier || 1;

      // Appliquer le multiplicateur de cadence de tir
      const fireRate =
        weapon.fireRate * (player.fireRateMultiplier || 1) * fireRateCooldownMultiplier;

      // Vérifier le cooldown de l'arme
      if (now - player.lastShot < fireRate) {
        return;
      }

      player.lastShot = now;

      // Nombre total de balles (arme + extra bullets)
      const totalBullets = weapon.bulletCount + (player.extraBullets || 0);

      // ANTI-CHEAT: Limiter le nombre total de balles pour éviter l'exploitation
      const MAX_TOTAL_BULLETS = 50;
      if (totalBullets > MAX_TOTAL_BULLETS) {
        logger.warn('Anti-cheat: Suspicious bullet count detected', {
          player: player.nickname || socket.id,
          bulletCount: totalBullets,
          maxAllowed: MAX_TOTAL_BULLETS
        });
        MetricsCollector.getInstance().recordCheatAttempt('bullet_count');
        if (MetricsCollector.getInstance().recordViolation(socket.id)) {
          MetricsCollector.getInstance().metrics.anticheat.player_disconnects_total++;
          MetricsCollector.getInstance().clearViolations(socket.id);
          socket.disconnect(true);
          return;
        }
      }
      const safeBulletCount = Math.min(totalBullets, MAX_TOTAL_BULLETS);

      // LAG COMPENSATION: advance bullet spawn to counter client interp delay + RTT.
      const latencyMs = Math.min(Math.max(player.latency || 0, 0), MAX_LAG_COMPENSATION_MS);
      const compensationMs = latencyMs + CLIENT_INTERP_DELAY_MS;

      // Créer les balles selon l'arme (OPTIMISÉ avec Object Pool)
      for (let i = 0; i < safeBulletCount; i++) {
        const spreadAngle = validatedData.angle + (Math.random() - 0.5) * weapon.spread;

        // Appliquer le multiplicateur de dégâts
        let damage =
          weapon.damage *
          (player.damageMultiplier || 1) *
          (mutatorEffects.playerDamageMultiplier || 1);

        // Critique (chance de base + chance de l'arme)
        const totalCritChance = (player.criticalChance || 0) + (weapon.criticalChance || 0);
        const isCritical = Math.random() < totalCritChance;
        if (isCritical) {
          const critMultiplier = weapon.criticalMultiplier || 2;
          damage *= critMultiplier;
        }

        // Piercing (de base + piercing de l'arme)
        // FIX: Support plasmaPiercing for plasma rifle weapon
        const weaponPiercing = weapon.piercing || weapon.plasmaPiercing || 0;
        const totalPiercing = (player.bulletPiercing || 0) + weaponPiercing;

        const vx = Math.cos(spreadAngle) * weapon.bulletSpeed;
        const vy = Math.sin(spreadAngle) * weapon.bulletSpeed;
        const spawn = _lagCompensateSpawn(player.x, player.y, vx, vy, compensationMs, roomManager);

        // CORRECTION: Utilisation du pool d'objets au lieu de création manuelle
        entityManager.createBullet({
          x: spawn.x,
          y: spawn.y,
          vx,
          vy,
          playerId: socket.id,
          damage: damage,
          color: isCritical ? '#ff0000' : weapon.color,
          size: weapon.bulletSize || CONFIG.BULLET_SIZE,
          piercing: totalPiercing,
          explosiveRounds: player.explosiveRounds || weapon.hasExplosion || false,
          explosionRadius: weapon.hasExplosion
            ? weapon.explosionRadius
            : player.explosionRadius || 0,
          explosionDamagePercent: weapon.hasExplosion ? 1 : player.explosionDamagePercent || 0,
          rocketExplosionDamage: weapon.hasExplosion ? weapon.explosionDamage : 0,
          isRocket: (weapon.hasExplosion && !weapon.isGrenade) || false,
          isFlame: weapon.isFlame || false,
          isLaser: weapon.isLaser || false,
          isGrenade: weapon.isGrenade || false,
          isCrossbow: weapon.isCrossbow || false,
          // Nouvelles armes
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
    })
  );
}

module.exports = { registerShootHandler };
