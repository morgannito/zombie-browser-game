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
// We tag new bullets with `spawnCompensationMs`; the BulletUpdater consumes
// this on the first tick and advances the bullet through its normal swept
// collision pipeline, which already handles zombies AND walls correctly.
const CLIENT_INTERP_DELAY_MS = 150;
const MAX_LAG_COMPENSATION_MS = 250;

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

      // Keep a hard bullet cap to protect the server loop, but no more cheat
      // logging / violations / disconnects.
      const MAX_TOTAL_BULLETS = 50;
      const safeBulletCount = Math.min(totalBullets, MAX_TOTAL_BULLETS);

      // Lag compensation removed: fast-forwarding the bullet against a
      // non-rewound zombie position produced trajectory mismatches (bullets
      // phasing above moving zombies). Real rewind would require snapshotting
      // zombie positions per tick, which is a bigger rewrite.
      const compensationMs = 0;
      void CLIENT_INTERP_DELAY_MS; void MAX_LAG_COMPENSATION_MS;

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

        // Prefer the client-supplied origin so long-range shots hit what the
        // player's crosshair saw. Fall back to server player position if the
        // client didn't send coords (legacy clients or grossly-invalid payload).
        const MAX_CLIENT_OFFSET = 300; // px sanity cap (would-be-desync ceiling)
        let originX = player.x, originY = player.y;
        if (
          typeof validatedData.x === 'number' &&
          typeof validatedData.y === 'number' &&
          Math.hypot(validatedData.x - player.x, validatedData.y - player.y) <= MAX_CLIENT_OFFSET
        ) {
          originX = validatedData.x;
          originY = validatedData.y;
        }

        entityManager.createBullet({
          x: originX,
          y: originY,
          vx,
          vy,
          // Consumed on first BulletUpdater tick — advances bullet through full
          // swept collision (walls + zombies) to counter client interp+RTT lag.
          spawnCompensationMs: compensationMs,
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
