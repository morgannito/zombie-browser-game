/**
 * @fileoverview Main game loop
 * @description Central game loop that updates all game entities
 * - Player updates (power-ups, regeneration, auto-turrets)
 * - Zombie updates (special abilities, movement, AI)
 * - Bullet updates (movement, collisions)
 * - Particle, powerup, and loot updates
 * - Level progression and combo system
 */

const ConfigManager = require('../lib/server/ConfigManager');
const MathUtils = require('../lib/MathUtils');
const { distance, getXPForLevel, generateUpgradeChoices } = require('./utilityFunctions');
const { createLoot, createParticles, createExplosion } = require('./lootFunctions');

const { CONFIG, ZOMBIE_TYPES, POWERUP_TYPES } = ConfigManager;

// Race condition protection
let gameLoopRunning = false;

/**
 * Main game loop function
 * @param {Object} gameState - Game state object
 * @param {Object} io - Socket.IO instance
 * @param {Object} metricsCollector - Metrics collector instance
 * @param {Object} perfIntegration - Performance integration instance
 * @param {Object} collisionManager - Collision manager instance
 * @param {Object} entityManager - Entity manager instance
 * @param {Object} zombieManager - Zombie manager instance
 * @param {Object} logger - Logger instance
 */
function gameLoop(gameState, io, metricsCollector, perfIntegration, collisionManager, entityManager, zombieManager, logger) {
  // Incrémenter le compteur de tick pour la gestion de performance
  perfIntegration.incrementTick();

  // Protection contre race conditions
  if (gameLoopRunning) {
    logger.warn('Race condition detected - game loop already running, skipping frame');
    return;
  }

  gameLoopRunning = true;

  let frameStart = Date.now();

  try {
    const now = frameStart;

    // Mettre à jour les métriques de base
    metricsCollector.updatePlayers(gameState);
    metricsCollector.updateZombies(gameState);
    metricsCollector.updatePowerups(gameState);
    metricsCollector.updateBullets(gameState);
    metricsCollector.updateGame(gameState);

    // Reconstruire le Quadtree pour les collisions optimisées
    collisionManager.rebuildQuadtree();

  // Mise à jour des joueurs (power-ups temporaires)
  for (let playerId in gameState.players) {
    const player = gameState.players[playerId];

    if (!player.alive) continue;

    // Vérifier l'expiration de la protection de spawn
    if (player.spawnProtection && now > player.spawnProtectionEndTime) {
      player.spawnProtection = false;
    }

    // Vérifier l'expiration de l'invisibilité après upgrade
    if (player.invisible && now > player.invisibleEndTime) {
      player.invisible = false;
    }

    // Retour au pistolet si l'arme spéciale a expiré
    if (player.weaponTimer && now > player.weaponTimer) {
      player.weapon = 'pistol';
      player.weaponTimer = null;
    }

    // Retour à la vitesse normale si le boost a expiré
    if (player.speedBoost && now > player.speedBoost) {
      player.speedBoost = null;
    }

    // Réinitialiser le combo si le timeout est dépassé
    const COMBO_TIMEOUT = 5000; // 5 secondes
    if (player.combo > 0 && player.comboTimer > 0 && now - player.comboTimer > COMBO_TIMEOUT) {
      player.combo = 0;
      player.comboTimer = 0;
      // Notifier le client que le combo est terminé
      io.to(playerId).emit('comboReset');
    }

    // Régénération de vie
    if (player.regeneration > 0) {
      if (!player.lastRegenTick || now - player.lastRegenTick >= 1000) {
        player.health = Math.min(player.health + player.regeneration, player.maxHealth);
        player.lastRegenTick = now;
      }
    }

    // Tourelles automatiques
    if (player.autoTurrets > 0 && player.hasNickname && !player.spawnProtection) {
      // Cooldown : 600ms par tourelle (plus on a de tourelles, plus on tire vite)
      const autoFireCooldown = 600 / player.autoTurrets;

      if (now - player.lastAutoShot >= autoFireCooldown) {
        // Trouver le zombie le plus proche (OPTIMISÉ avec Quadtree)
        const autoTurretRange = 500;
        const closestZombie = collisionManager.findClosestZombie(player.x, player.y, autoTurretRange);

        // Tirer sur le zombie le plus proche
        if (closestZombie) {
          const angle = Math.atan2(closestZombie.y - player.y, closestZombie.x - player.x);

          // Les tourelles font 60% des dégâts normaux
          const baseDamage = CONFIG.BULLET_DAMAGE * 0.6;
          const damage = baseDamage * (player.damageMultiplier || 1);

          // Créer la balle (OPTIMISÉ avec Object Pool)
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

          // Créer des particules pour indiquer le tir
          createParticles(player.x, player.y, '#00ffaa', 3, entityManager);
        }
      }
    }
  }

  // Mise à jour des flaques toxiques (boss "L'Infect" et "Omega")
  if (!gameState.toxicPools) gameState.toxicPools = [];

  // Nettoyer les flaques expirées
  gameState.toxicPools = gameState.toxicPools.filter(pool => {
    return (now - pool.createdAt) < pool.duration;
  });

  // Appliquer les dégâts aux joueurs dans les flaques
  for (let pool of gameState.toxicPools) {
    for (let playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.alive) continue;

      // Vérifier si le joueur est dans la flaque
      const dist = distance(player.x, player.y, pool.x, pool.y);
      if (dist < pool.radius) {
        // Dégâts toutes les 0.5 secondes
        if (!pool.lastDamage) pool.lastDamage = {};
        if (!pool.lastDamage[playerId] || now - pool.lastDamage[playerId] >= 500) {
          pool.lastDamage[playerId] = now;

          // Appliquer les dégâts
          player.health -= pool.damage;

          // Créer des particules toxiques
          createParticles(player.x, player.y, '#00ff00', 5, entityManager);

          // Vérifier la mort
          if (player.health <= 0) {
            player.alive = false;
            player.health = 0;
            createParticles(player.x, player.y, '#ff0000', 30, entityManager);
          }
        }
      }
    }
  }

  // Mise à jour des zombies - ils chassent le joueur le plus proche
  updateZombies(gameState, now, io, collisionManager, entityManager, zombieManager, perfIntegration);

  // Mise à jour des traînées de poison
  updatePoisonTrails(gameState, now, collisionManager, entityManager);

  // Mise à jour des balles
  updateBullets(gameState, now, io, collisionManager, entityManager, zombieManager, perfIntegration);

  // Mise à jour des particules
  for (let particleId in gameState.particles) {
    const particle = gameState.particles[particleId];
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.1; // Gravité
  }

  // Nettoyer les entités expirées (OPTIMISÉ avec Object Pools)
  entityManager.cleanupExpiredEntities(now);

  // Mise à jour des power-ups
  updatePowerups(gameState, now, entityManager);

  // Mise à jour du loot (Rogue-like)
  updateLoot(gameState, now, io, entityManager);

  } catch (error) {
    logger.error('Game loop error', { error: error.message, stack: error.stack });
  } finally {
    // Enregistrer le temps du frame pour calcul FPS
    const frameTime = Date.now() - frameStart;
    metricsCollector.recordFrameTime(frameTime);

    gameLoopRunning = false;
  }
}

/**
 * Update zombies AI and abilities
 */
function updateZombies(gameState, now, io, collisionManager, entityManager, zombieManager, perfIntegration) {
  for (let zombieId in gameState.zombies) {
    const zombie = gameState.zombies[zombieId];

    // Capacité spéciale : Zombie Soigneur (OPTIMISÉ avec Quadtree)
    if (zombie.type === 'healer') {
      const healerType = ZOMBIE_TYPES.healer;
      if (!zombie.lastHeal || now - zombie.lastHeal >= healerType.healCooldown) {
        zombie.lastHeal = now;

        // Soigner les zombies autour (OPTIMISÉ)
        const nearbyZombies = collisionManager.findZombiesInRadius(
          zombie.x, zombie.y, healerType.healRadius, zombieId
        );

        for (let other of nearbyZombies) {
          if (other.health < other.maxHealth) {
            other.health = Math.min(other.health + healerType.healAmount, other.maxHealth);
            // Créer des particules de soin
            createParticles(other.x, other.y, '#00ffff', 5, entityManager);
          }
        }
      }
    }

    // Capacité spéciale : Zombie Ralentisseur (OPTIMISÉ avec Quadtree)
    if (zombie.type === 'slower') {
      const slowerType = ZOMBIE_TYPES.slower;

      // Ralentir les joueurs dans le rayon (OPTIMISÉ)
      const nearbyPlayers = collisionManager.findPlayersInRadius(
        zombie.x, zombie.y, slowerType.slowRadius
      );

      for (let player of nearbyPlayers) {
        // Appliquer l'effet de ralentissement
        player.slowedUntil = now + slowerType.slowDuration;
        player.slowAmount = slowerType.slowAmount;
      }
    }

    // Capacité spéciale : Zombie Tireur (OPTIMISÉ avec Quadtree)
    if (zombie.type === 'shooter') {
      const shooterType = ZOMBIE_TYPES.shooter;

      // Vérifier le cooldown de tir
      if (!zombie.lastShot || now - zombie.lastShot >= shooterType.shootCooldown) {
        // Trouver le joueur le plus proche dans la portée (OPTIMISÉ)
        // CORRECTION: Respecter l'invisibilité (pendant choix d'amélioration)
        const targetPlayer = collisionManager.findClosestPlayer(
          zombie.x, zombie.y, shooterType.shootRange,
          { ignoreSpawnProtection: true, ignoreInvisible: false }
        );

        // Tirer sur le joueur cible
        if (targetPlayer) {
          zombie.lastShot = now;
          const angle = Math.atan2(targetPlayer.y - zombie.y, targetPlayer.x - zombie.x);

          // Créer une balle de zombie (OPTIMISÉ avec Object Pool)
          entityManager.createBullet({
            x: zombie.x,
            y: zombie.y,
            vx: MathUtils.fastCos(angle) * shooterType.bulletSpeed,
            vy: MathUtils.fastSin(angle) * shooterType.bulletSpeed,
            zombieId: zombieId,
            damage: zombie.damage,
            color: shooterType.bulletColor,
            isZombieBullet: true, // Marquer comme balle de zombie
            piercing: 0,
            piercedZombies: [],
            explosiveRounds: false,
            explosionRadius: 0,
            explosionDamagePercent: 0
          });

          // Créer des particules de tir
          createParticles(zombie.x, zombie.y, shooterType.bulletColor, 5, entityManager);
        }
      }
    }

    // Capacité spéciale : Zombie Poison - laisse une traînée de poison
    if (zombie.type === 'poison') {
      const poisonType = ZOMBIE_TYPES.poison;

      // Vérifier le cooldown pour laisser une traînée
      if (!zombie.lastPoisonTrail || now - zombie.lastPoisonTrail >= poisonType.poisonTrailInterval) {
        zombie.lastPoisonTrail = now;

        // Créer une nouvelle traînée de poison
        const trailId = gameState.nextPoisonTrailId++;
        gameState.poisonTrails[trailId] = {
          id: trailId,
          x: zombie.x,
          y: zombie.y,
          radius: poisonType.poisonRadius,
          damage: poisonType.poisonDamage,
          createdAt: now,
          duration: poisonType.poisonDuration
        };

        // Créer des particules vertes pour l'effet visuel
        createParticles(zombie.x, zombie.y, poisonType.color, 3, entityManager);
      }
    }

    // Capacité spéciale : Zombie Téléporteur - se téléporte près du joueur
    updateTeleporterZombie(zombie, zombieId, now, collisionManager, entityManager, gameState);

    // Capacité spéciale : Zombie Invocateur - invoque des mini-zombies
    updateSummonerZombie(zombie, zombieId, now, zombieManager, entityManager, gameState);

    // Capacité spéciale : Zombie Berserker - devient enragé et fait des dashes
    updateBerserkerZombie(zombie, zombieId, now, collisionManager, entityManager, gameState);

    // ========== BOSS SPÉCIAUX ==========
    updateBossCharnier(zombie, now, zombieManager, perfIntegration, entityManager, gameState);
    updateBossInfect(zombie, now, entityManager, gameState);
    updateBossColosse(zombie, zombieId, now, io, entityManager);
    updateBossRoi(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState);
    updateBossOmega(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState, collisionManager);

    // ========== FIN BOSS SPÉCIAUX ==========

    // Mouvement du zombie
    moveZombie(zombie, zombieId, collisionManager, gameState);
  }
}

/**
 * Update teleporter zombie
 */
function updateTeleporterZombie(zombie, zombieId, now, collisionManager, entityManager, gameState) {
  if (zombie.type !== 'teleporter') return;

  const teleporterType = ZOMBIE_TYPES.teleporter;
  if (!zombie.lastTeleport || now - zombie.lastTeleport >= teleporterType.teleportCooldown) {
    // CORRECTION: Respecter l'invisibilité (pendant choix d'amélioration)
    const closestPlayer = collisionManager.findClosestPlayer(
      zombie.x, zombie.y, Infinity,
      { ignoreSpawnProtection: true, ignoreInvisible: false }
    );

    if (closestPlayer) {
      const distToPlayer = distance(zombie.x, zombie.y, closestPlayer.x, closestPlayer.y);

      // Se téléporter uniquement si assez loin du joueur
      if (distToPlayer > teleporterType.teleportRange) {
        zombie.lastTeleport = now;

        // Angle vers le joueur
        const angleToPlayer = Math.atan2(closestPlayer.y - zombie.y, closestPlayer.x - zombie.x);

        // Distance aléatoire entre min et max range
        const teleportDistance = teleporterType.teleportMinRange +
          Math.random() * (teleporterType.teleportRange - teleporterType.teleportMinRange);

        // Nouvelle position près du joueur
        const newX = closestPlayer.x - Math.cos(angleToPlayer) * teleportDistance;
        const newY = closestPlayer.y - Math.sin(angleToPlayer) * teleportDistance;

        // Vérifier collision avec murs (using global roomManager from gameState)
        const roomManager = gameState.roomManager;
        if (roomManager && !roomManager.checkWallCollision(newX, newY, zombie.size)) {
          // Créer particules à l'ancienne position
          createParticles(zombie.x, zombie.y, teleporterType.color, 15, entityManager);

          // Téléporter
          zombie.x = newX;
          zombie.y = newY;

          // Créer particules à la nouvelle position
          createParticles(zombie.x, zombie.y, teleporterType.color, 15, entityManager);
        }
      }
    }
  }
}

/**
 * Update summoner zombie
 */
function updateSummonerZombie(zombie, zombieId, now, zombieManager, entityManager, gameState) {
  if (zombie.type !== 'summoner') return;

  const summonerType = ZOMBIE_TYPES.summoner;

  // Compter les minions actuels de cet invocateur
  let currentMinions = 0;
  for (let zId in gameState.zombies) {
    const z = gameState.zombies[zId];
    if (z.summonerId === zombieId) {
      currentMinions++;
    }
  }
  zombie.minionCount = currentMinions;

  // Invoquer si cooldown passé et pas trop de minions
  if (currentMinions < summonerType.maxMinions &&
      (!zombie.lastSummon || now - zombie.lastSummon >= summonerType.summonCooldown)) {
    zombie.lastSummon = now;

    // Invoquer plusieurs minions
    const minionsToSpawn = Math.min(
      summonerType.minionsPerSummon,
      summonerType.maxMinions - currentMinions
    );

    for (let i = 0; i < minionsToSpawn; i++) {
      const spawned = zombieManager.spawnMinion(zombieId, zombie.x, zombie.y);
      if (spawned) {
        zombie.minionCount++;
      }
    }

    // Effet visuel d'invocation
    if (minionsToSpawn > 0) {
      createParticles(zombie.x, zombie.y, summonerType.color, 20, entityManager);
    }
  }
}

/**
 * Update Boss Charnier
 */
function updateBossCharnier(zombie, now, zombieManager, perfIntegration, entityManager, gameState) {
  if (zombie.type !== 'bossCharnier') return;

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
  if (zombie.type !== 'bossInfect') return;

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
    for (let playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.alive || player.spawnProtection || player.invisible) continue;

      const dist = distance(zombie.x, zombie.y, player.x, player.y);
      if (dist < bossType.deathAuraRadius) {
        player.health -= bossType.deathAuraDamage;

        // Particules vertes toxiques
        createParticles(player.x, player.y, '#00ff00', 5, entityManager);

        if (player.health <= 0) {
          player.health = 0;
          player.alive = false;
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
  if (zombie.type !== 'bossColosse') return;

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
function updateBossRoi(zombie, zombieId, now, io, zombieManager, perfIntegration, entityManager, gameState) {
  if (zombie.type !== 'bossRoi') return;

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

    // Téléportation aléatoire dans la salle
    const newX = 200 + Math.random() * (CONFIG.ROOM_WIDTH - 400);
    const newY = 200 + Math.random() * (CONFIG.ROOM_HEIGHT - 400);

    const roomManager = gameState.roomManager;
    if (roomManager && !roomManager.checkWallCollision(newX, newY, zombie.size)) {
      createParticles(zombie.x, zombie.y, bossType.color, 30, entityManager);
      zombie.x = newX;
      zombie.y = newY;
      createParticles(zombie.x, zombie.y, bossType.color, 30, entityManager);
    }
  }

  // Invocation (Phase 3)
  if (zombie.phase >= 3 && (!zombie.lastSummon || now - zombie.lastSummon >= bossType.summonCooldown)) {
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

  // Clones (Phase 3) - 2 clones de 500 HP pour 30 secondes
  if (zombie.phase >= 3 && (!zombie.lastClone || now - zombie.lastClone >= bossType.cloneCooldown)) {
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
  if (zombie.type !== 'bossOmega') return;

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
    const newX = 200 + Math.random() * (CONFIG.ROOM_WIDTH - 400);
    const newY = 200 + Math.random() * (CONFIG.ROOM_HEIGHT - 400);
    const roomManager = gameState.roomManager;
    if (roomManager && !roomManager.checkWallCollision(newX, newY, zombie.size)) {
      createParticles(zombie.x, zombie.y, bossType.color, 40, entityManager);
      zombie.x = newX;
      zombie.y = newY;
      createParticles(zombie.x, zombie.y, bossType.color, 40, entityManager);
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
      for (let playerId in gameState.players) {
        const player = gameState.players[playerId];
        if (!player.alive || player.spawnProtection || player.invisible) continue;

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
            player.health = 0;
            player.alive = false;
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
function moveZombie(zombie, zombieId, collisionManager, gameState) {
  // Trouver le joueur le plus proche (OPTIMISÉ avec Quadtree)
  // CORRECTION: Respecter l'invisibilité (pendant choix d'amélioration)
  const closestPlayer = collisionManager.findClosestPlayer(
    zombie.x, zombie.y, Infinity,
    { ignoreSpawnProtection: true, ignoreInvisible: false }
  );

  const now = Date.now();
  const roomManager = gameState.roomManager;

  // Déplacer le zombie vers le joueur ou de manière aléatoire
  if (closestPlayer) {
    let angle = Math.atan2(closestPlayer.y - zombie.y, closestPlayer.x - zombie.x);

    // Mettre à jour l'angle de facing pour le Zombie Bouclier
    if (zombie.type === 'shielded') {
      zombie.facingAngle = angle;
    }

    // Calculate effective speed
    let effectiveSpeed = zombie.speed;

    // Apply rage speed multiplier for berserker
    if (zombie.type === 'berserker' && zombie.rageSpeedMultiplier) {
      effectiveSpeed *= zombie.rageSpeedMultiplier;
    }

    // Apply dash speed if berserker is dashing
    if (zombie.type === 'berserker' && zombie.isDashing) {
      const berserkerType = ZOMBIE_TYPES.berserker;
      effectiveSpeed = berserkerType.dashSpeed;
      angle = zombie.dashAngle; // Use stored dash angle
    }

    const newX = zombie.x + MathUtils.fastCos(angle) * effectiveSpeed;
    const newY = zombie.y + MathUtils.fastSin(angle) * effectiveSpeed;

    // Vérifier collision avec les murs - avec système de glissement
    let finalX = zombie.x;
    let finalY = zombie.y;

    // Essayer de se déplacer dans les deux directions
    if (roomManager && !roomManager.checkWallCollision(newX, newY, zombie.size)) {
      // Pas de collision, mouvement libre
      finalX = newX;
      finalY = newY;
    } else {
      // Collision détectée, essayer de glisser le long des murs
      // Essayer uniquement l'axe X
      if (roomManager && !roomManager.checkWallCollision(newX, zombie.y, zombie.size)) {
        finalX = newX;
      }
      // Essayer uniquement l'axe Y
      if (roomManager && !roomManager.checkWallCollision(zombie.x, newY, zombie.size)) {
        finalY = newY;
      }
    }

    // Appliquer la nouvelle position
    zombie.x = finalX;
    zombie.y = finalY;

    // OPTIMISATION: Utilisation du Quadtree pour trouver les joueurs proches
    const nearbyPlayers = collisionManager.findPlayersInRadius(
      zombie.x,
      zombie.y,
      zombie.size + CONFIG.PLAYER_SIZE
    );

    // Vérifier collision avec les joueurs proches uniquement
    for (let player of nearbyPlayers) {
      // Ignorer les joueurs avec protection de spawn ou invisibles
      if (player.spawnProtection || player.invisible) {
        continue;
      }

      if (distance(zombie.x, zombie.y, player.x, player.y) < zombie.size) {
        // Esquive
        if (Math.random() < (player.dodgeChance || 0)) {
          continue; // Esquive réussie
        }

        // CORRECTION: Dégâts basés sur le temps plutôt que sur les frames
        if (!player.lastDamageTime) player.lastDamageTime = {};
        const lastDamage = player.lastDamageTime[zombieId] || 0;
        const DAMAGE_INTERVAL = 100; // 100ms entre chaque tick de dégâts

        if (now - lastDamage >= DAMAGE_INTERVAL) {
          // Dégâts par seconde convertis en dégâts par tick
          let damageDealt = zombie.damage * (DAMAGE_INTERVAL / 1000);

          // Apply berserker rage damage multiplier
          if (zombie.type === 'berserker' && zombie.rageDamageMultiplier) {
            damageDealt *= zombie.rageDamageMultiplier;
          }

          player.health -= damageDealt;
          player.lastDamageTime[zombieId] = now;

          // Épines (renvoyer des dégâts)
          if (player.thorns > 0) {
            const thornsDamage = damageDealt * player.thorns;
            zombie.health -= thornsDamage;
          }

          if (player.health <= 0) {
            player.health = 0;
            player.alive = false;
          }
        }
      }
    }
  } else {
    // Aucun joueur visible - mouvement aléatoire
    // Changer de direction aléatoire toutes les 2 secondes
    if (!zombie.randomMoveTimer || now - zombie.randomMoveTimer > 2000) {
      zombie.randomAngle = Math.random() * Math.PI * 2;
      zombie.randomMoveTimer = now;
    }

    const newX = zombie.x + Math.cos(zombie.randomAngle) * zombie.speed;
    const newY = zombie.y + Math.sin(zombie.randomAngle) * zombie.speed;

    // Vérifier collision avec les murs - avec système de glissement
    let finalX = zombie.x;
    let finalY = zombie.y;

    // Essayer de se déplacer dans les deux directions
    if (roomManager && !roomManager.checkWallCollision(newX, newY, zombie.size)) {
      // Pas de collision, mouvement libre
      finalX = newX;
      finalY = newY;
    } else {
      // Collision détectée, changer de direction aléatoire
      zombie.randomAngle = Math.random() * Math.PI * 2;
    }

    // Appliquer la nouvelle position
    zombie.x = finalX;
    zombie.y = finalY;
  }
}

/**
 * Update poison trails
 */
function updatePoisonTrails(gameState, now, collisionManager, entityManager) {
  for (let trailId in gameState.poisonTrails) {
    const trail = gameState.poisonTrails[trailId];

    // CORRECTION: Le nettoyage des traînées expirées est maintenant géré par EntityManager.cleanupExpiredEntities()
    // Pas besoin de le faire ici

    // OPTIMISATION: Utiliser le Quadtree pour trouver les joueurs proches
    const nearbyPlayers = collisionManager.findPlayersInRadius(
      trail.x, trail.y, trail.radius + 10
    );

    // Appliquer les dégâts aux joueurs qui marchent sur les traînées
    for (let player of nearbyPlayers) {
      // Ignorer les joueurs morts, sans pseudo, avec protection de spawn, ou invisibles
      if (!player.alive || !player.hasNickname || player.spawnProtection || player.invisible) {
        continue;
      }

      const dist = distance(player.x, player.y, trail.x, trail.y);
      if (dist < trail.radius) {
        // CORRECTION: Tracking de dégâts par trail pour permettre le stacking
        if (!player.lastPoisonDamageByTrail) player.lastPoisonDamageByTrail = {};
        const lastTrailDamage = player.lastPoisonDamageByTrail[trailId] || 0;

        // Appliquer les dégâts de poison toutes les 500ms PAR TRAIL
        if (now - lastTrailDamage >= 500) {
          player.health -= trail.damage;
          player.lastPoisonDamageByTrail[trailId] = now;

          // Créer des particules pour l'effet visuel
          createParticles(player.x, player.y, '#22ff22', 2, entityManager);

          // Vérifier si le joueur est mort
          if (player.health <= 0) {
            player.health = 0;
            player.alive = false;
          }
        }
      }
    }
  }
}

/**
 * Update bullets
 */
function updateBullets(gameState, now, io, collisionManager, entityManager, zombieManager, perfIntegration) {
  const roomManager = gameState.roomManager;

  for (let bulletId in gameState.bullets) {
    const bullet = gameState.bullets[bulletId];

    bullet.x += bullet.vx;
    bullet.y += bullet.vy;

    // Appliquer la gravité pour les grenades
    if (bullet.gravity && bullet.gravity > 0) {
      bullet.vy += bullet.gravity;
    }

    // Vérifier le lifetime pour les flammes et autres armes à durée limitée
    if (bullet.lifetime && now > bullet.lifetime) {
      entityManager.destroyBullet(bulletId);
      continue;
    }

    // Retirer les balles hors de la salle ou qui touchent un mur
    if (bullet.x < 0 || bullet.x > CONFIG.ROOM_WIDTH ||
        bullet.y < 0 || bullet.y > CONFIG.ROOM_HEIGHT ||
        (roomManager && roomManager.checkWallCollision(bullet.x, bullet.y, CONFIG.BULLET_SIZE))) {
      entityManager.destroyBullet(bulletId);
      continue;
    }

    // Si c'est une balle de zombie, vérifier collision avec les joueurs
    if (bullet.isZombieBullet) {
      handleZombieBulletCollisions(bullet, bulletId, gameState, entityManager);
      continue; // Passer à la prochaine balle, ne pas vérifier les zombies
    }

    // Vérifier collision avec zombies (seulement pour les balles de joueurs)
    handlePlayerBulletCollisions(bullet, bulletId, gameState, io, collisionManager, entityManager, zombieManager, perfIntegration);
  }
}

/**
 * Handle zombie bullet collisions with players
 */
function handleZombieBulletCollisions(bullet, bulletId, gameState, entityManager) {
  for (let playerId in gameState.players) {
    const player = gameState.players[playerId];

    // Ignorer les joueurs morts, sans pseudo, avec protection de spawn, ou invisibles
    if (!player.alive || !player.hasNickname || player.spawnProtection || player.invisible) {
      continue;
    }

    if (distance(bullet.x, bullet.y, player.x, player.y) < CONFIG.PLAYER_SIZE) {
      // Esquive
      if (Math.random() < (player.dodgeChance || 0)) {
        entityManager.destroyBullet(bulletId);
        break; // Esquive réussie, balle disparaît
      }

      // Infliger les dégâts
      player.health -= bullet.damage;

      if (player.health <= 0) {
        player.health = 0;
        player.alive = false;
      }

      // Créer des particules de sang
      createParticles(player.x, player.y, '#ff0000', 8, entityManager);

      entityManager.destroyBullet(bulletId);
      break;
    }
  }
}

/**
 * Handle player bullet collisions with zombies
 */
function handlePlayerBulletCollisions(bullet, bulletId, gameState, io, collisionManager, entityManager, zombieManager, perfIntegration) {
  // OPTIMISATION: Utilisation du Quadtree au lieu de boucle O(n*m)
  const hitZombies = collisionManager.checkBulletZombieCollisions(bullet);

  for (let {id: zombieId, zombie} of hitZombies) {
    // Vérifier si ce zombie a déjà été percé par cette balle
    if (bullet.piercedZombies && bullet.piercedZombies.includes(zombieId)) {
      continue;
    }

    // Calculer les dégâts avec réduction pour Zombie Bouclier
    let finalDamage = bullet.damage;

    if (zombie.type === 'shielded' && zombie.facingAngle !== null) {
      const shieldedType = ZOMBIE_TYPES.shielded;

      // Angle de la balle par rapport au zombie
      const bulletAngle = Math.atan2(bullet.vy, bullet.vx);

      // Différence d'angle (normalisée entre -PI et PI)
      let angleDiff = bulletAngle - zombie.facingAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // Si la balle vient de face (dans l'angle du bouclier)
      if (Math.abs(angleDiff) < shieldedType.shieldAngle) {
        // Réduire les dégâts
        finalDamage *= shieldedType.frontDamageReduction;

        // Effet visuel de bouclier (particules cyan)
        createParticles(zombie.x, zombie.y, '#00ffff', 10, entityManager);
      }
    }

    // Bouclier de HAIER (Boss Colosse) - 80% de réduction avant rage
    if (zombie.type === 'bossColosse' && zombie.hasShield) {
      const bossType = ZOMBIE_TYPES.bossColosse;
      finalDamage *= (1 - bossType.shieldDamageReduction); // 20% des dégâts seulement
      // Effet visuel intense du bouclier
      createParticles(zombie.x, zombie.y, bossType.shieldColor, 15, entityManager);
    }

    zombie.health -= finalDamage;

    // Vol de vie pour le joueur
    if (bullet.playerId) {
      const shooter = gameState.players[bullet.playerId];
      if (shooter && shooter.lifeSteal > 0) {
        const lifeStolen = bullet.damage * shooter.lifeSteal;
        shooter.health = Math.min(shooter.health + lifeStolen, shooter.maxHealth);
      }
    }

    // Balles perforantes
    if (bullet.piercing > 0 && bullet.piercedZombies) {
      bullet.piercedZombies.push(zombieId);
      if (bullet.piercedZombies.length > bullet.piercing) {
        entityManager.destroyBullet(bulletId);
      }
    } else {
      entityManager.destroyBullet(bulletId);
    }

    // Balles explosives
    handleExplosiveBullet(bullet, zombie, zombieId, gameState, entityManager);

    // Créer des particules de sang
    createParticles(zombie.x, zombie.y, zombie.color, 5, entityManager);

    if (zombie.health <= 0) {
      handleZombieDeath(zombie, zombieId, bullet, gameState, io, entityManager, zombieManager, perfIntegration);
    }
    break;
  }
}

/**
 * Handle explosive bullet effects
 */
function handleExplosiveBullet(bullet, zombie, zombieId, gameState, entityManager) {
  if (bullet.explosiveRounds && bullet.explosionRadius > 0) {
    // Créer l'effet visuel d'explosion
    createExplosion(zombie.x, zombie.y, bullet.explosionRadius, bullet.isRocket, entityManager);

    // Créer explosion - plus intense pour les roquettes
    const explosionColor = bullet.isRocket ? '#ff0000' : '#ff8800';
    const particleCount = bullet.isRocket ? 40 : 20;
    createParticles(zombie.x, zombie.y, explosionColor, particleCount, entityManager);

    // Pour les roquettes, créer aussi des particules orange et jaunes
    if (bullet.isRocket) {
      createParticles(zombie.x, zombie.y, '#ff8800', 30, entityManager);
      createParticles(zombie.x, zombie.y, '#ffff00', 20, entityManager);
    }

    // Infliger dégâts dans le rayon
    for (let otherId in gameState.zombies) {
      if (otherId !== zombieId) {
        const other = gameState.zombies[otherId];
        const dist = distance(zombie.x, zombie.y, other.x, other.y);
        if (dist < bullet.explosionRadius) {
          // CORRECTION: Vérifier null/undefined au lieu de > 0
          const explosionDmg = (bullet.rocketExplosionDamage !== null && bullet.rocketExplosionDamage !== undefined) ?
            bullet.rocketExplosionDamage :
            (bullet.damage * bullet.explosionDamagePercent);
          other.health -= explosionDmg;
          // Créer des particules sur les zombies touchés
          createParticles(other.x, other.y, other.color, 8, entityManager);
        }
      }
    }
  }
}

/**
 * Handle zombie death
 */
function handleZombieDeath(zombie, zombieId, bullet, gameState, io, entityManager, zombieManager, perfIntegration) {
  // Créer plus de particules pour la mort
  createParticles(zombie.x, zombie.y, zombie.color, 15, entityManager);

  // Effet spécial : Zombie Explosif
  if (zombie.type === 'explosive') {
    handleExplosiveZombieDeath(zombie, zombieId, gameState, entityManager);
  }

  // Créer du loot avec bonus de combo
  let goldBonus = zombie.goldDrop;
  let xpBonus = zombie.xpDrop;

  // Mettre à jour le combo et le score du joueur
  if (bullet.playerId) {
    const comboResult = updatePlayerCombo(bullet.playerId, zombie, gameState, io);
    if (comboResult) {
      goldBonus = comboResult.goldBonus;
      xpBonus = comboResult.xpBonus;
    }
  }

  createLoot(zombie.x, zombie.y, goldBonus, xpBonus, gameState);

  // CORRECTION: Nettoyer le tracking de dégâts pour ce zombie dans tous les joueurs
  for (let playerId in gameState.players) {
    const p = gameState.players[playerId];
    if (p.lastDamageTime && p.lastDamageTime[zombieId]) {
      delete p.lastDamageTime[zombieId];
    }
  }

  // Supprimer le zombie
  delete gameState.zombies[zombieId];

  gameState.zombiesKilledThisWave++;

  // Si c'était le boss, lancer une nouvelle vague (MODE INFINI)
  if (zombie.isBoss) {
    handleNewWave(gameState, io, zombieManager);
  }
}

/**
 * Handle explosive zombie death
 */
function handleExplosiveZombieDeath(zombie, zombieId, gameState, entityManager) {
  const explosionType = ZOMBIE_TYPES.explosive;
  // Créer une énorme explosion de particules
  createParticles(zombie.x, zombie.y, '#ff00ff', 30, entityManager);
  createParticles(zombie.x, zombie.y, '#ff8800', 20, entityManager);

  // Infliger des dégâts à tous les joueurs dans le rayon
  for (let playerId in gameState.players) {
    const player = gameState.players[playerId];
    // Ignorer les joueurs morts, sans pseudo, avec protection de spawn, ou invisibles
    if (player.alive && player.hasNickname && !player.spawnProtection && !player.invisible) {
      const dist = distance(zombie.x, zombie.y, player.x, player.y);
      if (dist < explosionType.explosionRadius) {
        player.health -= explosionType.explosionDamage;
        if (player.health <= 0) {
          player.health = 0;
          player.alive = false;
        }
      }
    }
  }

  // NOUVEAU : Infliger des dégâts aux autres zombies dans le rayon
  for (let otherId in gameState.zombies) {
    if (otherId !== zombieId) {
      const other = gameState.zombies[otherId];
      const dist = distance(zombie.x, zombie.y, other.x, other.y);
      if (dist < explosionType.explosionRadius) {
        // L'explosion tue instantanément les zombies normaux, blesse les autres
        const explosionDamage = explosionType.explosionDamage * 1.5; // 50% plus de dégâts aux zombies
        other.health -= explosionDamage;
        // Créer des particules pour montrer l'impact
        createParticles(other.x, other.y, other.color, 8, entityManager);
      }
    }
  }
}

/**
 * Update player combo and score
 */
function updatePlayerCombo(playerId, zombie, gameState, io) {
  const shooter = gameState.players[playerId];
  if (!shooter || !shooter.alive) return null;

  const now = Date.now();
  const COMBO_TIMEOUT = 5000; // 5 secondes pour maintenir le combo

  // Reset ou continue le combo
  if (shooter.comboTimer > 0 && now - shooter.comboTimer < COMBO_TIMEOUT) {
    shooter.combo++;
  } else {
    shooter.combo = 1;
  }

  shooter.comboTimer = now;
  shooter.kills++;
  shooter.zombiesKilled++;

  // Mettre à jour le meilleur combo
  if (shooter.combo > shooter.highestCombo) {
    shooter.highestCombo = shooter.combo;
  }

  // Calculer le multiplicateur de combo
  let comboMultiplier = 1;
  if (shooter.combo >= 50) comboMultiplier = 10;
  else if (shooter.combo >= 30) comboMultiplier = 5;
  else if (shooter.combo >= 15) comboMultiplier = 3;
  else if (shooter.combo >= 5) comboMultiplier = 2;

  // Appliquer le bonus de combo sur l'or et l'XP
  const goldBonus = Math.floor(zombie.goldDrop * comboMultiplier);
  const xpBonus = Math.floor(zombie.xpDrop * comboMultiplier);

  // Calculer le score (base + combo bonus)
  const baseScore = zombie.goldDrop + zombie.xpDrop;
  const comboScore = baseScore * (comboMultiplier - 1);
  shooter.totalScore += baseScore + comboScore;

  // Émettre l'événement de combo pour l'affichage visuel
  io.to(playerId).emit('comboUpdate', {
    combo: shooter.combo,
    multiplier: comboMultiplier,
    score: shooter.totalScore,
    goldBonus: goldBonus - zombie.goldDrop,
    xpBonus: xpBonus - zombie.xpDrop
  });

  return { goldBonus, xpBonus };
}

/**
 * Handle new wave when boss is killed
 */
function handleNewWave(gameState, io, zombieManager) {
  // Nouvelle vague !
  gameState.wave++;
  gameState.bossSpawned = false;
  gameState.zombiesKilledThisWave = 0;
  gameState.zombiesSpawnedThisWave = 0;

  // Accélérer le spawn pour la nouvelle vague
  zombieManager.restartZombieSpawner();

  // Notifier tous les joueurs de la nouvelle vague
  // CORRECTION: Plafonner le calcul pour éviter surcharge à hautes vagues
  const effectiveWave = Math.min(gameState.wave, 130);
  io.emit('newWave', {
    wave: gameState.wave,
    zombiesCount: CONFIG.ZOMBIES_PER_ROOM + (effectiveWave - 1) * 7
  });

  // Bonus de santé pour les joueurs survivants
  for (let playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (player.alive) {
      player.health = Math.min(player.health + 50, player.maxHealth);
      player.gold += 50; // Bonus d'or pour avoir survécu à la vague
    }
  }
}

/**
 * Update powerups
 */
function updatePowerups(gameState, now, entityManager) {
  for (let powerupId in gameState.powerups) {
    const powerup = gameState.powerups[powerupId];

    // Retirer les power-ups expirés
    if (now > powerup.lifetime) {
      delete gameState.powerups[powerupId];
      continue;
    }

    // Vérifier collision avec joueurs
    for (let playerId in gameState.players) {
      const player = gameState.players[playerId];
      // Seuls les joueurs avec pseudo peuvent collecter des power-ups
      if (player.alive && player.hasNickname && distance(powerup.x, powerup.y, player.x, player.y) < CONFIG.PLAYER_SIZE + CONFIG.POWERUP_SIZE) {
        // Appliquer l'effet du power-up
        POWERUP_TYPES[powerup.type].effect(player);
        delete gameState.powerups[powerupId];

        // Créer des particules
        createParticles(powerup.x, powerup.y, POWERUP_TYPES[powerup.type].color, 12, entityManager);
        break;
      }
    }
  }
}

/**
 * Update loot
 */
function updateLoot(gameState, now, io, entityManager) {
  for (let lootId in gameState.loot) {
    const loot = gameState.loot[lootId];

    // Retirer le loot expiré
    if (now > loot.lifetime) {
      delete gameState.loot[lootId];
      continue;
    }

    // Vérifier collision avec joueurs
    for (let playerId in gameState.players) {
      const player = gameState.players[playerId];
      const collectRadius = CONFIG.PLAYER_SIZE + CONFIG.LOOT_SIZE + (player.goldMagnetRadius || 0);
      // Seuls les joueurs avec pseudo peuvent collecter du loot
      if (player.alive && player.hasNickname && distance(loot.x, loot.y, player.x, player.y) < collectRadius) {
        // Donner l'or et l'XP
        player.gold += loot.gold;
        player.xp += loot.xp;

        // Créer des particules dorées
        createParticles(loot.x, loot.y, '#ffff00', 10, entityManager);

        delete gameState.loot[lootId];

        // Level up si assez d'XP
        handlePlayerLevelUp(player, playerId, io);

        break;
      }
    }
  }
}

/**
 * Handle player level up
 */
function handlePlayerLevelUp(player, playerId, io) {
  while (player.xp >= getXPForLevel(player.level)) {
    player.xp -= getXPForLevel(player.level);
    player.level++;

    // PALIERS DE NIVEAU - Bonus automatiques tous les 5 niveaux
    let milestoneBonus = null;
    if (player.level % 5 === 0) {
      milestoneBonus = applyMilestoneBonus(player);
    }

    // Générer 3 choix d'upgrades
    const upgradeChoices = generateUpgradeChoices();

    // Activer l'invisibilité - le joueur devient invisible tant qu'il n'a pas choisi d'amélioration
    player.invisible = true;
    player.invisibleEndTime = Infinity; // Invisible jusqu'à ce qu'il choisisse une amélioration

    io.to(playerId).emit('levelUp', {
      newLevel: player.level,
      upgradeChoices: upgradeChoices,
      milestoneBonus: milestoneBonus // Envoyer le bonus de palier s'il existe
    });
  }
}

/**
 * Apply milestone bonus
 */
function applyMilestoneBonus(player) {
  let milestoneBonus = null;

  if (player.level === 5) {
    player.maxHealth += 50;
    player.health = Math.min(player.health + 50, player.maxHealth);
    milestoneBonus = {
      title: '🎖️ PALIER 5 !',
      description: '+50 PV max et régénération complète',
      icon: '❤️'
    };
  } else if (player.level === 10) {
    player.damageMultiplier = (player.damageMultiplier || 1) * 1.25;
    player.speedMultiplier = (player.speedMultiplier || 1) * 1.20;
    milestoneBonus = {
      title: '🎖️ PALIER 10 !',
      description: '+25% dégâts et +20% vitesse permanents',
      icon: '⚔️'
    };
  } else if (player.level === 15) {
    player.fireRateMultiplier = (player.fireRateMultiplier || 1) * 0.75;
    player.criticalChance = (player.criticalChance || 0) + 0.15;
    milestoneBonus = {
      title: '🎖️ PALIER 15 !',
      description: '-25% cooldown et +15% coup critique',
      icon: '🔫'
    };
  } else if (player.level === 20) {
    player.maxHealth += 100;
    player.health = player.maxHealth; // Heal complet
    player.lifeSteal = (player.lifeSteal || 0) + 0.10;
    milestoneBonus = {
      title: '🎖️ PALIER 20 !',
      description: '+100 PV max, heal complet et +10% vol de vie',
      icon: '💪'
    };
  } else {
    // Paliers 25, 30, 35, etc. - Bonus génériques
    const tier = Math.floor(player.level / 5);
    player.maxHealth += 30;
    player.health = Math.min(player.health + 30, player.maxHealth);
    player.damageMultiplier = (player.damageMultiplier || 1) * 1.10;
    milestoneBonus = {
      title: `🎖️ PALIER ${player.level} !`,
      description: '+30 PV max et +10% dégâts',
      icon: '🌟'
    };
  }

  return milestoneBonus;
}

/**
 * Update berserker zombie - becomes enraged and dashes at low health
 */
function updateBerserkerZombie(zombie, zombieId, now, collisionManager, entityManager, gameState) {
  if (zombie.type !== 'berserker') return;

  const berserkerType = ZOMBIE_TYPES.berserker;

  // Calculate health percentage
  const healthPercent = zombie.health / zombie.maxHealth;

  // Determine rage state
  const wasRaged = zombie.isRaged;
  const wasExtremeRaged = zombie.isExtremeRaged;

  if (healthPercent <= berserkerType.extremeRageThreshold) {
    zombie.isExtremeRaged = true;
    zombie.isRaged = true;
  } else if (healthPercent <= berserkerType.rageThreshold) {
    zombie.isExtremeRaged = false;
    zombie.isRaged = true;
  } else {
    zombie.isExtremeRaged = false;
    zombie.isRaged = false;
  }

  // Trigger visual effects when entering rage state
  if (!wasRaged && zombie.isRaged) {
    // Entrer en rage - particules orange/rouges
    createParticles(zombie.x, zombie.y, '#ff0000', 20, entityManager);
    zombie.color = berserkerType.rageColor;
  } else if (!wasExtremeRaged && zombie.isExtremeRaged) {
    // Entrer en rage extrême - explosion de particules
    createParticles(zombie.x, zombie.y, '#ff0000', 30, entityManager);
  }

  // Update zombie color based on rage state
  if (zombie.isRaged) {
    zombie.color = berserkerType.rageColor;
  } else {
    zombie.color = berserkerType.color;
  }

  // Apply rage speed and damage multipliers
  if (zombie.isExtremeRaged) {
    zombie.rageSpeedMultiplier = berserkerType.extremeRageSpeedMultiplier;
    zombie.rageDamageMultiplier = berserkerType.extremeRageDamageMultiplier;
  } else if (zombie.isRaged) {
    zombie.rageSpeedMultiplier = berserkerType.rageSpeedMultiplier;
    zombie.rageDamageMultiplier = berserkerType.rageDamageMultiplier;
  } else {
    zombie.rageSpeedMultiplier = 1.0;
    zombie.rageDamageMultiplier = 1.0;
  }

  // Dash ability (only in extreme rage)
  if (zombie.isExtremeRaged) {
    // Check if currently dashing
    if (zombie.isDashing && now < zombie.dashEndTime) {
      // Continue dashing - movement is handled in moveZombie with dashSpeed
      return;
    } else if (zombie.isDashing && now >= zombie.dashEndTime) {
      // End dash
      zombie.isDashing = false;
    }

    // Try to start a new dash
    if (!zombie.isDashing && (!zombie.lastDash || now - zombie.lastDash >= berserkerType.dashCooldown)) {
      // CORRECTION: Respecter l'invisibilité (pendant choix d'amélioration)
      const closestPlayer = collisionManager.findClosestPlayer(
        zombie.x, zombie.y, 400, // Dash range of 400 pixels
        { ignoreSpawnProtection: false, ignoreInvisible: false }
      );

      if (closestPlayer) {
        // Start dash
        zombie.lastDash = now;
        zombie.isDashing = true;
        zombie.dashEndTime = now + berserkerType.dashDuration;

        // Calculate dash direction
        const angleToPlayer = Math.atan2(closestPlayer.y - zombie.y, closestPlayer.x - zombie.x);
        zombie.dashAngle = angleToPlayer;

        // Visual effect for dash
        createParticles(zombie.x, zombie.y, '#ff4400', 15, entityManager);
      }
    }
  } else {
    // Not in extreme rage, cancel any ongoing dash
    zombie.isDashing = false;
  }
}

module.exports = {
  gameLoop
};
