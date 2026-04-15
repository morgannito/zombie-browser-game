/**
 * @fileoverview Shoot handler.
 * @description Validates shoot rate-limit, spawns bullet via entityManager,
 * handles muzzle effects and autoTurret. Seventh slice of the socketHandlers
 * split.
 */

const { SOCKET_EVENTS } = require("../events");
const { safeHandler } = require('../../../sockets/socketUtils');
const { checkRateLimit } = require('../../../sockets/rateLimitStore');
const { validateShootData } = require('../../../game/validationFunctions');
const logger = require("../../../infrastructure/logging/Logger");
const MetricsCollector = require('../../../lib/infrastructure/MetricsCollector');
const ConfigManager = require('../../../lib/server/ConfigManager');

const { CONFIG, WEAPONS } = ConfigManager;

function registerShootHandler(socket, gameState, entityManager) {
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

        // CORRECTION: Utilisation du pool d'objets au lieu de création manuelle
        entityManager.createBullet({
          x: player.x,
          y: player.y,
          vx: Math.cos(spreadAngle) * weapon.bulletSpeed,
          vy: Math.sin(spreadAngle) * weapon.bulletSpeed,
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
