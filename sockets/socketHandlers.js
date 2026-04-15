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

const crypto = require('crypto');
const logger = require('../lib/infrastructure/Logger');
const MetricsCollector = require('../lib/infrastructure/MetricsCollector');
const { SOCKET_EVENTS } = require('../shared/socketEvents');
const ConfigManager = require('../lib/server/ConfigManager');
const { cleanupPlayerBullets } = require('../game/utilityFunctions');
// validateMovementData + validateShootData both now live in their extracted handlers
const { createPlayerState } = require('./playerStateFactory');
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
const {
  registerBuyItemHandler,
  registerShopHandlers
} = require('../transport/websocket/handlers/shop');

const { CONFIG, WEAPONS, POWERUP_TYPES, ZOMBIE_TYPES, SHOP_ITEMS } = ConfigManager;

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
    // Propagate trace_id from handshake auth or generate one for this connection
    const traceId =
      socket.handshake.auth?.traceId ||
      socket.handshake.headers?.['x-trace-id'] ||
      crypto.randomUUID();
    socket.traceId = traceId;

    logger.info('Player connected', {
      socketId: socket.id,
      sessionId: sessionId || 'none',
      accountId: accountId || 'none',
      traceId
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
    const stopZombieHeartbeat = startZombieHeartbeat(socket);
    registerDisconnectHandler(
      socket,
      gameState,
      entityManager,
      sessionId,
      accountId,
      networkManager,
      stopZombieHeartbeat
    );

    // Register admin commands handlers
    if (gameState.adminCommands) {
      gameState.adminCommands.registerCommands(socket);
    }
  };
}

// Player-move handler moved to transport/websocket/handlers/playerMove.js
const { registerPlayerMoveHandler } = require('../transport/websocket/handlers/playerMove');

// Shoot handler moved to transport/websocket/handlers/shoot.js
const { registerShootHandler } = require('../transport/websocket/handlers/shoot');

/**
 * Register respawn handler
 */
// Respawn handler moved to transport/websocket/handlers/respawn.js
const { registerRespawnHandler } = require('../transport/websocket/handlers/respawn');

/* SELECTUPGRADE handler moved to transport/websocket/handlers/selectUpgrade.js */
const { registerSelectUpgradeHandler } = require('../transport/websocket/handlers/selectUpgrade');
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
      const rawNick = typeof data.nickname === 'string' ? data.nickname.slice(0, 20) : '';
      let nickname = rawNick.trim();

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

// Spawn-protection handler moved to transport/websocket/handlers/spawnProtection.js
const { registerSpawnProtectionHandlers } = require('../transport/websocket/handlers/spawnProtection');

// Ping handler moved to transport/websocket/handlers/ping.js
// Kept here as a re-export for backward compatibility during the refactor.
const { registerPingHandler } = require('../transport/websocket/handlers/ping');

/**
 * Start a per-socket heartbeat to detect zombie clients.
 * Emits a server-side ping; if no pong arrives within ZOMBIE_PONG_TIMEOUT,
 * the socket is forcibly disconnected.
 *
 * @param {Object} socket - Socket.IO socket
 * @returns {Function} cleanup — call on disconnect to stop the timer
 */
function startZombieHeartbeat(socket) {
  // No-op: socket.io has its own ping/pong (pingInterval/pingTimeout in server config).
  // The previous custom implementation expected client ack callbacks that don't exist
  // and silently kicked every legitimate client after 10s.
  // Returns a no-op cleanup so callers don't crash.
  void socket;
  return function noop() {};
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
  networkManager = null,
  stopZombieHeartbeat = null
) {
  socket.on(
    SOCKET_EVENTS.SYSTEM.DISCONNECT,
    safeHandler('disconnect', function () {
      // Stop zombie heartbeat timer to prevent dangling timers
      if (stopZombieHeartbeat) {
        stopZombieHeartbeat();
      }

      const player = gameState.players[socket.id];

      logger.info('Player disconnected', {
        socketId: socket.id,
        sessionId: sessionId || 'none',
        accountId: accountId || 'none'
      });
      MetricsCollector.getInstance().clearViolations(socket.id);

      // SESSION RECOVERY: Save player state for recovery if session exists.
      // BUGFIX: removed accountId requirement — anonymous sessions also need
      // recovery, otherwise the next reconnect re-creates a player with the
      // same nickname and CreatePlayerUseCase throws ConflictError, spamming
      // 'Username already taken' in prod logs.
      if (sessionId && player) {
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
