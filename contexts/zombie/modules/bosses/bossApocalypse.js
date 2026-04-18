/**
 * @fileoverview Boss Apocalypse abilities (wave 200 - Final Boss)
 */

const { createParticles } = require('../../../../game/lootFunctions');
const { distance } = require('../../../../game/utilityFunctions');
const { emitAOI } = require('./shared');

function updateBossApocalypse(
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
  if (zombie.type !== 'bossApocalypse') {
    return;
  }

  const healthPercent = zombie.health / zombie.maxHealth;

  // Meteor shower
  if (!zombie.lastMeteorShower || now - zombie.lastMeteorShower >= 6000) {
    zombie.lastMeteorShower = now;

    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 500;
      const meteorX = zombie.x + Math.cos(angle) * dist;
      const meteorY = zombie.y + Math.sin(angle) * dist;

      if (gameState.hazardManager) {
        gameState.hazardManager.createHazard('meteor', meteorX, meteorY, 100, 80, 2000);
      }

      createParticles(meteorX, meteorY, '#ff0000', 30, entityManager);
    }
  }

  // Ice prison (Phase 2+)
  if (healthPercent <= 0.75 && (!zombie.lastIcePrison || now - zombie.lastIcePrison >= 15000)) {
    zombie.lastIcePrison = now;

    for (const playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.alive) {
        continue;
      }

      player.frozen = true;
      player.frozenUntil = now + 3000;

      createParticles(player.x, player.y, '#00ffff', 20, entityManager);
    }

    emitAOI(io, 'bossIcePrison', { bossId: zombieId }, zombie.x, zombie.y, gameState);
  }

  // Chain lightning (Phase 3+)
  if (
    healthPercent <= 0.5 &&
    (!zombie.lastChainLightning || now - zombie.lastChainLightning >= 8000)
  ) {
    zombie.lastChainLightning = now;

    const closestPlayer = collisionManager?.findClosestPlayer(zombie.x, zombie.y, 600, {
      ignoreSpawnProtection: true,
      ignoreInvisible: false
    });

    if (closestPlayer) {
      let currentTarget = closestPlayer;
      let jumps = 0;
      const maxJumps = 8;
      const hitTargets = new Set([closestPlayer]);

      while (jumps < maxJumps) {
        currentTarget.health -= 50 * Math.pow(0.7, jumps);
        createParticles(currentTarget.x, currentTarget.y, '#ffff00', 15, entityManager);

        let nextTarget = null;
        let minDist = Infinity;

        for (const playerId in gameState.players) {
          const player = gameState.players[playerId];
          if (!player.alive || hitTargets.has(player)) {
            continue;
          }

          const dist = distance(currentTarget.x, currentTarget.y, player.x, player.y);
          if (dist < 200 && dist < minDist) {
            minDist = dist;
            nextTarget = player;
          }
        }

        if (!nextTarget) {
          break;
        }

        hitTargets.add(nextTarget);
        currentTarget = nextTarget;
        jumps++;
      }
    }
  }

  // Apocalypse ultimate (Phase 4)
  if (healthPercent <= 0.25 && (!zombie.lastApocalypse || now - zombie.lastApocalypse >= 30000)) {
    zombie.lastApocalypse = now;

    for (const playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.alive) {
        continue;
      }

      const dist = distance(zombie.x, zombie.y, player.x, player.y);
      if (dist < 400) {
        player.health -= 200;
        createParticles(player.x, player.y, '#8b0000', 30, entityManager);

        if (player.health <= 0) {
          player.alive = false;
          player.deaths++;
        }
      }
    }

    createParticles(zombie.x, zombie.y, '#8b0000', 100, entityManager);
    emitAOI(io, 'bossApocalypse', { bossId: zombieId, message: 'APOCALYPSE FINALE!' }, zombie.x, zombie.y, gameState);
  }
}

module.exports = { updateBossApocalypse };
