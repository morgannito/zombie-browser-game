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

  const healthPercent = zombie.health / zombie.maxHealth;

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

      // Create meteor using HazardManager
      if (gameState.hazardManager) {
        gameState.hazardManager.createHazard('meteor', target.x, target.y, 100, 60, 2000);
      }

      createParticles(target.x, target.y, '#ff0000', 40, entityManager);

      io.emit('bossMeteor', {
        bossId: zombieId,
        x: target.x,
        y: target.y
      });
    }
  }

  // Fire minions summon (Phase 2+)
  if (healthPercent <= 0.66 && (!zombie.lastFireMinions || now - zombie.lastFireMinions >= 15000)) {
    zombie.lastFireMinions = now;

    // Spawn 5 fire minions (inferno zombies) around boss
    for (let i = 0; i < 5; i++) {
      const zombieCount = Object.keys(gameState.zombies).length;
      if (perfIntegration.canSpawnZombie(zombieCount)) {
        const angle = (Math.PI * 2 * i) / 5;
        const dist = 150;
        const x = zombie.x + Math.cos(angle) * dist;
        const y = zombie.y + Math.sin(angle) * dist;

        zombieManager.spawnSpecificZombie('inferno', x, y);
      }
    }

    createParticles(zombie.x, zombie.y, '#ff4500', 50, entityManager);
    io.emit('bossFireMinions', { bossId: zombieId });
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

      // Create ice spike using HazardManager
      if (gameState.hazardManager) {
        gameState.hazardManager.createHazard('iceSpike', spikeX, spikeY, 50, 50, 3000);
      }

      createParticles(spikeX, spikeY, '#00bfff', 20, entityManager);
    }

    io.emit('bossIceSpikes', { bossId: zombieId });
  }

  // Ice clones (Phase 2+)
  if (healthPercent <= 0.66 && (!zombie.lastIceClones || now - zombie.lastIceClones >= 20000)) {
    zombie.lastIceClones = now;

    // Spawn 3 ice clones (glacier zombies) around boss
    for (let i = 0; i < 3; i++) {
      const zombieCount = Object.keys(gameState.zombies).length;
      if (perfIntegration.canSpawnZombie(zombieCount)) {
        const angle = (Math.PI * 2 * i) / 3;
        const dist = 120;
        const x = zombie.x + Math.cos(angle) * dist;
        const y = zombie.y + Math.sin(angle) * dist;

        zombieManager.spawnSpecificZombie('glacier', x, y);
      }
    }

    createParticles(zombie.x, zombie.y, '#00bfff', 60, entityManager);
    io.emit('bossIceClones', { bossId: zombieId });
  }

  // Freeze aura (passive Phase 3+)
  if (healthPercent <= 0.33) {
    if (!zombie.lastFreezeAura || now - zombie.lastFreezeAura >= 2000) {
      zombie.lastFreezeAura = now;

      for (let playerId in gameState.players) {
        const player = gameState.players[playerId];
        if (!player.alive || player.spawnProtection || player.invisible) continue;

        const dist = distance(zombie.x, zombie.y, player.x, player.y);
        if (dist < 150) { // Freeze aura radius
          player.slowedUntil = now + 2000;
          player.slowAmount = 0.5; // 50% slow
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

      // Create lightning using HazardManager
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

      for (let playerId in gameState.players) {
        const player = gameState.players[playerId];
        if (!player.alive || player.spawnProtection || player.invisible) continue;

        // Global hurricane slow (30%)
        player.slowedUntil = now + 1500;
        player.slowAmount = 0.3;
        createParticles(player.x, player.y, '#00ced1', 3, entityManager);
      }
    }

    // Visual hurricane effect
    if (!zombie.lastHurricaneVisual || now - zombie.lastHurricaneVisual >= 3000) {
      zombie.lastHurricaneVisual = now;
      createParticles(zombie.x, zombie.y, '#00ced1', 40, entityManager);
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

    // Create void rift using HazardManager (type: voidRift)
    if (gameState.hazardManager) {
      gameState.hazardManager.createHazard('voidRift', zombie.x, zombie.y, 120, 45, 12000);
    }

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

    // Spawn 4 voidwalkers + 4 shadowfiends
    const voidTypes = ['voidwalker', 'shadowfiend'];
    for (let i = 0; i < 8; i++) {
      const zombieCount = Object.keys(gameState.zombies).length;
      if (perfIntegration.canSpawnZombie(zombieCount)) {
        const angle = (Math.PI * 2 * i) / 8;
        const dist = 180;
        const x = zombie.x + Math.cos(angle) * dist;
        const y = zombie.y + Math.sin(angle) * dist;

        const voidType = voidTypes[i % 2]; // Alternance voidwalker/shadowfiend
        zombieManager.spawnSpecificZombie(voidType, x, y);
      }
    }

    createParticles(zombie.x, zombie.y, '#9400d3', 40, entityManager);
    io.emit('bossVoidMinions', { bossId: zombieId });
  }

  // Reality warp (Phase 3+) - Inversion contrôles temporaire
  if (healthPercent <= 0.33 && (!zombie.lastRealityWarp || now - zombie.lastRealityWarp >= 25000)) {
    zombie.lastRealityWarp = now;

    for (let playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.alive) continue;

      player.controlsInverted = true;
      player.controlsInvertedUntil = now + 5000; // 5 seconds inversion

      createParticles(player.x, player.y, '#9400d3', 15, entityManager);
    }

    io.emit('bossRealityWarp', {
      bossId: zombieId,
      duration: 5000
    });
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

      // Create meteor using HazardManager
      if (gameState.hazardManager) {
        gameState.hazardManager.createHazard('meteor', meteorX, meteorY, 100, 80, 2000);
      }

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
