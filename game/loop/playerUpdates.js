/**
 * PLAYER UPDATES MODULE
 * Handles player state updates (power-ups, regeneration, auto-turrets, Tesla Coil)
 * Extracted from gameLoop.js for better code organization
 * @module playerUpdates
 * @version 1.0.0
 */

const ConfigManager = require('../../lib/server/ConfigManager');
const MathUtils = require('../../lib/MathUtils');
const { createParticles, createLoot } = require('../lootFunctions');

const { CONFIG } = ConfigManager;

/**
 * Update all player states (power-ups expiration, regeneration, combos)
 * @param {Object} gameState - Game state
 * @param {Number} now - Current timestamp
 * @param {Object} io - Socket.IO instance
 * @param {Object} collisionManager - Collision manager
 * @param {Object} entityManager - Entity manager
 */
function updatePlayers(gameState, now, io, collisionManager, entityManager) {
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];

    if (!player.alive) {
      continue;
    }

    // Spawn protection expiration
    if (player.spawnProtection && now > player.spawnProtectionEndTime) {
      player.spawnProtection = false;
    }

    // Invisibility expiration (during upgrade choice)
    if (player.invisible && now > player.invisibleEndTime) {
      player.invisible = false;
    }

    // Weapon timer expiration (return to pistol)
    if (player.weaponTimer && now > player.weaponTimer) {
      player.weapon = 'pistol';
      player.weaponTimer = null;
    }

    // Speed boost expiration
    if (player.speedBoost && now > player.speedBoost) {
      player.speedBoost = null;
    }

    // Combo timeout reset
    const COMBO_TIMEOUT = 5000; // 5 seconds
    if (player.combo > 0 && player.comboTimer > 0 && now - player.comboTimer > COMBO_TIMEOUT) {
      player.combo = 0;
      player.comboTimer = 0;
      io.to(playerId).emit('comboReset');
    }

    // Health regeneration
    if (player.regeneration > 0) {
      if (!player.lastRegenTick || now - player.lastRegenTick >= 1000) {
        player.health = Math.min(player.health + player.regeneration, player.maxHealth);
        player.lastRegenTick = now;
      }
    }

    // Auto-turrets
    updateAutoTurrets(player, playerId, now, collisionManager, entityManager);

    // Tesla Coil special weapon
    updateTeslaCoil(player, playerId, now, gameState, collisionManager, entityManager);
  }
}

/**
 * Update auto-turrets for a player
 * @param {Object} player - Player object
 * @param {String} playerId - Player ID
 * @param {Number} now - Current timestamp
 * @param {Object} collisionManager - Collision manager
 * @param {Object} entityManager - Entity manager
 */
function updateAutoTurrets(player, playerId, now, collisionManager, entityManager) {
  if (player.autoTurrets > 0 && player.hasNickname && !player.spawnProtection) {
    const autoFireCooldown = 600 / player.autoTurrets;

    if (now - player.lastAutoShot >= autoFireCooldown) {
      const autoTurretRange = 500;
      const closestZombie = collisionManager.findClosestZombie(player.x, player.y, autoTurretRange);

      if (closestZombie) {
        const angle = Math.atan2(closestZombie.y - player.y, closestZombie.x - player.x);

        const baseDamage = CONFIG.BULLET_DAMAGE * 0.6;
        const damage = baseDamage * (player.damageMultiplier || 1);

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
    }
  }
}

/**
 * Update Tesla Coil weapon effects
 * @param {Object} player - Player object
 * @param {String} playerId - Player ID
 * @param {Number} now - Current timestamp
 * @param {Object} gameState - Game state
 * @param {Object} collisionManager - Collision manager
 * @param {Object} entityManager - Entity manager
 */
function updateTeslaCoil(player, playerId, now, gameState, collisionManager, entityManager) {
  if (player.weapon === 'teslaCoil' && player.hasNickname && !player.spawnProtection) {
    if (!player.lastTeslaShot) {
      player.lastTeslaShot = 0;
    }

    const teslaWeapon = ConfigManager.WEAPONS.teslaCoil;
    const teslaCooldown = teslaWeapon.fireRate * (player.fireRateMultiplier || 1);

    if (now - player.lastTeslaShot >= teslaCooldown) {
      const zombiesInRange = collisionManager.findZombiesInRadius(player.x, player.y, teslaWeapon.teslaRange);
      const targets = zombiesInRange.slice(0, teslaWeapon.teslaMaxTargets);

      if (targets.length > 0) {
        const damage = teslaWeapon.damage * (player.damageMultiplier || 1);

        for (const zombie of targets) {
          zombie.health -= damage;

          // Life steal
          if (player.lifeSteal > 0) {
            const lifeStolen = damage * player.lifeSteal;
            player.health = Math.min(player.health + lifeStolen, player.maxHealth);
          }

          // Create electric arc visual
          const steps = 5;
          for (let i = 0; i <= steps; i++) {
            const ratio = i / steps;
            const arcX = player.x + (zombie.x - player.x) * ratio;
            const arcY = player.y + (zombie.y - player.y) * ratio;
            createParticles(arcX, arcY, teslaWeapon.color, 1, entityManager);
          }

          createParticles(zombie.x, zombie.y, teslaWeapon.color, 3, entityManager);

          // Check zombie death
          if (zombie.health <= 0) {
            createParticles(zombie.x, zombie.y, zombie.color, 15, entityManager);

            const goldBonus = zombie.goldDrop;
            const xpBonus = zombie.xpDrop;

            if (player) {
              player.combo = (player.combo || 0) + 1;
              player.comboTimer = now;
              player.kills = (player.kills || 0) + 1;
              player.zombiesKilled = (player.zombiesKilled || 0) + 1;
            }

            createLoot(zombie.x, zombie.y, goldBonus, xpBonus, gameState);
            delete gameState.zombies[zombie.id];
            gameState.zombiesKilledThisWave++;
          }
        }

        player.lastTeslaShot = now;
      }
    }
  }
}

module.exports = {
  updatePlayers,
  updateAutoTurrets,
  updateTeslaCoil
};
