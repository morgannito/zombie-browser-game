/**
 * @fileoverview Boss Abilities System
 * @description Mécaniques spéciales pour nouveaux boss (Infernus, Cryos, Vortex, Nexus, Apocalypse)
 */

const { createParticles } = require('../../lootFunctions');
const { distance } = require('../../utilityFunctions');

/**
 * Update Boss Infernal (wave 115)
 */
function updateBossInfernal(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState) {
  if (zombie.type !== 'bossInfernal') return;

  const bossType = gameState.ZOMBIE_TYPES?.bossInfernal;
  if (!bossType) return;

  // Fire aura passive damage
  if (!zombie.lastAuraDamage || now - zombie.lastAuraDamage >= 1000) {
    zombie.lastAuraDamage = now;

    for (let playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.alive || player.spawnProtection || player.invisible) continue;

      const dist = distance(zombie.x, zombie.y, player.x, player.y);
      if (dist < 120) { // Fire aura radius
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

    // Target random player
    const players = Object.values(gameState.players).filter(p => p.alive);
    if (players.length > 0) {
      const target = players[Math.floor(Math.random() * players.length)];

      // Create meteor at target location
      gameState.hazards = gameState.hazards || [];
      gameState.hazards.push({
        type: 'meteor',
        x: target.x,
        y: target.y,
        radius: 100,
        damage: 60,
        createdAt: now,
        duration: 2000
      });

      createParticles(target.x, target.y, '#ff0000', 40, entityManager);

      io.emit('bossMeteor', {
        bossId: zombieId,
        x: target.x,
        y: target.y
      });
    }
  }
}

/**
 * Update Boss Cryos (wave 140)
 */
function updateBossCryos(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState) {
  if (zombie.type !== 'bossCryos') return;

  const healthPercent = zombie.health / zombie.maxHealth;

  // Ice spikes
  if (!zombie.lastSpikes || now - zombie.lastSpikes >= 6000) {
    zombie.lastSpikes = now;

    // 8 spikes en cercle
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const distance = 200;
      const spikeX = zombie.x + Math.cos(angle) * distance;
      const spikeY = zombie.y + Math.sin(angle) * distance;

      gameState.hazards = gameState.hazards || [];
      gameState.hazards.push({
        type: 'iceSpike',
        x: spikeX,
        y: spikeY,
        radius: 50,
        damage: 50,
        createdAt: now,
        duration: 3000
      });

      createParticles(spikeX, spikeY, '#00bfff', 20, entityManager);
    }

    io.emit('bossIceSpikes', { bossId: zombieId });
  }

  // Blizzard (Phase 3)
  if (healthPercent <= 0.33 && (!zombie.lastBlizzard || now - zombie.lastBlizzard >= 10000)) {
    zombie.lastBlizzard = now;
    zombie.blizzardActive = true;
    zombie.blizzardEnd = now + 8000;

    io.emit('bossBlizzard', {
      bossId: zombieId,
      duration: 8000
    });
  }

  // Apply blizzard damage
  if (zombie.blizzardActive && now < zombie.blizzardEnd) {
    if (!zombie.lastBlizzardTick || now - zombie.lastBlizzardTick >= 500) {
      zombie.lastBlizzardTick = now;

      for (let playerId in gameState.players) {
        const player = gameState.players[playerId];
        if (!player.alive) continue;

        player.health -= 15 / 2; // 15 damage per second
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

/**
 * Update Boss Vortex (wave 160)
 */
function updateBossVortex(zombie, zombieId, now, io, entityManager, gameState) {
  if (zombie.type !== 'bossVortex') return;

  const healthPercent = zombie.health / zombie.maxHealth;

  // Tornado pull
  if (!zombie.lastTornado || now - zombie.lastTornado >= 7000) {
    zombie.lastTornado = now;

    for (let playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.alive) continue;

      const dist = distance(zombie.x, zombie.y, player.x, player.y);
      if (dist < 180) {
        // Pull player toward boss
        const angle = Math.atan2(zombie.y - player.y, zombie.x - player.x);
        player.x += Math.cos(angle) * 3; // Pull force
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

    // 6 lightning strikes
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 400;
      const strikeX = zombie.x + Math.cos(angle) * dist;
      const strikeY = zombie.y + Math.sin(angle) * dist;

      gameState.hazards = gameState.hazards || [];
      gameState.hazards.push({
        type: 'lightning',
        x: strikeX,
        y: strikeY,
        radius: 60,
        damage: 40,
        createdAt: now,
        duration: 1000
      });

      createParticles(strikeX, strikeY, '#ffff00', 25, entityManager);
    }
  }
}

/**
 * Update Boss Nexus (wave 180)
 */
function updateBossNexus(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState, collisionManager) {
  if (zombie.type !== 'bossNexus') return;

  const healthPercent = zombie.health / zombie.maxHealth;

  // Void rifts
  if (!zombie.lastRift || now - zombie.lastRift >= 9000) {
    zombie.lastRift = now;

    gameState.toxicPools = gameState.toxicPools || [];
    gameState.toxicPools.push({
      id: `rift_${now}_${Math.random()}`,
      x: zombie.x,
      y: zombie.y,
      radius: 120,
      damage: 45,
      createdAt: now,
      duration: 12000
    });

    createParticles(zombie.x, zombie.y, '#9400d3', 50, entityManager);
  }

  // Teleportation
  if (!zombie.lastTeleport || now - zombie.lastTeleport >= 6000) {
    zombie.lastTeleport = now;

    const closestPlayer = collisionManager?.findClosestPlayer(
      zombie.x, zombie.y, Infinity,
      { ignoreSpawnProtection: true, ignoreInvisible: false }
    );

    if (closestPlayer) {
      const angle = Math.atan2(closestPlayer.y - zombie.y, closestPlayer.x - zombie.x);
      const teleportDistance = 250;
      const newX = closestPlayer.x - Math.cos(angle) * teleportDistance;
      const newY = closestPlayer.y - Math.sin(angle) * teleportDistance;

      const roomManager = gameState.roomManager;
      if (roomManager && !roomManager.checkWallCollision(newX, newY, zombie.size)) {
        createParticles(zombie.x, zombie.y, '#9400d3', 30, entityManager);
        zombie.x = newX;
        zombie.y = newY;
        createParticles(zombie.x, zombie.y, '#9400d3', 30, entityManager);
      }
    }
  }

  // Summon void minions (Phase 2+)
  if (healthPercent <= 0.66 && (!zombie.lastSummon || now - zombie.lastSummon >= 18000)) {
    zombie.lastSummon = now;

    for (let i = 0; i < 8; i++) {
      const zombieCount = Object.keys(gameState.zombies).length;
      if (perfIntegration.canSpawnZombie(zombieCount)) {
        zombieManager.spawnSingleZombie();
      }
    }

    createParticles(zombie.x, zombie.y, '#9400d3', 40, entityManager);
  }
}

/**
 * Update Boss Apocalypse (wave 200 - Final Boss)
 */
function updateBossApocalypse(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState, collisionManager) {
  if (zombie.type !== 'bossApocalypse') return;

  const healthPercent = zombie.health / zombie.maxHealth;

  // Meteor shower
  if (!zombie.lastMeteorShower || now - zombie.lastMeteorShower >= 6000) {
    zombie.lastMeteorShower = now;

    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 500;
      const meteorX = zombie.x + Math.cos(angle) * dist;
      const meteorY = zombie.y + Math.sin(angle) * dist;

      gameState.hazards = gameState.hazards || [];
      gameState.hazards.push({
        type: 'meteor',
        x: meteorX,
        y: meteorY,
        radius: 100,
        damage: 80,
        createdAt: now,
        duration: 2000
      });

      createParticles(meteorX, meteorY, '#ff0000', 30, entityManager);
    }
  }

  // Ice prison (Phase 2+)
  if (healthPercent <= 0.75 && (!zombie.lastIcePrison || now - zombie.lastIcePrison >= 15000)) {
    zombie.lastIcePrison = now;

    // Freeze all players
    for (let playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.alive) continue;

      player.frozen = true;
      player.frozenUntil = now + 3000;

      createParticles(player.x, player.y, '#00ffff', 20, entityManager);
    }

    io.emit('bossIcePrison', { bossId: zombieId });
  }

  // Chain lightning (Phase 3+)
  if (healthPercent <= 0.50 && (!zombie.lastChainLightning || now - zombie.lastChainLightning >= 8000)) {
    zombie.lastChainLightning = now;

    // Find closest player
    const closestPlayer = collisionManager?.findClosestPlayer(
      zombie.x, zombie.y, 600,
      { ignoreSpawnProtection: true, ignoreInvisible: false }
    );

    if (closestPlayer) {
      // Chain lightning logic (similar to chainLightning weapon)
      let currentTarget = closestPlayer;
      let jumps = 0;
      const maxJumps = 8;
      const hitTargets = new Set([closestPlayer]);

      while (jumps < maxJumps) {
        // Damage current target
        currentTarget.health -= 50 * Math.pow(0.7, jumps);

        createParticles(currentTarget.x, currentTarget.y, '#ffff00', 15, entityManager);

        // Find next target
        let nextTarget = null;
        let minDist = Infinity;

        for (let playerId in gameState.players) {
          const player = gameState.players[playerId];
          if (!player.alive || hitTargets.has(player)) continue;

          const dist = distance(currentTarget.x, currentTarget.y, player.x, player.y);
          if (dist < 200 && dist < minDist) {
            minDist = dist;
            nextTarget = player;
          }
        }

        if (!nextTarget) break;

        hitTargets.add(nextTarget);
        currentTarget = nextTarget;
        jumps++;
      }
    }
  }

  // Apocalypse ultimate (Phase 4)
  if (healthPercent <= 0.25 && (!zombie.lastApocalypse || now - zombie.lastApocalypse >= 30000)) {
    zombie.lastApocalypse = now;

    // Massive AOE damage
    for (let playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.alive) continue;

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

    io.emit('bossApocalypse', {
      bossId: zombieId,
      message: 'APOCALYPSE FINALE!'
    });
  }
}

module.exports = {
  updateBossInfernal,
  updateBossCryos,
  updateBossVortex,
  updateBossNexus,
  updateBossApocalypse
};
