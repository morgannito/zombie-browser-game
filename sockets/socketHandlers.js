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
const ConfigManager = require('../lib/server/ConfigManager');
const { cleanupPlayerBullets } = require('../game/utilityFunctions');
const {
  validateMovementData,
  validateShootData,
  validateUpgradeData,
  validateBuyItemData
} = require('../game/validationFunctions');

const { CONFIG, WEAPONS, POWERUP_TYPES, ZOMBIE_TYPES, SHOP_ITEMS, LEVEL_UP_UPGRADES } = ConfigManager;
const { SESSION_RECOVERY_TIMEOUT } = require('../config/constants');

/**
 * Map to store disconnected player states for recovery
 * Key: sessionId, Value: { playerState, disconnectedAt, previousSocketId, accountId }
 * States are kept for 5 minutes after disconnection
 */
const disconnectedPlayers = new Map();

/**
 * MEMORY LEAK FIX: Track the session cleanup interval for proper shutdown
 * @type {NodeJS.Timeout|null}
 */
let sessionCleanupInterval = null;

/**
 * Start the session cleanup interval
 * MEMORY LEAK FIX: Now properly tracked for cleanup
 */
function startSessionCleanupInterval() {
  // Clear any existing interval first
  stopSessionCleanupInterval();

  sessionCleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, data] of disconnectedPlayers.entries()) {
      if (now - data.disconnectedAt > SESSION_RECOVERY_TIMEOUT) {
        disconnectedPlayers.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Session recovery cleanup', { cleanedCount, expiredSessions: cleanedCount });
    }
  }, 60000); // Check every minute
}

/**
 * Stop the session cleanup interval
 * MEMORY LEAK FIX: Cleanup function for graceful shutdown
 */
function stopSessionCleanupInterval() {
  if (sessionCleanupInterval) {
    clearInterval(sessionCleanupInterval);
    sessionCleanupInterval = null;
  }
}

// MEMORY LEAK FIX: Auto-start the interval when module loads
startSessionCleanupInterval();

/**
 * Rate limiting system
 */
const rateLimits = new Map();

const { RATE_LIMIT_CONFIG } = require('../config/constants');

const SESSION_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeSessionId(sessionId) {
  if (typeof sessionId !== 'string') {
    return null;
  }
  const trimmed = sessionId.trim();
  return SESSION_ID_REGEX.test(trimmed) ? trimmed : null;
}

function sanitizePlayerState(player) {
  if (!player || typeof player !== 'object') {
    return player;
  }
  const sanitized = Object.assign(Object.create(null), player);
  delete sanitized.sessionId;
  delete sanitized.socketId;
  delete sanitized.accountId;
  return sanitized;
}

function sanitizePlayersState(players) {
  const sanitized = {};
  for (const id in players) {
    sanitized[id] = sanitizePlayerState(players[id]);
  }
  return sanitized;
}

function checkRateLimit(socketId, eventName) {
  const config = RATE_LIMIT_CONFIG[eventName];
  if (!config) {
    return true;
  }

  const now = Date.now();

  if (!rateLimits.has(socketId)) {
    rateLimits.set(socketId, {});
  }

  const socketLimits = rateLimits.get(socketId);

  if (!socketLimits[eventName] || now > socketLimits[eventName].resetTime) {
    socketLimits[eventName] = {
      count: 1,
      resetTime: now + config.windowMs
    };
    return true;
  }

  socketLimits[eventName].count++;

  if (socketLimits[eventName].count > config.maxRequests) {
    logger.warn('Rate limit exceeded', { socketId, event: eventName, limit: config.maxRequests });
    return false;
  }

  return true;
}

function cleanupRateLimits(socketId) {
  rateLimits.delete(socketId);
}

/**
 * Safe socket handler wrapper - Enhanced error handling
 * @param {string} handlerName - Handler name for logging
 * @param {Function} handler - Handler function to wrap
 * @param {Object} options - Optional configuration
 * @param {boolean} options.skipRateLimit - Skip rate limiting for this handler
 * @returns {Function} Wrapped handler with error handling
 */
function safeHandler(handlerName, handler, _options = {}) {
  return function (...args) {
    try {
      // Apply rate limiting unless explicitly skipped (some handlers already check manually)
      // Note: Most handlers in this file already call checkRateLimit manually,
      // so we skip it here to avoid double-checking

      // Execute the handler
      const result = handler.apply(this, args);

      // Handle async handlers
      if (result instanceof Promise) {
        result.catch(error => {
          logger.error('Async socket handler error', {
            handler: handlerName,
            socketId: this.id,
            error: error.message,
            stack: error.stack
          });
          this.emit('error', {
            message: 'Une erreur est survenue sur le serveur',
            code: 'INTERNAL_ERROR'
          });
        });
      }

      return result;
    } catch (error) {
      logger.error('Socket handler error', {
        handler: handlerName,
        socketId: this.id,
        error: error.message,
        stack: error.stack,
        args: args.length > 0 ? JSON.stringify(args[0]).substring(0, 200) : 'no args'
      });

      // Notify client of error
      this.emit('error', {
        message: 'Une erreur est survenue sur le serveur',
        code: 'INTERNAL_ERROR',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      });
    }
  };
}

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
function initSocketHandlers(io, gameState, entityManager, roomManager, metricsCollector, perfIntegration, container = null) {
  return (socket) => {
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
        const restoredPlayer = {
          ...savedData.playerState,
          id: socket.id, // Update to new socket ID
          socketId: socket.id,
          sessionId: sessionId, // Ensure sessionId is set
          accountId: restoredAccountId,
          lastActivityTime: Date.now() // Reset activity timer
        };

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
        socket.emit('serverFull', {
          message: 'Serveur complet. Réessayez plus tard.',
          currentPlayers: playerCount
        });
        socket.disconnect();
        return;
      }

      // Créer un nouveau joueur (Rogue-like)
      // Add random spawn offset to prevent players spawning on top of each other
      // Safe spawn zone: wallThickness + playerSize as minimum margin from walls
      const wallThickness = CONFIG.WALL_THICKNESS || 40;
      const playerSize = CONFIG.PLAYER_SIZE || 20;
      const safeMargin = wallThickness + playerSize + 20; // Extra 20px safety buffer

      const spawnOffsetX = (Math.random() - 0.5) * 100; // ±50px horizontally
      const spawnOffsetY = Math.random() * 40; // 0-40px variation (always towards center)

      // Spawn Y: safeMargin from bottom wall, not too close to center
      const spawnY = CONFIG.ROOM_HEIGHT - safeMargin - 50 - spawnOffsetY;

      gameState.players[socket.id] = {
        id: socket.id,
        socketId: socket.id,
        sessionId: sessionId || null, // Store sessionId for recovery tracking
        accountId: accountId,
        nickname: null, // Pseudo non défini au départ
        hasNickname: false, // Le joueur n'a pas encore choisi de pseudo
        spawnProtection: false, // Protection de spawn inactive
        spawnProtectionEndTime: 0, // Fin de la protection
        invisible: false, // Invisibilité après upgrade ou lors du level up
        invisibleEndTime: 0, // Fin de l'invisibilité
        lastActivityTime: Date.now(), // Pour détecter l'inactivité
        x: CONFIG.ROOM_WIDTH / 2 + spawnOffsetX,
        y: spawnY,
        health: CONFIG.PLAYER_MAX_HEALTH,
        maxHealth: CONFIG.PLAYER_MAX_HEALTH,
        level: 1,
        xp: 0,
        gold: 0,
        score: 0,
        alive: true,
        angle: 0,
        weapon: 'pistol',
        lastShot: 0,
        speedBoost: null,
        weaponTimer: null,
        // Système de combos et score
        kills: 0,
        zombiesKilled: 0,
        combo: 0,
        comboTimer: 0,
        highestCombo: 0,
        totalScore: 0,
        survivalTime: Date.now(),
        // Upgrades permanents (shop)
        upgrades: {
          maxHealth: 0,
          damage: 0,
          speed: 0,
          fireRate: 0
        },
        damageMultiplier: 1,
        speedMultiplier: 1,
        fireRateMultiplier: 1,
        // Stats des upgrades de level-up
        regeneration: 0,
        bulletPiercing: 0,
        lifeSteal: 0,
        criticalChance: 0,
        goldMagnetRadius: 0,
        dodgeChance: 0,
        explosiveRounds: 0,
        explosionRadius: 0,
        explosionDamagePercent: 0,
        extraBullets: 0,
        thorns: 0,
        lastRegenTick: Date.now(),
        autoTurrets: 0,
        lastAutoShot: Date.now()
      };
    }

    // Apply skill bonuses from account progression (if player has account ID)
    const player = gameState.players[socket.id];
    if (accountId && player && gameState.progressionIntegration) {
      // Apply skill bonuses asynchronously (don't block spawn)
      gameState.progressionIntegration.applySkillBonusesOnSpawn(player, accountId, CONFIG)
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
    socket.emit('init', {
      playerId: socket.id,
      config: CONFIG,
      weapons: WEAPONS,
      powerupTypes: POWERUP_TYPES,
      zombieTypes: ZOMBIE_TYPES,
      shopItems: SHOP_ITEMS,
      walls: gameState.walls,
      rooms: gameState.rooms.length,
      currentRoom: gameState.currentRoom,
      recovered: playerRecovered // Indicate if state was recovered
    });

    // CRITICAL FIX: Send full game state immediately to new player
    // This ensures they see all existing players, zombies, etc. right away
    const publicPlayers = sanitizePlayersState(gameState.players);
    socket.emit('gameState', {
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
    registerDisconnectHandler(socket, gameState, entityManager, sessionId, accountId);

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
  socket.on('playerMove', safeHandler('playerMove', function (data) {
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
    const distance = Math.sqrt(
      Math.pow(newX - player.x, 2) + Math.pow(newY - player.y, 2)
    );

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
      socket.emit('positionCorrection', { x: player.x, y: player.y });
      socket.emit('stunned', { duration: player.stunnedUntil - now }); // Notifier le client
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
    const accrued = timeDelta * PIXELS_PER_MS * speedMultiplier * boostMultiplier * ACCRUAL_FACTOR;

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
      // DISABLE ANTI-CHEAT FOR NOW: Always accept movement to prevent rollback issues for laggy clients
      // socket.emit('positionCorrection', { x: player.x, y: player.y });
      // return;
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
          socket.emit('positionCorrection', { x: player.x, y: player.y });
        }
      }
    }

    player.angle = validatedData.angle;

    // Mettre à jour le timestamp d'activité
    player.lastActivityTime = Date.now();

    // MODE INFINI - Pas de portes ni de changements de salle
  }));
}

/**
 * Register shoot handler
 */
function registerShootHandler(socket, gameState, entityManager) {
  socket.on('shoot', safeHandler('shoot', function (data) {
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

    // Appliquer le multiplicateur de cadence de tir
    const fireRate = weapon.fireRate * (player.fireRateMultiplier || 1);

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
      let damage = weapon.damage * (player.damageMultiplier || 1);

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
        explosionRadius: weapon.hasExplosion ? weapon.explosionRadius : (player.explosionRadius || 0),
        explosionDamagePercent: weapon.hasExplosion ? 1 : (player.explosionDamagePercent || 0),
        rocketExplosionDamage: weapon.hasExplosion ? weapon.explosionDamage : 0,
        isRocket: weapon.hasExplosion && !weapon.isGrenade || false,
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
  }));
}

/**
 * Register respawn handler
 */
function registerRespawnHandler(socket, gameState, entityManager) {
  socket.on('respawn', safeHandler('respawn', function () {
    const player = gameState.players[socket.id];
    if (player) {
      player.lastActivityTime = Date.now(); // Mettre à jour l'activité

      // Sauvegarder les upgrades permanents et la progression
      const savedUpgrades = { ...player.upgrades };
      const savedMultipliers = {
        damage: player.damageMultiplier,
        speed: player.speedMultiplier,
        fireRate: player.fireRateMultiplier
      };
      const savedProgression = {
        level: player.level,
        xp: player.xp
      };
      // Sauvegarder les stats de level-up pour les restaurer après respawn
      const savedLevelUpStats = {
        regeneration: player.regeneration,
        bulletPiercing: player.bulletPiercing,
        lifeSteal: player.lifeSteal,
        criticalChance: player.criticalChance,
        goldMagnetRadius: player.goldMagnetRadius,
        dodgeChance: player.dodgeChance,
        explosiveRounds: player.explosiveRounds,
        explosionRadius: player.explosionRadius,
        explosionDamagePercent: player.explosionDamagePercent,
        extraBullets: player.extraBullets,
        thorns: player.thorns,
        autoTurrets: player.autoTurrets
      };

      // Calculer la vie maximale avec les upgrades
      const baseMaxHealth = CONFIG.PLAYER_MAX_HEALTH;
      const upgradeHealth = (savedUpgrades.maxHealth || 0) * 20;
      const totalMaxHealth = baseMaxHealth + upgradeHealth;

      // Réinitialiser le run (Permadeath mais garde les upgrades permanents)
      player.nickname = null; // Réinitialiser le pseudo
      player.hasNickname = false;

      // CORRECTION: Nettoyer les balles de la vie précédente
      cleanupPlayerBullets(socket.id, gameState, entityManager);

      player.spawnProtection = false;
      player.spawnProtectionEndTime = 0;
      player.invisible = false;
      player.invisibleEndTime = 0;
      // Add random spawn offset to prevent players spawning on top of each other
      // Safe spawn zone: wallThickness + playerSize as minimum margin from walls
      const respawnWallThickness = CONFIG.WALL_THICKNESS || 40;
      const respawnPlayerSize = CONFIG.PLAYER_SIZE || 20;
      const respawnSafeMargin = respawnWallThickness + respawnPlayerSize + 20; // Extra 20px safety buffer

      const respawnOffsetX = (Math.random() - 0.5) * 100; // ±50px horizontally
      const respawnOffsetY = Math.random() * 40; // 0-40px variation (always towards center)

      player.x = CONFIG.ROOM_WIDTH / 2 + respawnOffsetX;
      player.y = CONFIG.ROOM_HEIGHT - respawnSafeMargin - 50 - respawnOffsetY;
      player.health = totalMaxHealth;
      player.maxHealth = totalMaxHealth;
      player.alive = true;
      // NOUVEAU: Conserver le niveau et l'XP après la mort
      player.level = savedProgression.level;
      player.xp = savedProgression.xp;
      player.gold = 0; // L'or est perdu au respawn
      player.score = 0;
      player.weapon = 'pistol';
      player.speedBoost = null;
      player.weaponTimer = null;
      player.lastShot = 0;

      // CORRECTION: Réinitialiser les statistiques de run
      player.zombiesKilled = 0;
      player.kills = 0;
      player.combo = 0;
      player.comboTimer = 0;
      player.highestCombo = 0;
      player.totalScore = 0;

      // NOUVEAU: Restaurer les stats de level-up (conservées avec le niveau)
      player.regeneration = savedLevelUpStats.regeneration;
      player.bulletPiercing = savedLevelUpStats.bulletPiercing;
      player.lifeSteal = savedLevelUpStats.lifeSteal;
      player.criticalChance = savedLevelUpStats.criticalChance;
      player.goldMagnetRadius = savedLevelUpStats.goldMagnetRadius;
      player.dodgeChance = savedLevelUpStats.dodgeChance;
      player.explosiveRounds = savedLevelUpStats.explosiveRounds;
      player.explosionRadius = savedLevelUpStats.explosionRadius;
      player.explosionDamagePercent = savedLevelUpStats.explosionDamagePercent;
      player.extraBullets = savedLevelUpStats.extraBullets;
      player.thorns = savedLevelUpStats.thorns;
      player.autoTurrets = savedLevelUpStats.autoTurrets;
      player.lastRegenTick = Date.now();
      player.lastAutoShot = Date.now();

      // Restaurer les upgrades permanents
      player.upgrades = savedUpgrades;
      player.damageMultiplier = savedMultipliers.damage;
      player.speedMultiplier = savedMultipliers.speed;
      player.fireRateMultiplier = savedMultipliers.fireRate;

    }
  }));
}

/**
 * Register selectUpgrade handler
 */
function registerSelectUpgradeHandler(socket, gameState) {
  socket.on('selectUpgrade', safeHandler('selectUpgrade', function (data) {
    // VALIDATION: Vérifier et sanitize les données d'entrée
    const validatedData = validateUpgradeData(data);
    if (!validatedData) {
      logger.warn('Invalid upgrade data received', { socketId: socket.id, data });
      socket.emit('error', {
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

    // Appliquer l'effet de l'upgrade
    upgrade.effect(player);

    // Désactiver l'invisibilité - le joueur redevient visible dès qu'il choisit une amélioration
    player.invisible = false;
    player.invisibleEndTime = 0;

    socket.emit('upgradeSelected', { success: true, upgradeId: validatedData.upgradeId });
  }));
}

/**
 * Register buyItem handler
 */
function registerBuyItemHandler(socket, gameState) {
  socket.on('buyItem', safeHandler('buyItem', function (data) {
    console.log('[Shop Server] Buy item request received:', data, 'from socket:', socket.id);

    // VALIDATION: Vérifier et sanitize les données d'entrée
    const validatedData = validateBuyItemData(data);
    if (!validatedData) {
      logger.warn('Invalid buy item data received', { socketId: socket.id, data });
      socket.emit('shopUpdate', {
        success: false,
        message: 'Item invalide'
      });
      return;
    }

    // Rate limiting
    if (!checkRateLimit(socket.id, 'buyItem')) {
      console.log('[Shop Server] Rate limit exceeded for socket:', socket.id);
      return;
    }

    const player = gameState.players[socket.id];
    if (!player || !player.alive || !player.hasNickname) {
      console.log('[Shop Server] Player not valid:', { exists: !!player, alive: player?.alive, hasNickname: player?.hasNickname });
      return;
    }

    console.log('[Shop Server] Player gold before purchase:', player.gold);

    player.lastActivityTime = Date.now(); // Mettre à jour l'activité

    const { itemId, category } = validatedData;

    if (category === 'permanent') {
      const item = SHOP_ITEMS.permanent[itemId];
      // Double vérification (déjà fait dans validateBuyItemData, mais par sécurité)
      if (!item) {
        logger.error('Item validation failed', { itemId, category });
        return;
      }

      const currentLevel = player.upgrades[itemId] || 0;

      // Vérifier si déjà au max
      if (currentLevel >= item.maxLevel) {
        socket.emit('shopUpdate', { success: false, message: 'Niveau maximum atteint' });
        return;
      }

      // Calculer le coût
      const cost = item.baseCost + (currentLevel * item.costIncrease);

      // Vérifier si le joueur a assez d'or
      if (player.gold < cost) {
        socket.emit('shopUpdate', { success: false, message: 'Or insuffisant' });
        return;
      }

      // Déduire l'or
      player.gold -= cost;

      // Augmenter le niveau de l'upgrade
      player.upgrades[itemId] = currentLevel + 1;

      // Appliquer l'effet
      item.effect(player);

      console.log('[Shop Server] Permanent item purchased successfully:', itemId, 'New level:', player.upgrades[itemId], 'Gold remaining:', player.gold);
      socket.emit('shopUpdate', { success: true, itemId, category });

    } else if (category === 'temporary') {
      const item = SHOP_ITEMS.temporary[itemId];
      // Double vérification (déjà fait dans validateBuyItemData, mais par sécurité)
      if (!item) {
        logger.error('Temporary item validation failed', { itemId, category });
        return;
      }

      // Vérifier si le joueur a assez d'or
      if (player.gold < item.cost) {
        socket.emit('shopUpdate', { success: false, message: 'Or insuffisant' });
        return;
      }

      // Déduire l'or
      player.gold -= item.cost;

      // Appliquer l'effet
      item.effect(player);

      console.log('[Shop Server] Temporary item purchased successfully:', itemId, 'Gold remaining:', player.gold);
      socket.emit('shopUpdate', { success: true, itemId, category });
    }
  }));
}

/**
 * Register setNickname handler
 */
function registerSetNicknameHandler(socket, gameState, io, container) {
  socket.on('setNickname', safeHandler('setNickname', async function (data) {
    const player = gameState.players[socket.id];
    if (!player) {
      return;
    }

    // CORRECTION CRITIQUE: Vérifier si le joueur a déjà un pseudo AVANT rate limiting
    if (player.hasNickname) {
      socket.emit('nicknameRejected', {
        reason: 'Vous avez déjà choisi un pseudo'
      });
      return;
    }

    // Rate limiting
    if (!checkRateLimit(socket.id, 'setNickname')) {
      socket.emit('nicknameRejected', {
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
      socket.emit('nicknameRejected', {
        reason: 'Le pseudo doit contenir au moins 2 caractères alphanumériques'
      });
      return;
    }

    // Vérifier si le pseudo n'est pas déjà pris par un autre joueur
    const isDuplicate = Object.values(gameState.players).some(
      p => p.id !== socket.id && p.nickname && p.nickname.toLowerCase() === nickname.toLowerCase()
    );

    if (isDuplicate) {
      socket.emit('nicknameRejected', {
        reason: 'Ce pseudo est déjà utilisé par un autre joueur'
      });
      return;
    }

    player.nickname = nickname;
    player.hasNickname = true;
    player.spawnProtection = true;
    player.spawnProtectionEndTime = Date.now() + 3000; // 3 secondes de protection

    logger.info('Player chose nickname', { socketId: socket.id, nickname });

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
          logger.info('Player created in database', { accountId, username: nickname });
        }
      } catch (error) {
        // Log but don't block gameplay - player creation is optional for progression features
        logger.warn('Failed to ensure player exists in database', {
          accountId,
          username: nickname,
          error: error.message
        });
      }
    }

    // Notifier tous les joueurs
    io.emit('playerNicknameSet', {
      playerId: socket.id,
      nickname: nickname
    });
  }));
}

/**
 * Register spawn protection handlers
 */
function registerSpawnProtectionHandlers(socket, gameState) {
  socket.on('endSpawnProtection', safeHandler('endSpawnProtection', function () {
    const player = gameState.players[socket.id];
    if (!player || !player.hasNickname) {
      return;
    }

    player.lastActivityTime = Date.now(); // Mettre à jour l'activité

    player.spawnProtection = false;
    logger.info('Spawn protection ended', { player: player.nickname || socket.id });
  }));
}

/**
 * Register shop handlers
 */
function registerShopHandlers(socket, gameState) {
  socket.on('shopOpened', safeHandler('shopOpened', function () {
    const player = gameState.players[socket.id];
    if (!player || !player.alive || !player.hasNickname) {
      return;
    }

    player.lastActivityTime = Date.now(); // Mettre à jour l'activité

    player.invisible = true;
    player.invisibleEndTime = Infinity; // Invisibilité sans limite de temps
    logger.info('Player invisible - shop opened', { player: player.nickname || socket.id });
  }));

  socket.on('shopClosed', safeHandler('shopClosed', function () {
    const player = gameState.players[socket.id];
    if (!player || !player.alive || !player.hasNickname) {
      return;
    }

    player.lastActivityTime = Date.now(); // Mettre à jour l'activité

    player.invisible = false;
    player.invisibleEndTime = 0;
    logger.info('Player visible - shop closed', { player: player.nickname || socket.id });
  }));
}

/**
 * Register ping handler for latency monitoring
 */
function registerPingHandler(socket) {
  socket.on('ping', safeHandler('ping', function (timestamp, callback) {
    // Respond immediately to measure round-trip time
    if (typeof callback === 'function') {
      callback(Date.now());
    }
  }));
}

/**
 * Register disconnect handler
 */
function registerDisconnectHandler(socket, gameState, entityManager, sessionId, accountId) {
  socket.on('disconnect', safeHandler('disconnect', function () {
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
        // Create a safe copy of player state (avoiding circular references)
        const playerStateCopy = {
          id: player.id,
          accountId: accountId,
          nickname: player.nickname,
          hasNickname: player.hasNickname,
          spawnProtection: player.spawnProtection,
          spawnProtectionEndTime: player.spawnProtectionEndTime,
          invisible: player.invisible,
          invisibleEndTime: player.invisibleEndTime,
          lastActivityTime: player.lastActivityTime,
          x: player.x,
          y: player.y,
          health: player.health,
          maxHealth: player.maxHealth,
          level: player.level,
          xp: player.xp,
          gold: player.gold,
          score: player.score,
          alive: player.alive,
          angle: player.angle,
          weapon: player.weapon,
          lastShot: player.lastShot,
          speedBoost: player.speedBoost,
          weaponTimer: player.weaponTimer,
          kills: player.kills,
          zombiesKilled: player.zombiesKilled,
          combo: player.combo,
          comboTimer: player.comboTimer,
          highestCombo: player.highestCombo,
          totalScore: player.totalScore,
          survivalTime: player.survivalTime,
          upgrades: { ...player.upgrades },
          damageMultiplier: player.damageMultiplier,
          speedMultiplier: player.speedMultiplier,
          fireRateMultiplier: player.fireRateMultiplier,
          regeneration: player.regeneration,
          bulletPiercing: player.bulletPiercing,
          lifeSteal: player.lifeSteal,
          criticalChance: player.criticalChance,
          goldMagnetRadius: player.goldMagnetRadius,
          dodgeChance: player.dodgeChance,
          explosiveRounds: player.explosiveRounds,
          explosionRadius: player.explosionRadius,
          explosionDamagePercent: player.explosionDamagePercent,
          extraBullets: player.extraBullets,
          thorns: player.thorns,
          lastRegenTick: player.lastRegenTick,
          autoTurrets: player.autoTurrets,
          lastAutoShot: player.lastAutoShot
        };

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
  }));
}

module.exports = {
  initSocketHandlers,
  // MEMORY LEAK FIX: Export cleanup function for graceful shutdown
  stopSessionCleanupInterval
};
