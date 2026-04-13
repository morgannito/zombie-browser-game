/**
 * @fileoverview Socket.IO event handlers
 * @description Handles all Socket.IO events for player interactions:
 * - Connection and disconnection
 * - Player ready, movement, shooting
 * - Nickname selection
 * - Upgrade selection and item purchasing
 * - Shop interactions
 * - Session recovery
 * - Rate limiting and input validation
 */

const logger = require('../lib/infrastructure/Logger');
const { SOCKET_EVENTS } = require('../shared/socketEvents');
const ConfigManager = require('../lib/server/ConfigManager');
const { cleanupPlayerBullets } = require('../game/utilityFunctions');
const {
  validateMovementData,
  validateShootData,
  validateUpgradeData
} = require('../game/validationFunctions');
const { createPlayerState } = require('./playerStateFactory');
const {
  savePlayerProgressionSnapshot,
  resetPlayerRunState,
  restorePlayerProgression
} = require('../game/modules/player/RespawnHelpers');
const {
  disconnectedPlayers,
  startSessionCleanupInterval,
  stopSessionCleanupInterval,
  normalizeSessionId,
  sanitizePlayersState,
  createRecoverablePlayerState,
  restoreRecoverablePlayerState
} = require('./sessionRecovery');
const { checkRateLimit, cleanupRateLimits } = require('./rateLimitStore');
const { SESSION_RECOVERY_TIMEOUT } = require('../config/constants');
const { safeHandler } = require('./socketUtils');
const { registerBuyItemHandler, registerShopHandlers } = require('./shopEvents');

const { CONFIG, WEAPONS, POWERUP_TYPES, ZOMBIE_TYPES, LEVEL_UP_UPGRADES, SHOP_ITEMS } =
  ConfigManager;

// MEMORY LEAK FIX: Auto-start the interval when module loads
startSessionCleanupInterval(logger);

/**
 * Initialize Socket.IO connection handlers
 * @param {Object} io - Socket.IO instance
 * @param {Object} gameState - Game state object
 * @param {Object} entityManager - Entity manager instance
 * @param {Object} roomManager - Room manager instance
 * @param {Object} metricsCollector - Metrics collector instance
 * @param {Object} perfIntegration - Performance integration instance
 * @param {Object} container - Dependency injection container (optional)
 * @returns {Function} Connection handler
 */
function initSocketHandlers(
  io,
  gameState,
  entityManager,
  roomManager,
  metricsCollector,
  perfIntegration,
  container = null,
  networkManager = null
) {
  return socket => {
    const sessionId = normalizeSessionId(socket.handshake.auth?.sessionId);
    const accountId = socket.userId || null;

    logger.info('Player connected', {
      socketId: socket.id,
      sessionId: sessionId || 'none',
      accountId: accountId || 'none'
    });

    // RECOVERY: Check if this session has a saved state
    let playerRecovered = false;
    if (sessionId && disconnectedPlayers.has(sessionId)) {
      const savedData = disconnectedPlayers.get(sessionId);
      const timeSinceDisconnect = Date.now() - savedData.disconnectedAt;

      if (accountId && savedData.accountId && savedData.accountId !== accountId) {
        logger.warn('Session recovery refused - account mismatch', {
          sessionId,
          accountId,
          savedAccountId: savedData.accountId
        });
      } else {
        logger.info('Session recovery found', {
          sessionId,
          disconnectedSecs: Math.round(timeSinceDisconnect / 1000)
        });

        // Restore player state with new socket ID
        const restoredAccountId = accountId || savedData.accountId || null;
        const restoredPlayer = restoreRecoverablePlayerState(
          savedData.playerState,
          socket.id,
          sessionId,
          restoredAccountId
        );

        gameState.players[socket.id] = restoredPlayer;
        disconnectedPlayers.delete(sessionId);
        playerRecovered = true;

        logger.info('Player session restored', {
          sessionId,
          nickname: restoredPlayer.nickname || 'Unknown',
          level: restoredPlayer.level,
          health: restoredPlayer.health,
          maxHealth: restoredPlayer.maxHealth,
          gold: restoredPlayer.gold
        });
      }
    }

    // Create new player if no recovery happened
    if (!playerRecovered) {
      logger.info('Creating new player', { socketId: socket.id });

      // Vérifier la limite de joueurs selon le mode performance
      const playerCount = Object.keys(gameState.players).length;
      if (!perfIntegration.canAcceptPlayer(playerCount)) {
        logger.warn('Player connection rejected - server full', {
          currentPlayers: playerCount,
          maxPlayers: perfIntegration.perfConfig.current.maxPlayers
        });
        socket.emit(SOCKET_EVENTS.SERVER.SERVER_FULL, {
          message: 'Serveur complet. Réessayez plus tard.',
          currentPlayers: playerCount
        });
        socket.disconnect();
        return;
      }

      gameState.players[socket.id] = createPlayerState(
        CONFIG,
        socket.id,
        sessionId || null,
        accountId
      );
    }

    // Apply skill bonuses from account progression (if player has account ID)
    const player = gameState.players[socket.id];
    if (accountId && player && gameState.progressionIntegration) {
      // Apply skill bonuses asynchronously (don't block spawn)
      gameState.progressionIntegration
        .applySkillBonusesOnSpawn(player, accountId, CONFIG)
        .then(() => {
          logger.info('Skill bonuses applied', {
            socketId: socket.id,
            accountId,
            health: player.health,
            maxHealth: player.maxHealth
          });
        })
        .catch(error => {
          logger.error('Failed to apply skill bonuses', {
            socketId: socket.id,
            accountId,
            error: error.message
          });
        });
    }

    // Tracker la nouvelle connexion
    if (!playerRecovered) {
      metricsCollector.incrementTotalPlayers();
    }

    // Envoyer la configuration au client
    socket.emit(SOCKET_EVENTS.SERVER.INIT, {
      playerId: socket.id,
      config: CONFIG,
      weapons: WEAPONS,
      powerupTypes: POWERUP_TYPES,
      zombieTypes: ZOMBIE_TYPES,
      shopItems: SHOP_ITEMS,
      walls: gameState.walls,
      rooms: gameState.rooms.length,
      currentRoom: gameState.currentRoom,
      mutators: gameState.activeMutators || [],
      mutatorEffects: gameState.mutatorEffects || null,
      nextMutatorWave: gameState.nextMutatorWave || 0,
      recovered: playerRecovered // Indicate if state was recovered
    });

    // CRITICAL FIX: Send full game state immediately to new player
    // This ensures they see all existing players, zombies, etc. right away
    const publicPlayers = sanitizePlayersState(gameState.players);
    socket.emit(SOCKET_EVENTS.SERVER.GAME_STATE, {
      players: publicPlayers,
      zombies: gameState.zombies,
      bullets: gameState.bullets,
      particles: gameState.particles,
      poisonTrails: gameState.poisonTrails,
      explosions: gameState.explosions,
      powerups: gameState.powerups,
      loot: gameState.loot,
      wave: gameState.wave,
      walls: gameState.walls,
      currentRoom: gameState.currentRoom,
      bossSpawned: gameState.bossSpawned,
      full: true
    });

    // Register event handlers
    registerPlayerMoveHandler(socket, gameState, roomManager);
    registerShootHandler(socket, gameState, entityManager);
    registerRespawnHandler(socket, gameState, entityManager);
    registerSelectUpgradeHandler(socket, gameState);
    registerBuyItemHandler(socket, gameState);
    registerSetNicknameHandler(socket, gameState, io, container);
    registerSpawnProtectionHandlers(socket, gameState);
    registerShopHandlers(socket, gameState);
    registerPingHandler(socket);
    registerDisconnectHandler(
      socket,
      gameState,
      entityManager,
      sessionId,
      accountId,
      networkManager
    );

    // Register admin commands handlers
    if (gameState.adminCommands) {
      gameState.adminCommands.registerCommands(socket);
    }
  };
}

/**
 * Register playerMove handler
 */
function registerPlayerMoveHandler(socket, gameState, roomManager) {
  socket.on(
    SOCKET_EVENTS.CLIENT.PLAYER_MOVE,
    safeHandler('playerMove', function (data) {
      // VALIDATION: Vérifier et sanitize les données d'entrée
      const validatedData = validateMovementData(data);
      if (!validatedData) {
        logger.warn('Invalid movement data received', { socketId: socket.id, data });
        return;
      }

      // Rate limiting
      if (!checkRateLimit(socket.id, 'playerMove')) {
        return;
      }

      const player = gameState.players[socket.id];
      if (!player || !player.alive || !player.hasNickname) {
        return;
      } // Pas de mouvement sans pseudo

      // Clamp position to map boundaries (must match client-side clamping exactly!)
      // Client uses: wallThickness + playerSize for min, ROOM_WIDTH/HEIGHT - wallThickness - playerSize for max
      const wallThickness = CONFIG.WALL_THICKNESS || 40;
      const playerSize = CONFIG.PLAYER_SIZE || 20;

      const newX = Math.max(
        wallThickness + playerSize,
        Math.min(CONFIG.ROOM_WIDTH - wallThickness - playerSize, validatedData.x)
      );
      const newY = Math.max(
        wallThickness + playerSize,
        Math.min(CONFIG.ROOM_HEIGHT - wallThickness - playerSize, validatedData.y)
      );

      // VALIDATION: Vérifier la distance parcourue pour éviter la téléportation
      const distance = Math.sqrt(Math.pow(newX - player.x, 2) + Math.pow(newY - player.y, 2));

      // ANTI-CHEAT: Valider que speedMultiplier n'est pas suspect
      if (player.speedMultiplier > 5) {
        logger.warn('Anti-cheat: Suspicious speedMultiplier detected', {
          player: player.nickname || socket.id,
          speedMultiplier: player.speedMultiplier
        });
        player.speedMultiplier = 1;
      }

      // Leaky Bucket (Token Bucket) algorithm for movement validation
      // This handles:
      // 1. Normal movement (steady stream)
      // 2. Low FPS (large time gaps, large distance jumps)
      // 3. Lag bursts (accumulated time, sudden burst of packets)
      // 4. Speed hacks (drains budget)

      const now = Date.now();
      const lastMoveTime = player.lastMoveTime || now;
      const timeDelta = now - lastMoveTime;
      player.lastMoveTime = now;

      // CHECK STUN: Si le joueur est stunné, bloquer le mouvement
      if (player.stunned && player.stunnedUntil > now) {
        // Le joueur ne peut pas bouger pendant le stun
        socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
        socket.emit(SOCKET_EVENTS.SERVER.STUNNED, { duration: player.stunnedUntil - now }); // Notifier le client
        return;
      } else if (player.stunned && player.stunnedUntil <= now) {
        // Fin du stun
        player.stunned = false;
        delete player.stunnedUntil;
        delete player.stunnedBy;
      }

      // Initialize budget if not present (start full)
      // Base speed: 5px/frame @ 60fps = 0.3px/ms
      const PIXELS_PER_MS = (CONFIG.PLAYER_SPEED * 60) / 1000;
      const MAX_BUDGET = PIXELS_PER_MS * 2000; // 2 seconds buffer (~600px)

      if (typeof player.moveBudget === 'undefined') {
        player.moveBudget = MAX_BUDGET;
      }

      // Calculate accrual rate
      const speedMultiplier = player.speedMultiplier || 1;
      const hasSpeedBoost = player.speedBoost && Date.now() < player.speedBoost;
      const boostMultiplier = hasSpeedBoost ? 2 : 1;

      // Accrue budget
      // Allow 20% tolerance for clock drift, network jitter, and diagonal movement approximation
      const ACCRUAL_FACTOR = 1.2;
      const accrued =
        timeDelta * PIXELS_PER_MS * speedMultiplier * boostMultiplier * ACCRUAL_FACTOR;

      player.moveBudget += accrued;

      // Cap budget
      if (player.moveBudget > MAX_BUDGET) {
        player.moveBudget = MAX_BUDGET;
      }

      // Check if move is valid
      // We allow a small overdraft (minAllowance) to prevent getting stuck on tiny floating point diffs
      const minAllowance = 20;

      if (distance > player.moveBudget + minAllowance) {
        logger.warn('Anti-cheat: Movement rejected - exceeded budget', {
          player: player.nickname || socket.id,
          distance: Math.round(distance),
          budget: Math.round(player.moveBudget)
        });
        socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
        return;
      }

      // Deduct cost from budget
      player.moveBudget -= distance;
      // Prevent budget from going too negative (optional, but good for recovery)
      if (player.moveBudget < -100) {
        player.moveBudget = -100;
      }

      // Vérifier collision avec les murs
      // BUG FIX: Utiliser 0.8x au lieu de 0.5x pour éviter que le joueur traverse les murs
      // La valeur 0.5x était trop petite et permettait au joueur de passer à travers
      // La valeur 0.8x donne une légère tolérance pour le sliding tout en empêchant le passage
      if (!roomManager.checkWallCollision(newX, newY, CONFIG.PLAYER_SIZE * 0.8)) {
        player.x = newX;
        player.y = newY;
      } else {
        // BUG FIX: Essayer le sliding (mouvement sur un seul axe) avant de rejeter
        // Cela évite que le joueur reste "collé" aux murs
        let slideX = player.x;
        let slideY = player.y;

        // Essayer de glisser sur l'axe X
        if (!roomManager.checkWallCollision(newX, player.y, CONFIG.PLAYER_SIZE * 0.8)) {
          slideX = newX;
        }
        // Essayer de glisser sur l'axe Y
        if (!roomManager.checkWallCollision(player.x, newY, CONFIG.PLAYER_SIZE * 0.8)) {
          slideY = newY;
        }

        // Appliquer le sliding si on a pu bouger
        if (slideX !== player.x || slideY !== player.y) {
          player.x = slideX;
          player.y = slideY;
        } else {
          // Collision totale - envoyer correction de position au client
          // BUG FIX: Réduire le seuil de 20px à 10px pour une meilleure synchronisation
          const clientDistance = Math.sqrt(
            Math.pow(newX - player.x, 2) + Math.pow(newY - player.y, 2)
          );
          if (clientDistance > 10) {
            socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
          }
        }
      }

      player.angle = validatedData.angle;

      // Mettre à jour le timestamp d'activité
      player.lastActivityTime = Date.now();

      // MODE INFINI - Pas de portes ni de changements de salle
    })
  );
}

/**
 * Register shoot handler
 */
function registerShootHandler(socket, gameState, entityManager) {
  socket.on(
    SOCKET_EVENTS.CLIENT.SHOOT,
    safeHandler('shoot', function (data) {
      // VALIDATION: Vérifier et sanitize les données d'entrée
      const validatedData = validateShootData(data);
      if (!validatedData) {
        logger.warn('Invalid shoot data received', { socketId: socket.id, data });
        return;
      }

      // Rate limiting
      if (!checkRateLimit(socket.id, 'shoot')) {
        return;
      }

      const player = gameState.players[socket.id];
      if (!player || !player.alive || !player.hasNickname) {
        return;
      } // Pas de tir sans pseudo

      const now = Date.now();
      player.lastActivityTime = now; // Mettre à jour l'activité

      const weapon = WEAPONS[player.weapon] || WEAPONS.pistol;

      // Le Tesla Coil est une arme passive gérée automatiquement dans la game loop
      // Ne pas créer de bullets pour cette arme
      if (weapon.isTeslaCoil) {
        return;
      }

      const mutatorEffects = gameState.mutatorEffects || {};
      const fireRateCooldownMultiplier = mutatorEffects.playerFireRateCooldownMultiplier || 1;

      // Appliquer le multiplicateur de cadence de tir
      const fireRate =
        weapon.fireRate * (player.fireRateMultiplier || 1) * fireRateCooldownMultiplier;

      // Vérifier le cooldown de l'arme
      if (now - player.lastShot < fireRate) {
        return;
      }

      player.lastShot = now;

      // Nombre total de balles (arme + extra bullets)
      const totalBullets = weapon.bulletCount + (player.extraBullets || 0);

      // ANTI-CHEAT: Limiter le nombre total de balles pour éviter l'exploitation
      const MAX_TOTAL_BULLETS = 50;
      if (totalBullets > MAX_TOTAL_BULLETS) {
        logger.warn('Anti-cheat: Suspicious bullet count detected', {
          player: player.nickname || socket.id,
          bulletCount: totalBullets,
          maxAllowed: MAX_TOTAL_BULLETS
        });
      }
      const safeBulletCount = Math.min(totalBullets, MAX_TOTAL_BULLETS);

      // Créer les balles selon l'arme (OPTIMISÉ avec Object Pool)
      for (let i = 0; i < safeBulletCount; i++) {
        const spreadAngle = validatedData.angle + (Math.random() - 0.5) * weapon.spread;

        // Appliquer le multiplicateur de dégâts
        let damage =
          weapon.damage *
          (player.damageMultiplier || 1) *
          (mutatorEffects.playerDamageMultiplier || 1);

        // Critique (chance de base + chance de l'arme)
        const totalCritChance = (player.criticalChance || 0) + (weapon.criticalChance || 0);
        const isCritical = Math.random() < totalCritChance;
        if (isCritical) {
          const critMultiplier = weapon.criticalMultiplier || 2;
          damage *= critMultiplier;
        }

        // Piercing (de base + piercing de l'arme)
        // FIX: Support plasmaPiercing for plasma rifle weapon
        const weaponPiercing = weapon.piercing || weapon.plasmaPiercing || 0;
        const totalPiercing = (player.bulletPiercing || 0) + weaponPiercing;

        // CORRECTION: Utilisation du pool d'objets au lieu de création manuelle
        entityManager.createBullet({
          x: player.x,
          y: player.y,
          vx: Math.cos(spreadAngle) * weapon.bulletSpeed,
          vy: Math.sin(spreadAngle) * weapon.bulletSpeed,
          playerId: socket.id,
          damage: damage,
          color: isCritical ? '#ff0000' : weapon.color,
          size: weapon.bulletSize || CONFIG.BULLET_SIZE,
          piercing: totalPiercing,
          explosiveRounds: player.explosiveRounds || weapon.hasExplosion || false,
          explosionRadius: weapon.hasExplosion
            ? weapon.explosionRadius
            : player.explosionRadius || 0,
          explosionDamagePercent: weapon.hasExplosion ? 1 : player.explosionDamagePercent || 0,
          rocketExplosionDamage: weapon.hasExplosion ? weapon.explosionDamage : 0,
          isRocket: (weapon.hasExplosion && !weapon.isGrenade) || false,
          isFlame: weapon.isFlame || false,
          isLaser: weapon.isLaser || false,
          isGrenade: weapon.isGrenade || false,
          isCrossbow: weapon.isCrossbow || false,
          // Nouvelles armes
          isChainLightning: weapon.isChainLightning || false,
          isPoisonDart: weapon.isPoisonDart || false,
          isTeslaCoil: weapon.isTeslaCoil || false,
          isIceCannon: weapon.isIceCannon || false,
          isPlasmaRifle: weapon.isPlasmaRifle || false,
          ignoresWalls: weapon.ignoresWalls || false,
          gravity: weapon.gravity || 0,
          lifetime: weapon.lifetime ? now + weapon.lifetime : null,
          createdAt: now
        });
      }
    })
  );
}

/**
 * Register respawn handler
 */
function registerRespawnHandler(socket, gameState, entityManager) {
  socket.on(
    SOCKET_EVENTS.CLIENT.RESPAWN,
    safeHandler('respawn', function () {
      const player = gameState.players[socket.id];
      if (player) {
        player.lastActivityTime = Date.now();

        const snapshot = savePlayerProgressionSnapshot(player);
        const totalMaxHealth = CONFIG.PLAYER_MAX_HEALTH + (snapshot.upgrades.maxHealth || 0) * 20;

        cleanupPlayerBullets(socket.id, gameState, entityManager);
        resetPlayerRunState(player, CONFIG, totalMaxHealth);
        restorePlayerProgression(player, snapshot);
      }
    })
  );
}

/**
 * Register selectUpgrade handler
 */
function registerSelectUpgradeHandler(socket, gameState) {
  socket.on(
    SOCKET_EVENTS.CLIENT.SELECT_UPGRADE,
    safeHandler('selectUpgrade', function (data) {
      // VALIDATION: Vérifier et sanitize les données d'entrée
      const validatedData = validateUpgradeData(data);
      if (!validatedData) {
        logger.warn('Invalid upgrade data received', { socketId: socket.id, data });
        socket.emit(SOCKET_EVENTS.SERVER.ERROR, {
          message: 'Upgrade invalide',
          code: 'INVALID_UPGRADE'
        });
        return;
      }

      // Rate limiting
      if (!checkRateLimit(socket.id, 'selectUpgrade')) {
        return;
      }

      const player = gameState.players[socket.id];
      if (!player || !player.alive || !player.hasNickname) {
        return;
      }

      player.lastActivityTime = Date.now(); // Mettre à jour l'activité

      const upgrade = LEVEL_UP_UPGRADES[validatedData.upgradeId];

      // Double vérification (déjà fait dans validateUpgradeData, mais par sécurité)
      if (!upgrade) {
        logger.error('Upgrade validation failed', { upgradeId: validatedData.upgradeId });
        return;
      }

      // ANTI-CHEAT: Vérifier que le choix était parmi ceux proposés par le serveur
      const pending = player.pendingUpgradeChoices || [];
      const choiceIndex = pending.indexOf(validatedData.upgradeId);
      if (choiceIndex === -1) {
        logger.warn('Anti-cheat: selectUpgrade not in pending choices', {
          player: player.nickname || socket.id,
          upgradeId: validatedData.upgradeId,
          pending
        });
        return;
      }
      // Consommer le choix (retirer toutes les entrées de ce batch)
      player.pendingUpgradeChoices = [];

      // Appliquer l'effet de l'upgrade
      upgrade.effect(player);

      // Désactiver l'invisibilité - le joueur redevient visible dès qu'il choisit une amélioration
      player.invisible = false;
      player.invisibleEndTime = 0;

      socket.emit(SOCKET_EVENTS.SERVER.UPGRADE_SELECTED, {
        success: true,
        upgradeId: validatedData.upgradeId
      });
    })
  );
}

/**
 * Register setNickname handler
 */
function registerSetNicknameHandler(socket, gameState, io, container) {
  socket.on(
    SOCKET_EVENTS.CLIENT.SET_NICKNAME,
    safeHandler('setNickname', async function (data) {
      const player = gameState.players[socket.id];
      if (!player) {
        return;
      }

      // CORRECTION CRITIQUE: Vérifier si le joueur a déjà un pseudo AVANT rate limiting
      if (player.hasNickname) {
        socket.emit(SOCKET_EVENTS.SERVER.NICKNAME_REJECTED, {
          reason: 'Vous avez déjà choisi un pseudo'
        });
        return;
      }

      // Rate limiting
      if (!checkRateLimit(socket.id, 'setNickname')) {
        socket.emit(SOCKET_EVENTS.SERVER.NICKNAME_REJECTED, {
          reason: 'Trop de tentatives. Attendez quelques secondes.'
        });
        return;
      }

      player.lastActivityTime = Date.now(); // Mettre à jour l'activité

      // VALIDATION STRICTE DU PSEUDO
      let nickname = data.nickname ? data.nickname.trim() : '';

      // Filtrer caractères non autorisés (lettres, chiffres, espaces, tirets, underscores)
      nickname = nickname.replace(/[^a-zA-Z0-9\s\-_]/g, '');

      // Limiter à 15 caractères max
      nickname = nickname.substring(0, 15);

      // Vérifier longueur minimale
      if (nickname.length < 2) {
        socket.emit(SOCKET_EVENTS.SERVER.NICKNAME_REJECTED, {
          reason: 'Le pseudo doit contenir au moins 2 caractères alphanumériques'
        });
        return;
      }

      // Vérifier si le pseudo n'est pas déjà pris par un autre joueur
      const isDuplicate = Object.values(gameState.players).some(
        p => p.id !== socket.id && p.nickname && p.nickname.toLowerCase() === nickname.toLowerCase()
      );

      if (isDuplicate) {
        socket.emit(SOCKET_EVENTS.SERVER.NICKNAME_REJECTED, {
          reason: 'Ce pseudo est déjà utilisé par un autre joueur'
        });
        return;
      }

      player.nickname = nickname;
      player.hasNickname = true;
      player.spawnProtection = true;
      player.spawnProtectionEndTime = Date.now() + 3000; // 3 secondes de protection

      logger.info('Player chose nickname', { socketId: socket.id });

      const accountId = player.accountId || socket.userId || null;
      if (container && accountId) {
        try {
          const playerRepository = container.get('playerRepository');
          const existingPlayer = await playerRepository.findById(accountId);
          if (!existingPlayer) {
            const createPlayerUseCase = container.get('createPlayerUseCase');
            await createPlayerUseCase.execute({
              id: accountId,
              username: nickname
            });
            logger.info('Player created in database', { accountId });
          }
        } catch (error) {
          // Log but don't block gameplay - player creation is optional for progression features
          logger.warn('Failed to ensure player exists in database', {
            accountId,
            error: error.message
          });
        }
      }

      // Notifier tous les joueurs
      io.emit(SOCKET_EVENTS.SERVER.PLAYER_NICKNAME_SET, {
        playerId: socket.id,
        nickname: nickname
      });
    })
  );
}

/**
 * Register spawn protection handlers
 */
function registerSpawnProtectionHandlers(socket, gameState) {
  socket.on(
    SOCKET_EVENTS.CLIENT.END_SPAWN_PROTECTION,
    safeHandler('endSpawnProtection', function () {
      const player = gameState.players[socket.id];
      if (!player || !player.hasNickname) {
        return;
      }

      player.lastActivityTime = Date.now(); // Mettre à jour l'activité

      player.spawnProtection = false;
      logger.info('Spawn protection ended', { player: player.nickname || socket.id });
    })
  );
}

/**
 * Register ping handler for latency monitoring
 */
function registerPingHandler(socket) {
  socket.on(
    SOCKET_EVENTS.CLIENT.PING,
    safeHandler('ping', function (timestamp, callback) {
      // Respond immediately to measure round-trip time
      if (typeof callback === 'function') {
        callback(Date.now());
      }
    })
  );
}

/**
 * Register disconnect handler
 */
function registerDisconnectHandler(
  socket,
  gameState,
  entityManager,
  sessionId,
  accountId,
  networkManager = null
) {
  socket.on(
    SOCKET_EVENTS.SYSTEM.DISCONNECT,
    safeHandler('disconnect', function () {
      const player = gameState.players[socket.id];

      logger.info('Player disconnected', {
        socketId: socket.id,
        sessionId: sessionId || 'none',
        accountId: accountId || 'none'
      });

      // SESSION RECOVERY: Save player state for recovery if session exists
      if (sessionId && accountId && player) {
        // Only save state if player has actually started playing (has nickname)
        if (player.hasNickname && player.alive) {
          const playerStateCopy = createRecoverablePlayerState(player);

          disconnectedPlayers.set(sessionId, {
            playerState: playerStateCopy,
            disconnectedAt: Date.now(),
            previousSocketId: socket.id,
            accountId
          });

          logger.info('Session state saved', {
            player: player.nickname || 'Unknown',
            level: player.level,
            health: `${player.health}/${player.maxHealth}`,
            gold: player.gold,
            recoveryTimeout: SESSION_RECOVERY_TIMEOUT / 1000
          });
        }
      }

      // Nettoyer les balles orphelines appartenant à ce joueur
      cleanupPlayerBullets(socket.id, gameState, entityManager);

      // Remove from active players
      delete gameState.players[socket.id];

      // Nettoyer les rate limits
      cleanupRateLimits(socket.id);

      // Nettoyer les queues NetworkManager (memory leak fix)
      if (networkManager) {
        networkManager.cleanupPlayer(socket.id);
      }
    })
  );
}

module.exports = {
  initSocketHandlers,
  // MEMORY LEAK FIX: Export cleanup function for graceful shutdown
  stopSessionCleanupInterval
};
