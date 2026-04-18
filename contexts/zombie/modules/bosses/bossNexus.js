/**
 * @fileoverview Boss Nexus abilities (wave 180)
 */

const { createParticles } = require('../../../../game/lootFunctions');
const { emitAOI, moveZombieSafely } = require('./shared');

function updateBossNexus(
  zombie,
  zombieId,
  now,
  io,
  zombieManager,
  perfIntegration,
  entityManager,
  gameState,
  collisionManager
) {
  if (zombie.type !== 'bossNexus') {
    return;
  }

  const healthPercent = zombie.health / zombie.maxHealth;

  // Void rifts
  if (!zombie.lastRift || now - zombie.lastRift >= 9000) {
    zombie.lastRift = now;

    if (gameState.hazardManager) {
      gameState.hazardManager.createHazard('voidRift', zombie.x, zombie.y, 120, 45, 12000);
    }

    createParticles(zombie.x, zombie.y, '#9400d3', 50, entityManager);
  }

  // Teleportation
  if (!zombie.lastTeleport || now - zombie.lastTeleport >= 6000) {
    zombie.lastTeleport = now;

    const closestPlayer = collisionManager?.findClosestPlayer(zombie.x, zombie.y, Infinity, {
      ignoreSpawnProtection: true,
      ignoreInvisible: false
    });

    if (closestPlayer) {
      const angle = Math.atan2(closestPlayer.y - zombie.y, closestPlayer.x - zombie.x);
      const teleportDistance = 250;
      const newX = closestPlayer.x - Math.cos(angle) * teleportDistance;
      const newY = closestPlayer.y - Math.sin(angle) * teleportDistance;

      const oldX = zombie.x;
      const oldY = zombie.y;
      if (moveZombieSafely(zombie, newX, newY, gameState)) {
        createParticles(oldX, oldY, '#9400d3', 30, entityManager);
        createParticles(zombie.x, zombie.y, '#9400d3', 30, entityManager);
      }
    }
  }

  // Summon void minions (Phase 2+)
  if (healthPercent <= 0.66 && (!zombie.lastSummon || now - zombie.lastSummon >= 18000)) {
    zombie.lastSummon = now;

    const voidTypes = ['voidwalker', 'shadowfiend'];
    for (let i = 0; i < 8; i++) {
      let zombieCount = 0;
      for (const _ in gameState.zombies) {
 zombieCount++;
}
      if (perfIntegration.canSpawnZombie(zombieCount)) {
        const angle = (Math.PI * 2 * i) / 8;
        const dist = 180;
        const x = zombie.x + Math.cos(angle) * dist;
        const y = zombie.y + Math.sin(angle) * dist;

        const voidType = voidTypes[i % 2];
        zombieManager.spawnSpecificZombie(voidType, x, y);
      }
    }

    createParticles(zombie.x, zombie.y, '#9400d3', 40, entityManager);
    emitAOI(io, 'bossVoidMinions', { bossId: zombieId }, zombie.x, zombie.y, gameState);
  }

  // Reality warp (Phase 3+)
  if (healthPercent <= 0.33 && (!zombie.lastRealityWarp || now - zombie.lastRealityWarp >= 25000)) {
    zombie.lastRealityWarp = now;

    for (const playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.alive) {
        continue;
      }

      player.controlsInverted = true;
      player.controlsInvertedUntil = now + 5000;

      createParticles(player.x, player.y, '#9400d3', 15, entityManager);
    }

    emitAOI(io, 'bossRealityWarp', { bossId: zombieId, duration: 5000 }, zombie.x, zombie.y, gameState);
  }
}

module.exports = { updateBossNexus };
