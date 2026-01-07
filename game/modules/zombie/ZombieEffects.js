/**
 * @fileoverview Zombie status effects
 * @description Handles poison, frozen, slowed effects on zombies
 */

const { createParticles, createLoot } = require('../../lootFunctions');
const ConfigManager = require('../../../lib/server/ConfigManager');
const { distance } = require('../../utilityFunctions');

const { ZOMBIE_TYPES } = ConfigManager;

/**
 * Update poison trails left by poison zombies
 */
function updatePoisonTrails(gameState, now, collisionManager, entityManager) {
  for (let trailId in gameState.poisonTrails) {
    const trail = gameState.poisonTrails[trailId];

    if (now - trail.createdAt > trail.duration) {
      delete gameState.poisonTrails[trailId];
      continue;
    }

    const nearbyPlayers = collisionManager.findPlayersInRadius(
      trail.x, trail.y, trail.radius
    );

    for (let player of nearbyPlayers) {
      if (player.spawnProtection || player.invisible) continue;

      const dist = distance(trail.x, trail.y, player.x, player.y);
      if (dist < trail.radius) {
        if (!player.lastPoisonDamage) player.lastPoisonDamage = {};
        const lastDamage = player.lastPoisonDamage[trailId] || 0;

        if (now - lastDamage >= 500) {
          player.health -= trail.damage;
          player.lastPoisonDamage[trailId] = now;
          createParticles(player.x, player.y, '#00ff00', 3, entityManager);

          if (player.health <= 0) {
            const handlePlayerDeathProgression = require('../../gameLoop').handlePlayerDeathProgression;
            handlePlayerDeathProgression(player, player.id, gameState, now, false);
          }
        }
      }
    }

    if ((now - trail.createdAt) % 200 < 50) {
      createParticles(trail.x, trail.y, '#00ff00', 1, entityManager);
    }
  }
}

/**
 * Update poisoned zombies - apply damage over time
 */
function updatePoisonedZombies(gameState, now, entityManager) {
  for (let zombieId in gameState.zombies) {
    const zombie = gameState.zombies[zombieId];

    if (zombie.poisoned) {
      const poison = zombie.poisoned;

      if (now - poison.startTime > poison.duration) {
        delete zombie.poisoned;
        continue;
      }

      if (now - poison.lastTick >= 500) {
        zombie.health -= poison.damage;
        poison.lastTick = now;

        createParticles(zombie.x, zombie.y, '#00ff00', 3, entityManager);

        if (zombie.health <= 0) {
          killPoisonedZombie(zombie, zombieId, gameState, entityManager);
        }
      }
    }
  }
}

/**
 * Kill zombie from poison damage
 */
function killPoisonedZombie(zombie, zombieId, gameState, entityManager) {
  createParticles(zombie.x, zombie.y, zombie.color, 15, entityManager);
  createLoot(zombie.x, zombie.y, zombie.goldDrop, zombie.xpDrop, gameState);
  delete gameState.zombies[zombieId];
  gameState.zombiesKilledThisWave++;
}

/**
 * Update frozen/slowed zombies - restore speed when effect expires
 */
function updateFrozenSlowedZombies(gameState, now) {
  for (let zombieId in gameState.zombies) {
    const zombie = gameState.zombies[zombieId];

    if (zombie.frozen) {
      if (now - zombie.frozen.startTime > zombie.frozen.duration) {
        zombie.speed = zombie.frozen.originalSpeed;
        delete zombie.frozen;
      }
    }

    if (zombie.slowed && now > zombie.slowed.endTime) {
      zombie.speed = zombie.slowed.originalSpeed;
      delete zombie.slowed;
    }
  }
}

/**
 * Handle splitter zombie death - split into smaller zombies
 */
function handleSplitterDeath(zombie, zombieId, gameState, entityManager) {
  if (zombie.type !== 'splitter' || zombie.isSplit) return;

  const splitterType = ZOMBIE_TYPES.splitter;

  for (let i = 0; i < splitterType.splitCount; i++) {
    spawnSplitterMinion(zombie, i, splitterType, gameState, entityManager);
  }

  applySplitExplosionDamage(zombie, splitterType, gameState, entityManager);
}

/**
 * Spawn single splitter minion
 */
function spawnSplitterMinion(zombie, index, splitterType, gameState, entityManager) {
  const angle = (Math.PI * 2 * index) / splitterType.splitCount;
  const spawnDistance = 60;
  const splitX = zombie.x + Math.cos(angle) * spawnDistance;
  const splitY = zombie.y + Math.sin(angle) * spawnDistance;

  const splitId = gameState.nextZombieId++;
  gameState.zombies[splitId] = {
    id: splitId,
    x: splitX,
    y: splitY,
    size: splitterType.splitSize,
    color: splitterType.splitColor,
    type: 'splitterMinion',
    health: zombie.maxHealth * splitterType.splitHealthPercent,
    maxHealth: zombie.maxHealth * splitterType.splitHealthPercent,
    speed: splitterType.speed * splitterType.splitSpeedMultiplier,
    damage: zombie.damage * splitterType.splitDamageMultiplier,
    goldDrop: Math.floor(splitterType.gold / splitterType.splitCount),
    xpDrop: Math.floor(splitterType.xp / splitterType.splitCount),
    isSplit: true
  };

  createParticles(splitX, splitY, splitterType.splitColor, 15, entityManager);
}

/**
 * Apply explosion damage when splitter splits
 */
function applySplitExplosionDamage(zombie, splitterType, gameState, entityManager) {
  for (let playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (!player.alive || player.spawnProtection || player.invisible) continue;

    const dist = distance(zombie.x, zombie.y, player.x, player.y);
    if (dist < splitterType.splitExplosionRadius) {
      const explosionDamage = 20;
      player.health -= explosionDamage;

      createParticles(player.x, player.y, '#ff8800', 10, entityManager);

      if (player.health <= 0) {
        const handlePlayerDeathProgression = require('../../gameLoop').handlePlayerDeathProgression;
        handlePlayerDeathProgression(player, playerId, gameState, Date.now(), false);
      }
    }
  }
}

module.exports = {
  updatePoisonTrails,
  updatePoisonedZombies,
  updateFrozenSlowedZombies,
  handleSplitterDeath
};
