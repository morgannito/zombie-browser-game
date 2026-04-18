/**
 * @fileoverview Boss Infernal abilities (wave 115)
 */

const ConfigManager = require('../../../../lib/server/ConfigManager');
const { createParticles } = require('../../../../game/lootFunctions');
const { distance } = require('../../../../game/utilityFunctions');
const { emitAOI } = require('./shared');

const { CONFIG, ZOMBIE_TYPES } = ConfigManager;

function updateBossInfernal(
  zombie,
  zombieId,
  now,
  io,
  zombieManager,
  perfIntegration,
  entityManager,
  gameState
) {
  if (zombie.type !== 'bossInfernal') {
    return;
  }

  if (!ZOMBIE_TYPES.bossInfernal) {
    return;
  }

  const healthPercent = zombie.health / zombie.maxHealth;

  // Fire aura passive damage
  if (!zombie.lastAuraDamage || now - zombie.lastAuraDamage >= 1000) {
    zombie.lastAuraDamage = now;

    for (const playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.alive || player.spawnProtection || player.invisible) {
        continue;
      }

      const dist = distance(zombie.x, zombie.y, player.x, player.y);
      if (dist < 120) {
        // Fire aura radius
        player.health -= 8;
        createParticles(player.x, player.y, '#ff4500', 6, entityManager);

        if (player.health <= 0) {
          player.alive = false;
          player.deaths++;
        }
      }
    }

    createParticles(zombie.x, zombie.y, '#ff4500', 10, entityManager);
  }

  // Meteor strike
  if (!zombie.lastMeteor || now - zombie.lastMeteor >= 8000) {
    zombie.lastMeteor = now;

    // Target random player (avoid Object.values/filter allocations)
    let aliveCount = 0;
    for (const id in gameState.players) {
      if (gameState.players[id].alive) {
        aliveCount++;
      }
    }
    if (aliveCount > 0) {
      let pick = Math.floor(Math.random() * aliveCount);
      let target = null;
      for (const id in gameState.players) {
        if (gameState.players[id].alive && pick-- === 0) {
          target = gameState.players[id];
          break;
        }
      }
      if (!target) {
        return;
      }

      if (gameState.hazardManager) {
        gameState.hazardManager.createHazard('meteor', target.x, target.y, 100, 60, 2000);
      }

      createParticles(target.x, target.y, '#ff0000', 40, entityManager);
      emitAOI(io, 'bossMeteor', { bossId: zombieId, x: target.x, y: target.y }, target.x, target.y, gameState);
    }
  }

  // Fire minions summon (Phase 2+)
  if (healthPercent <= 0.66 && (!zombie.lastFireMinions || now - zombie.lastFireMinions >= 15000)) {
    zombie.lastFireMinions = now;

    for (let i = 0; i < 5; i++) {
      let zombieCount = 0;
      for (const _ in gameState.zombies) {
 zombieCount++;
}
      if (perfIntegration.canSpawnZombie(zombieCount)) {
        const angle = (Math.PI * 2 * i) / 5;
        const dist = 150;
        const x = zombie.x + Math.cos(angle) * dist;
        const y = zombie.y + Math.sin(angle) * dist;

        zombieManager.spawnSpecificZombie('inferno', x, y);
      }
    }

    createParticles(zombie.x, zombie.y, '#ff4500', 50, entityManager);
    emitAOI(io, 'bossFireMinions', { bossId: zombieId }, zombie.x, zombie.y, gameState);
  }
}

module.exports = { updateBossInfernal };
