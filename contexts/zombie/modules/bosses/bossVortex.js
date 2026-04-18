/**
 * @fileoverview Boss Vortex abilities (wave 160)
 */

const { createParticles } = require('../../../../game/lootFunctions');
const { distance } = require('../../../../game/utilityFunctions');

function updateBossVortex(zombie, zombieId, now, io, entityManager, gameState) {
  if (zombie.type !== 'bossVortex') {
    return;
  }

  const healthPercent = zombie.health / zombie.maxHealth;

  // Tornado pull
  if (!zombie.lastTornado || now - zombie.lastTornado >= 7000) {
    zombie.lastTornado = now;

    for (const playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.alive) {
        continue;
      }

      const dist = distance(zombie.x, zombie.y, player.x, player.y);
      if (dist < 180) {
        const angle = Math.atan2(zombie.y - player.y, zombie.x - player.x);
        player.x += Math.cos(angle) * 3;
        player.y += Math.sin(angle) * 3;

        player.health -= 20;
        createParticles(player.x, player.y, '#00ced1', 8, entityManager);

        if (player.health <= 0) {
          player.alive = false;
          player.deaths++;
        }
      }
    }

    createParticles(zombie.x, zombie.y, '#00ced1', 30, entityManager);
  }

  // Lightning strikes (Phase 2+)
  if (healthPercent <= 0.66 && (!zombie.lastLightning || now - zombie.lastLightning >= 4000)) {
    zombie.lastLightning = now;

    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 400;
      const strikeX = zombie.x + Math.cos(angle) * dist;
      const strikeY = zombie.y + Math.sin(angle) * dist;

      if (gameState.hazardManager) {
        gameState.hazardManager.createHazard('lightning', strikeX, strikeY, 60, 40, 1000);
      }

      createParticles(strikeX, strikeY, '#ffff00', 25, entityManager);
    }
  }

  // Hurricane (Phase 3+) - Global slow effect
  if (healthPercent <= 0.33) {
    if (!zombie.lastHurricane || now - zombie.lastHurricane >= 1500) {
      zombie.lastHurricane = now;

      for (const playerId in gameState.players) {
        const player = gameState.players[playerId];
        if (!player.alive || player.spawnProtection || player.invisible) {
          continue;
        }

        player.slowedUntil = now + 1500;
        player.slowAmount = 0.3;
        createParticles(player.x, player.y, '#00ced1', 3, entityManager);
      }
    }

    if (!zombie.lastHurricaneVisual || now - zombie.lastHurricaneVisual >= 3000) {
      zombie.lastHurricaneVisual = now;
      createParticles(zombie.x, zombie.y, '#00ced1', 40, entityManager);
    }
  }
}

module.exports = { updateBossVortex };
