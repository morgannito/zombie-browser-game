/**
 * @fileoverview Boss Cryos abilities (wave 140)
 */

const { createParticles } = require('../../../../game/lootFunctions');
const { distance } = require('../../../../game/utilityFunctions');
const { emitAOI } = require('./shared');

function updateBossCryos(
  zombie,
  zombieId,
  now,
  io,
  zombieManager,
  perfIntegration,
  entityManager,
  gameState
) {
  if (zombie.type !== 'bossCryos') {
    return;
  }

  const healthPercent = zombie.health / zombie.maxHealth;

  // Ice spikes
  if (!zombie.lastSpikes || now - zombie.lastSpikes >= 6000) {
    zombie.lastSpikes = now;

    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const distance = 200;
      const spikeX = zombie.x + Math.cos(angle) * distance;
      const spikeY = zombie.y + Math.sin(angle) * distance;

      if (gameState.hazardManager) {
        gameState.hazardManager.createHazard('iceSpike', spikeX, spikeY, 50, 50, 3000);
      }

      createParticles(spikeX, spikeY, '#00bfff', 20, entityManager);
    }

    emitAOI(io, 'bossIceSpikes', { bossId: zombieId }, zombie.x, zombie.y, gameState);
  }

  // Ice clones (Phase 2+)
  if (healthPercent <= 0.66 && (!zombie.lastIceClones || now - zombie.lastIceClones >= 20000)) {
    zombie.lastIceClones = now;

    for (let i = 0; i < 3; i++) {
      let zombieCount = 0;
      for (const _ in gameState.zombies) {
 zombieCount++;
}
      if (perfIntegration.canSpawnZombie(zombieCount)) {
        const angle = (Math.PI * 2 * i) / 3;
        const dist = 120;
        const x = zombie.x + Math.cos(angle) * dist;
        const y = zombie.y + Math.sin(angle) * dist;

        zombieManager.spawnSpecificZombie('glacier', x, y);
      }
    }

    createParticles(zombie.x, zombie.y, '#00bfff', 60, entityManager);
    emitAOI(io, 'bossIceClones', { bossId: zombieId }, zombie.x, zombie.y, gameState);
  }

  // Freeze aura (passive Phase 3+)
  if (healthPercent <= 0.33) {
    if (!zombie.lastFreezeAura || now - zombie.lastFreezeAura >= 2000) {
      zombie.lastFreezeAura = now;

      for (const playerId in gameState.players) {
        const player = gameState.players[playerId];
        if (!player.alive || player.spawnProtection || player.invisible) {
          continue;
        }

        const dist = distance(zombie.x, zombie.y, player.x, player.y);
        if (dist < 150) {
          player.slowedUntil = now + 2000;
          player.slowAmount = 0.5;
          createParticles(player.x, player.y, '#aaddff', 4, entityManager);
        }
      }
    }
  }

  // Blizzard (Phase 3)
  if (healthPercent <= 0.33 && (!zombie.lastBlizzard || now - zombie.lastBlizzard >= 10000)) {
    zombie.lastBlizzard = now;
    zombie.blizzardActive = true;
    zombie.blizzardEnd = now + 8000;

    emitAOI(io, 'bossBlizzard', { bossId: zombieId, duration: 8000 }, zombie.x, zombie.y, gameState);
  }

  // Apply blizzard damage
  if (zombie.blizzardActive && now < zombie.blizzardEnd) {
    if (!zombie.lastBlizzardTick || now - zombie.lastBlizzardTick >= 500) {
      zombie.lastBlizzardTick = now;

      for (const playerId in gameState.players) {
        const player = gameState.players[playerId];
        if (!player.alive) {
          continue;
        }

        player.health -= 15 / 2;
        createParticles(player.x, player.y, '#aaddff', 3, entityManager);

        if (player.health <= 0) {
          player.alive = false;
          player.deaths++;
        }
      }
    }
  } else if (zombie.blizzardActive) {
    zombie.blizzardActive = false;
  }
}

module.exports = { updateBossCryos };
