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
const { loadRoom } = require('../game/roomFunctions');
const {
  validateMovementData,
  validateShootData,
  validateUpgradeData,
  validateBuyItemData
} = require('../game/validationFunctions');

const { CONFIG, WEAPONS, POWERUP_TYPES, ZOMBIE_TYPES, SHOP_ITEMS, LEVEL_UP_UPGRADES } = ConfigManager;
const { SESSION_RECOVERY_TIMEOUT } = require('../config/constants');
const MathUtils = require('../lib/MathUtils');

/**
 * Map to store disconnected player states for recovery
 * Key: sessionId, Value: { playerState, disconnectedAt, previousSocketId }
 * States are kept for 5 minutes after disconnection
 */
const disconnectedPlayers = new Map();

/**
 * Periodically clean up expired session recovery states
 */
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sessionId, data] of disconnectedPlayers.entries()) {
    if (now - data.disconnectedAt > SESSION_RECOVERY_TIMEOUT) {
      disconnectedPlayers.delete(sessionId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`[SESSION RECOVERY] Cleaned ${cleanedCount} expired session(s)`);
  }
}, 60000); // Check every minute

/**
 * Rate limiting system
 */
const rateLimits = new Map();

const { RATE_LIMIT_CONFIG } = require('../config/constants');

function checkRateLimit(socketId, eventName) {
  const config = RATE_LIMIT_CONFIG[eventName];
  if (!config) return true;

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
    console.warn(`[RATE LIMIT] Player ${socketId} exceeded rate limit for ${eventName}`);
    return false;
  }

  return true;
}

function cleanupRateLimits(socketId) {
  rateLimits.delete(socketId);
}

/**
 * Safe socket handler wrapper - Gestion d'erreurs
 * @param {string} handlerName - Nom du handler pour le logging
 * @param {Function} handler - Fonction handler à wrapper
 * @returns {Function} Handler wrappé avec gestion d'erreurs
 */
function safeHandler(handlerName, handler) {
  return function (...args) {
    try {
      handler.apply(this, args);
    } catch (error) {
      logger.error('Socket handler error', { handler: handlerName, socketId: this.id, error: error.message });
      // Optionnellement notifier le client
      this.emit('error', {
        message: 'Une erreur est survenue sur le serveur',
        code: 'INTERNAL_ERROR'
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
 * @returns {Function} Connection handler
 */
function initSocketHandlers(io, gameState, entityManager, roomManager, metricsCollector, perfIntegration) {
  return (socket) => {
    const sessionId = socket.handshake.auth?.sessionId;

    logger.info('Player connected', { socketId: socket.id, sessionId: sessionId || 'none' });

    // RECOVERY: Check if this session has a saved state
    let playerRecovered = false;
    if (sessionId && disconnectedPlayers.has(sessionId)) {
      const savedData = disconnectedPlayers.get(sessionId);
      const timeSinceDisconnect = Date.now() - savedData.disconnectedAt;

      logger.info('Session recovery found', {
        sessionId,
        disconnectedSecs: Math.round(timeSinceDisconnect / 1000)
      });

      // Restore player state with new socket ID
      const restoredPlayer = {
        ...savedData.playerState,
        id: socket.id, // Update to new socket ID
        lastActivityTime: Date.now() // Reset activity timer
      };

      gameState.players[socket.id] = restoredPlayer;
      disconnectedPlayers.delete(sessionId);
      playerRecovered = true;

      console.log(`[SESSION RECOVERY] Restored player ${restoredPlayer.nickname || 'Unknown'} (Level ${restoredPlayer.level}, ${restoredPlayer.health}/${restoredPlayer.maxHealth} HP, ${restoredPlayer.gold} gold)`);
    }

    // Create new player if no recovery happened
    if (!playerRecovered) {
      console.log(`[SESSION] Creating new player for ${socket.id}`);

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
      gameState.players[socket.id] = {
        id: socket.id,
        nickname: null, // Pseudo non défini au départ
        hasNickname: false, // Le joueur n'a pas encore choisi de pseudo
        spawnProtection: false, // Protection de spawn inactive
        spawnProtectionEndTime: 0, // Fin de la protection
        invisible: false, // Invisibilité après upgrade ou lors du level up
        invisibleEndTime: 0, // Fin de l'invisibilité
        lastActivityTime: Date.now(), // Pour détecter l'inactivité
        x: CONFIG.ROOM_WIDTH / 2,
        y: CONFIG.ROOM_HEIGHT - 100,
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

    // Register event handlers
    registerPlayerMoveHandler(socket, gameState, roomManager);
    registerShootHandler(socket, gameState, entityManager);
    registerRespawnHandler(socket, gameState, entityManager, roomManager);
    registerSelectUpgradeHandler(socket, gameState);
    registerBuyItemHandler(socket, gameState);
    registerSetNicknameHandler(socket, gameState, io);
    registerSpawnProtectionHandlers(socket, gameState);
    registerShopHandlers(socket, gameState);
    registerPingHandler(socket);
    registerDisconnectHandler(socket, gameState, entityManager, sessionId);
  };
}

/**
 * Register playerMove handler
 */
function registerPlayerMoveHandler(socket, gameState, roomManager) {
  socket.on('playerMove', safeHandler('playerMove', function (data) {
    // JWT Authentication check
    if (!socket.userId) {
      return; // Silent fail for unauthenticated players
    }

    // VALIDATION: Vérifier et sanitize les données d'entrée
    const validatedData = validateMovementData(data);
    if (!validatedData) {
      console.warn(`[VALIDATION] Invalid movement data from ${socket.id}:`, data);
      return;
    }

    // Rate limiting
    if (!checkRateLimit(socket.id, 'playerMove')) return;

    const player = gameState.players[socket.id];
    if (!player || !player.alive || !player.hasNickname) return; // Pas de mouvement sans pseudo

    // Clamp position to map boundaries, accounting for player size to prevent leaving map
    const halfSize = CONFIG.PLAYER_SIZE / 2;
    const newX = Math.max(halfSize, Math.min(CONFIG.ROOM_WIDTH - halfSize, validatedData.x));
    const newY = Math.max(halfSize, Math.min(CONFIG.ROOM_HEIGHT - halfSize, validatedData.y));

    // VALIDATION: Vérifier la distance parcourue pour éviter la téléportation
    const distance = Math.sqrt(
      Math.pow(newX - player.x, 2) + Math.pow(newY - player.y, 2)
    );

    // ANTI-CHEAT: Valider que speedMultiplier n'est pas suspect
    if (player.speedMultiplier > 5) {
      console.warn(`[ANTI-CHEAT] Player ${player.nickname || socket.id} has suspicious speedMultiplier: ${player.speedMultiplier}, resetting to 1`);
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
      console.warn(`[ANTI-CHEAT] Player ${player.nickname || socket.id} rejected: Dist ${Math.round(distance)}px, Budget ${Math.round(player.moveBudget)}px`);
      socket.emit('positionCorrection', { x: player.x, y: player.y });
      return;
    }

    // Deduct cost from budget
    player.moveBudget -= distance;
    // Prevent budget from going too negative (optional, but good for recovery)
    if (player.moveBudget < -100) player.moveBudget = -100;

    // Vérifier collision avec les murs
    if (!roomManager.checkWallCollision(newX, newY, CONFIG.PLAYER_SIZE)) {
      player.x = newX;
      player.y = newY;
    } else {
      // Collision detected - send position correction to client to keep them in sync
      // Only send if the client position is significantly different (> 5px)
      const clientDistance = Math.sqrt(
        Math.pow(newX - player.x, 2) + Math.pow(newY - player.y, 2)
      );
      if (clientDistance > 5) {
        socket.emit('positionCorrection', { x: player.x, y: player.y });
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
      console.warn(`[VALIDATION] Invalid shoot data from ${socket.id}:`, data);
      return;
    }

    // Rate limiting
    if (!checkRateLimit(socket.id, 'shoot')) return;

    const player = gameState.players[socket.id];
    if (!player || !player.alive || !player.hasNickname) return; // Pas de tir sans pseudo

    const now = Date.now();
    player.lastActivityTime = now; // Mettre à jour l'activité

    const weapon = WEAPONS[player.weapon] || WEAPONS.pistol;

    // Appliquer le multiplicateur de cadence de tir
    const fireRate = weapon.fireRate * (player.fireRateMultiplier || 1);

    // Vérifier le cooldown de l'arme
    if (now - player.lastShot < fireRate) return;

    player.lastShot = now;

    // Nombre total de balles (arme + extra bullets)
    const totalBullets = weapon.bulletCount + (player.extraBullets || 0);

    // ANTI-CHEAT: Limiter le nombre total de balles pour éviter l'exploitation
    const MAX_TOTAL_BULLETS = 50;
    if (totalBullets > MAX_TOTAL_BULLETS) {
      console.warn(`[ANTI-CHEAT] Player ${player.nickname || socket.id} has suspicious bullet count: ${totalBullets}, capping to ${MAX_TOTAL_BULLETS}`);
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
      const totalPiercing = (player.bulletPiercing || 0) + (weapon.piercing || 0);

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
function registerRespawnHandler(socket, gameState, entityManager, roomManager) {
  socket.on('respawn', safeHandler('respawn', function () {
    const player = gameState.players[socket.id];
    if (player) {
      player.lastActivityTime = Date.now(); // Mettre à jour l'activité

      // Sauvegarder les upgrades permanents
      const savedUpgrades = { ...player.upgrades };
      const savedMultipliers = {
        damage: player.damageMultiplier,
        speed: player.speedMultiplier,
        fireRate: player.fireRateMultiplier
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
      player.x = CONFIG.ROOM_WIDTH / 2;
      player.y = CONFIG.ROOM_HEIGHT - 100;
      player.health = totalMaxHealth;
      player.maxHealth = totalMaxHealth;
      player.alive = true;
      player.level = 1;
      player.xp = 0;
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

      // CORRECTION: Réinitialiser toutes les stats de level-up (ne pas conserver entre les runs)
      player.regeneration = 0;
      player.bulletPiercing = 0;
      player.lifeSteal = 0;
      player.criticalChance = 0;
      player.goldMagnetRadius = 0;
      player.dodgeChance = 0;
      player.explosiveRounds = 0;
      player.explosionRadius = 0;
      player.explosionDamagePercent = 0;
      player.extraBullets = 0;
      player.thorns = 0;
      player.autoTurrets = 0;
      player.lastRegenTick = Date.now();
      player.lastAutoShot = Date.now();

      // Restaurer les upgrades permanents
      player.upgrades = savedUpgrades;
      player.damageMultiplier = savedMultipliers.damage;
      player.speedMultiplier = savedMultipliers.speed;
      player.fireRateMultiplier = savedMultipliers.fireRate;

      // Recharger depuis la première salle
      loadRoom(0, roomManager);
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
      console.warn(`[VALIDATION] Invalid upgrade data from ${socket.id}:`, data);
      socket.emit('error', {
        message: 'Upgrade invalide',
        code: 'INVALID_UPGRADE'
      });
      return;
    }

    // Rate limiting
    if (!checkRateLimit(socket.id, 'selectUpgrade')) return;

    const player = gameState.players[socket.id];
    if (!player || !player.alive) return;

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
    // VALIDATION: Vérifier et sanitize les données d'entrée
    const validatedData = validateBuyItemData(data);
    if (!validatedData) {
      console.warn(`[VALIDATION] Invalid buy item data from ${socket.id}:`, data);
      socket.emit('shopUpdate', {
        success: false,
        message: 'Item invalide'
      });
      return;
    }

    // Rate limiting
    if (!checkRateLimit(socket.id, 'buyItem')) return;

    const player = gameState.players[socket.id];
    if (!player || !player.alive) return;

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

      socket.emit('shopUpdate', { success: true, itemId, category });
    }
  }));
}

/**
 * Register setNickname handler
 */
function registerSetNicknameHandler(socket, gameState, io) {
  socket.on('setNickname', safeHandler('setNickname', function (data) {
    const player = gameState.players[socket.id];
    if (!player) return;

    // JWT Authentication check
    if (!socket.userId || !socket.username) {
      logger.warn('setNickname called without JWT authentication', {
        socketId: socket.id
      });
      socket.emit('nicknameRejected', {
        reason: 'Authentication required'
      });
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

    // JWT validation: nickname must match authenticated username
    if (nickname.toLowerCase() !== socket.username.toLowerCase()) {
      logger.warn('Nickname mismatch with JWT', {
        provided: nickname,
        expected: socket.username,
        socketId: socket.id
      });
      socket.emit('nicknameRejected', {
        reason: 'Le pseudo doit correspondre à votre compte'
      });
      return;
    }

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

    console.log(`${socket.id} a choisi le pseudo: ${nickname}`);

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
    if (!player) return;

    player.lastActivityTime = Date.now(); // Mettre à jour l'activité

    player.spawnProtection = false;
    console.log(`${player.nickname || socket.id} n'a plus de protection de spawn`);
  }));
}

/**
 * Register shop handlers
 */
function registerShopHandlers(socket, gameState) {
  socket.on('shopOpened', safeHandler('shopOpened', function () {
    const player = gameState.players[socket.id];
    if (!player) return;

    player.lastActivityTime = Date.now(); // Mettre à jour l'activité

    player.invisible = true;
    player.invisibleEndTime = Infinity; // Invisibilité sans limite de temps
    console.log(`${player.nickname || socket.id} est invisible (shop ouvert)`);
  }));

  socket.on('shopClosed', safeHandler('shopClosed', function () {
    const player = gameState.players[socket.id];
    if (!player) return;

    player.lastActivityTime = Date.now(); // Mettre à jour l'activité

    player.invisible = false;
    player.invisibleEndTime = 0;
    console.log(`${player.nickname || socket.id} n'est plus invisible (shop fermé)`);
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
function registerDisconnectHandler(socket, gameState, entityManager, sessionId) {
  socket.on('disconnect', safeHandler('disconnect', function () {
    const player = gameState.players[socket.id];

    logger.info('Player disconnected', { socketId: socket.id, sessionId: sessionId || 'none' });

    // SESSION RECOVERY: Save player state for recovery if session exists
    if (sessionId && player) {
      // Only save state if player has actually started playing (has nickname)
      if (player.hasNickname && player.alive) {
        // Create a deep copy of player state
        const playerStateCopy = JSON.parse(JSON.stringify(player));

        disconnectedPlayers.set(sessionId, {
          playerState: playerStateCopy,
          disconnectedAt: Date.now(),
          previousSocketId: socket.id
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
  initSocketHandlers
};
