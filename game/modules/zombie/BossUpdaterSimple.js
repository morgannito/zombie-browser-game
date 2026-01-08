/**
 * @fileoverview Simple boss updaters
 * @description Handles Boss Charnier, Infect, and Colosse
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const { distance } = require('../../utilityFunctions');
const { createParticles } = require('../../lootFunctions');

const { ZOMBIE_TYPES } = ConfigManager;
function updateBossCharnier(zombie, now, zombieManager, perfIntegration, entityManager, gameState) {
  if (zombie.type !== 'bossCharnier') {
    return;
  }

  const bossType = ZOMBIE_TYPES.bossCharnier;
  if (!zombie.lastSpawn || now - zombie.lastSpawn >= bossType.spawnCooldown) {
    zombie.lastSpawn = now;

    // Spawner plusieurs zombies autour du boss (avec limite performance)
    for (let i = 0; i < bossType.spawnCount; i++) {
      const zombieCount = Object.keys(gameState.zombies).length;
      if (perfIntegration.canSpawnZombie(zombieCount) && zombieManager.spawnSingleZombie()) {
        createParticles(zombie.x, zombie.y, bossType.color, 15, entityManager);
      }
    }
  }
}

/**
 * Update Boss Infect
 */
function updateBossInfect(zombie, now, entityManager, gameState) {
  if (zombie.type !== 'bossInfect') {
    return;
  }

  const bossType = ZOMBIE_TYPES.bossInfect;

  // Flaques toxiques
  if (!zombie.lastToxicPool || now - zombie.lastToxicPool >= bossType.toxicPoolCooldown) {
    zombie.lastToxicPool = now;

    // Créer une flaque toxique à la position actuelle
    gameState.toxicPools = gameState.toxicPools || [];
    gameState.toxicPools.push({
      id: `toxic_${now}_${Math.random()}`,
      x: zombie.x,
      y: zombie.y,
      radius: bossType.toxicPoolRadius,
      damage: bossType.toxicPoolDamage,
      createdAt: now,
      duration: bossType.toxicPoolDuration
    });

    createParticles(zombie.x, zombie.y, bossType.color, 25, entityManager);
  }

  // Aura de mort passive - 5 dégâts/sec dans 80px
  if (!zombie.lastAuraDamage || now - zombie.lastAuraDamage >= 1000) {
    zombie.lastAuraDamage = now;

    // Trouver tous les joueurs dans le rayon de l'aura
    for (const playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.alive || player.spawnProtection || player.invisible) {
        continue;
      }

      const dist = distance(zombie.x, zombie.y, player.x, player.y);
      if (dist < bossType.deathAuraRadius) {
        player.health -= bossType.deathAuraDamage;

        // Particules vertes toxiques
        createParticles(player.x, player.y, '#00ff00', 5, entityManager);

        if (player.health <= 0) {
          handlePlayerDeathProgression(player, playerId, gameState, now, true);
        }
      }
    }

    // Effet visuel de l'aura autour du boss
    createParticles(zombie.x, zombie.y, '#00ff00', 12, entityManager);
  }
}

/**
 * Update Boss Colosse
 */
function updateBossColosse(zombie, zombieId, now, io, entityManager) {
  if (zombie.type !== 'bossColosse') {
    return;
  }

  const bossType = ZOMBIE_TYPES.bossColosse;
  const healthPercent = zombie.health / zombie.maxHealth;

  // Bouclier pré-rage (actif tant que NOT enragé)
  if (!zombie.isEnraged) {
    zombie.hasShield = true;
    // Effet visuel de bouclier toutes les secondes
    if (!zombie.lastShieldEffect || now - zombie.lastShieldEffect >= 1000) {
      zombie.lastShieldEffect = now;
      createParticles(zombie.x, zombie.y, bossType.shieldColor, 8, entityManager);
    }
  } else {
    zombie.hasShield = false;
  }

  if (!zombie.isEnraged && healthPercent <= bossType.enrageThreshold) {
    zombie.isEnraged = true;
    zombie.hasShield = false; // Désactiver le bouclier
    zombie.speed *= bossType.enrageSpeedMultiplier;
    zombie.damage = Math.floor(zombie.damage * bossType.enrageDamageMultiplier);

    // Effet visuel d'enrage
    createParticles(zombie.x, zombie.y, '#ff0000', 50, entityManager);
    io.emit('bossEnraged', {
      bossId: zombieId,
      message: 'LE COLOSSE EST ENRAGÉ!'
    });
  }
}


/**
 * Update Boss Roi
 */
function updateBossRoi(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState, collisionManager) {
  if (zombie.type !== 'bossRoi') {
    return;
  }

  const bossType = ZOMBIE_TYPES.bossRoi;
  const healthPercent = zombie.health / zombie.maxHealth;

  // Détection de phase
  let currentPhase = 1;
  if (healthPercent <= bossType.phase3Threshold) {
    currentPhase = 3;
  } else if (healthPercent <= bossType.phase2Threshold) {
    currentPhase = 2;
  }

  // Changement de phase
  if (currentPhase > zombie.phase) {
    zombie.phase = currentPhase;
    io.emit('bossPhaseChange', {
      bossId: zombieId,
      phase: currentPhase,
      message: `ROI ZOMBIE - PHASE ${currentPhase}!`
    });
    createParticles(zombie.x, zombie.y, bossType.color, 60, entityManager);
  }

  // Téléportation (Phase 2+)
  if (zombie.phase >= 2 && (!zombie.lastTeleport || now - zombie.lastTeleport >= bossType.teleportCooldown)) {
    zombie.lastTeleport = now;

    // Trouver le joueur le plus proche
    const closestPlayer = collisionManager.findClosestPlayer(
      zombie.x, zombie.y, Infinity,
      { ignoreSpawnProtection: true, ignoreInvisible: false }
    );

    if (closestPlayer) {
      // Angle vers le joueur
      const angleToPlayer = Math.atan2(closestPlayer.y - zombie.y, closestPlayer.x - zombie.x);

      // Se téléporter à une distance moyenne du joueur (200-400 pixels)
      const teleportDistance = 200 + Math.random() * 200;

      // Nouvelle position près du joueur
      const newX = closestPlayer.x - Math.cos(angleToPlayer) * teleportDistance;
      const newY = closestPlayer.y - Math.sin(angleToPlayer) * teleportDistance;

      const roomManager = gameState.roomManager;
      if (roomManager && !roomManager.checkWallCollision(newX, newY, zombie.size)) {
        createParticles(zombie.x, zombie.y, bossType.color, 30, entityManager);
        zombie.x = newX;
        zombie.y = newY;
        createParticles(zombie.x, zombie.y, bossType.color, 30, entityManager);
      }
    }
  }

  // Invocation (Phase 3) - SEULEMENT le vrai boss, pas les clones
  if (!zombie.isClone && zombie.phase >= 3 && (!zombie.lastSummon || now - zombie.lastSummon >= bossType.summonCooldown)) {
    zombie.lastSummon = now;

    // Invoquer 5 zombies normaux (avec limite performance)
    for (let i = 0; i < 5; i++) {
      const zombieCount = Object.keys(gameState.zombies).length;
      if (perfIntegration.canSpawnZombie(zombieCount)) {
        zombieManager.spawnSingleZombie();
      }
    }
    createParticles(zombie.x, zombie.y, bossType.color, 40, entityManager);
  }

  // Clones (Phase 3) - SEULEMENT le vrai boss, pas les clones (FIX LAG)
  if (!zombie.isClone && zombie.phase >= 3 && (!zombie.lastClone || now - zombie.lastClone >= bossType.cloneCooldown)) {
    zombie.lastClone = now;

    // Créer 2 clones autour du boss
    for (let i = 0; i < bossType.cloneCount; i++) {
      const angle = (Math.PI * 2 * i) / bossType.cloneCount; // Répartition circulaire
      const spawnDistance = 150; // Distance de spawn autour du boss
      const cloneX = zombie.x + Math.cos(angle) * spawnDistance;
      const cloneY = zombie.y + Math.sin(angle) * spawnDistance;

      const cloneId = gameState.nextZombieId++;
      gameState.zombies[cloneId] = {
        id: cloneId,
        x: cloneX,
        y: cloneY,
        size: bossType.size * 0.7, // Clones plus petits (70%)
        color: '#ff69b4', // Rose pour différencier des vrais boss
        type: 'bossRoi',
        health: bossType.cloneHealth,
        maxHealth: bossType.cloneHealth,
        speed: bossType.speed * 1.2, // Clones plus rapides
        damage: bossType.damage * 0.5, // Clones moins puissants
        goldDrop: 100,
        xpDrop: 50,
        isBoss: false, // Les clones ne sont pas des vrais boss
        isClone: true, // Marqueur de clone
        phase: 1,
        createdAt: now,
        despawnTime: now + bossType.cloneDuration // Despawn après 30 secondes
      };

      // Effet visuel de spawn
      createParticles(cloneX, cloneY, '#ff69b4', 30, entityManager);
    }

    // Effet visuel massif au boss principal
    createParticles(zombie.x, zombie.y, bossType.color, 50, entityManager);

    // Notifier les clients de la création des clones
    io.emit('bossClones', {
      bossId: zombieId,
      message: 'LE ROI INVOQUE SES CLONES!'
    });
  }

  // Despawn des clones expirés
  if (zombie.isClone && now >= zombie.despawnTime) {
    createParticles(zombie.x, zombie.y, '#ff69b4', 20, entityManager);
    delete gameState.zombies[zombieId];
  }
}

/**
 * Update Boss Omega
 */
function updateBossOmega(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState, collisionManager) {
  if (zombie.type !== 'bossOmega') {
    return;
  }

  const bossType = ZOMBIE_TYPES.bossOmega;
  const healthPercent = zombie.health / zombie.maxHealth;

  // Détection de phase (4 phases)
  let currentPhase = 1;
  if (healthPercent <= bossType.phase4Threshold) {
    currentPhase = 4;
  } else if (healthPercent <= bossType.phase3Threshold) {
    currentPhase = 3;
  } else if (healthPercent <= bossType.phase2Threshold) {
    currentPhase = 2;
  }

  // Changement de phase
  if (currentPhase > zombie.phase) {
    zombie.phase = currentPhase;
    io.emit('bossPhaseChange', {
      bossId: zombieId,
      phase: currentPhase,
      message: `OMEGA - PHASE ${currentPhase}!`
    });
    createParticles(zombie.x, zombie.y, bossType.color, 80, entityManager);
  }

  // Téléportation (toutes phases)
  if (!zombie.lastTeleport || now - zombie.lastTeleport >= bossType.teleportCooldown) {
    zombie.lastTeleport = now;

    // Trouver le joueur le plus proche
    const closestPlayer = collisionManager.findClosestPlayer(
      zombie.x, zombie.y, Infinity,
      { ignoreSpawnProtection: true, ignoreInvisible: false }
    );

    if (closestPlayer) {
      // Angle vers le joueur
      const angleToPlayer = Math.atan2(closestPlayer.y - zombie.y, closestPlayer.x - zombie.x);

      // Se téléporter à une distance moyenne du joueur (150-350 pixels)
      const teleportDistance = 150 + Math.random() * 200;

      // Nouvelle position près du joueur
      const newX = closestPlayer.x - Math.cos(angleToPlayer) * teleportDistance;
      const newY = closestPlayer.y - Math.sin(angleToPlayer) * teleportDistance;

      const roomManager = gameState.roomManager;
      if (roomManager && !roomManager.checkWallCollision(newX, newY, zombie.size)) {
        createParticles(zombie.x, zombie.y, bossType.color, 40, entityManager);
        zombie.x = newX;
        zombie.y = newY;
        createParticles(zombie.x, zombie.y, bossType.color, 40, entityManager);
      }
    }
  }

  // Flaques toxiques (Phase 2+)
  if (zombie.phase >= 2 && (!zombie.lastToxicPool || now - zombie.lastToxicPool >= bossType.toxicPoolCooldown)) {
    zombie.lastToxicPool = now;
    gameState.toxicPools = gameState.toxicPools || [];
    gameState.toxicPools.push({
      id: `toxic_${now}_${Math.random()}`,
      x: zombie.x,
      y: zombie.y,
      radius: 70,
      damage: 20,
      createdAt: now,
      duration: 10000
    });
    createParticles(zombie.x, zombie.y, '#00ff00', 30, entityManager);
  }

  // Invocation (Phase 3+)
  if (zombie.phase >= 3 && (!zombie.lastSummon || now - zombie.lastSummon >= bossType.summonCooldown)) {
    zombie.lastSummon = now;
    for (let i = 0; i < 8; i++) {
      const zombieCount = Object.keys(gameState.zombies).length;
      if (perfIntegration.canSpawnZombie(zombieCount)) {
        zombieManager.spawnSingleZombie();
      }
    }
    createParticles(zombie.x, zombie.y, bossType.color, 50, entityManager);
  }

  // Laser (Phase 4)
  if (zombie.phase >= 4 && (!zombie.lastLaser || now - zombie.lastLaser >= bossType.laserCooldown)) {
    zombie.lastLaser = now;

    // Trouver le joueur le plus proche pour cibler le laser
    const closestPlayer = collisionManager.findClosestPlayer(
      zombie.x, zombie.y, bossType.laserRange,
      { ignoreSpawnProtection: true, ignoreInvisible: false }
    );

    if (closestPlayer) {
      // Angle vers le joueur
      const angle = Math.atan2(closestPlayer.y - zombie.y, closestPlayer.x - zombie.x);

      // Créer le laser (ligne de particules + dégâts en ligne)
      const laserSteps = 40; // Nombre de points du laser
      for (let i = 0; i < laserSteps; i++) {
        const laserX = zombie.x + Math.cos(angle) * (i * (bossType.laserRange / laserSteps));
        const laserY = zombie.y + Math.sin(angle) * (i * (bossType.laserRange / laserSteps));

        // Créer particules visuelles du laser
        createParticles(laserX, laserY, bossType.laserColor, 2, entityManager);
      }

      // Dégâts aux joueurs touchés par le laser
      for (const playerId in gameState.players) {
        const player = gameState.players[playerId];
        if (!player.alive || player.spawnProtection || player.invisible) {
          continue;
        }

        // Vérifier si le joueur est dans la trajectoire du laser
        const playerAngle = Math.atan2(player.y - zombie.y, player.x - zombie.x);
        const angleDiff = Math.abs(playerAngle - angle);
        const distToZombie = distance(zombie.x, zombie.y, player.x, player.y);

        // Si dans la largeur du laser et dans la portée
        if (angleDiff < (bossType.laserWidth / 2) / distToZombie && distToZombie < bossType.laserRange) {
          player.health -= bossType.laserDamage;

          // Particules d'impact
          createParticles(player.x, player.y, '#ff0000', 15, entityManager);

          if (player.health <= 0) {
            handlePlayerDeathProgression(player, playerId, gameState, now, true);
          }
        }
      }

      // Effet visuel explosif au départ du laser
      createParticles(zombie.x, zombie.y, bossType.laserColor, 30, entityManager);

      // Notifier les clients du laser pour effet visuel
      io.emit('bossLaser', {
        bossId: zombieId,
        x: zombie.x,
        y: zombie.y,
        angle: angle,
        range: bossType.laserRange,
        color: bossType.laserColor
      });
    }
  }
}

/**
 * Move zombie towards player or randomly
 */


module.exports = { updateBossCharnier, updateBossInfect, updateBossColosse, updateBossRoi, updateBossOmega };
