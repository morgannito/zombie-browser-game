/**
 * @fileoverview WebSocket transport — canonical entry-point.
 * @description Bootstraps the Socket.IO connection lifecycle:
 *   - session recovery / new player creation
 *   - INIT + GAME_STATE snapshot emit
 *   - per-context handler registration
 *   - admin command attachment
 *
 * All event-body code lives under ./handlers/. Cross-cutting helpers come
 * from ./events.js (event constants) and ../../contexts/session/ (recovery).
 */

const crypto = require('crypto');
const logger = require('../../infrastructure/logging/Logger');
const { SOCKET_EVENTS } = require('./events');
const ConfigManager = require('../../lib/server/ConfigManager');
const { createPlayerState } = require('../../contexts/session/playerStateFactory');
const {
  disconnectedPlayers,
  startSessionCleanupInterval,
  stopSessionCleanupInterval,
  normalizeSessionId,
  sanitizePlayersState,
  restoreRecoverablePlayerState
} = require('../../contexts/session/sessionRecovery');

const { registerPlayerMoveHandler } = require('./handlers/playerMove');
const { registerShootHandler } = require('./handlers/shoot');
const { registerRespawnHandler } = require('./handlers/respawn');
const { registerSelectUpgradeHandler } = require('./handlers/selectUpgrade');
const { registerBuyItemHandler, registerShopHandlers } = require('./handlers/shop');
const { registerSetNicknameHandler } = require('./handlers/setNickname');
const { registerSpawnProtectionHandlers } = require('./handlers/spawnProtection');
const { registerPingHandler } = require('./handlers/ping');
const { registerDisconnectHandler } = require('./handlers/disconnect');
const { registerRequestFullStateHandler } = require('./handlers/requestFullState');

const { CONFIG, WEAPONS, POWERUP_TYPES, ZOMBIE_TYPES, SHOP_ITEMS } = ConfigManager;

// Auto-start session-cleanup interval on module load (memory-leak guard).
startSessionCleanupInterval(logger);

function attachTraceContext(socket) {
  const traceId =
    socket.handshake.auth?.traceId ||
    socket.handshake.headers?.['x-trace-id'] ||
    crypto.randomUUID();
  socket.traceId = traceId;
  return traceId;
}

function tryRecoverSession(socket, sessionId, accountId, gameState) {
  if (!sessionId || !disconnectedPlayers.has(sessionId)) {
    return false;
  }
  const savedData = disconnectedPlayers.get(sessionId);
  const elapsed = Date.now() - savedData.disconnectedAt;
  if (accountId && savedData.accountId && savedData.accountId !== accountId) {
    logger.warn('Session recovery refused - account mismatch', {
      sessionId,
      accountId,
      savedAccountId: savedData.accountId
    });
    return false;
  }
  logger.info('Session recovery found', {
    sessionId,
    disconnectedSecs: Math.round(elapsed / 1000)
  });
  const restoredAccountId = accountId || savedData.accountId || null;
  const restoredPlayer = restoreRecoverablePlayerState(
    savedData.playerState,
    socket.id,
    sessionId,
    restoredAccountId
  );
  gameState.players[socket.id] = restoredPlayer;
  disconnectedPlayers.delete(sessionId);
  logger.info('Player session restored', {
    sessionId,
    nickname: restoredPlayer.nickname || 'Unknown',
    level: restoredPlayer.level,
    health: restoredPlayer.health,
    maxHealth: restoredPlayer.maxHealth,
    gold: restoredPlayer.gold
  });
  return true;
}

function rejectIfServerFull(socket, perfIntegration, gameState) {
  const playerCount = Object.keys(gameState.players).length;
  if (perfIntegration.canAcceptPlayer(playerCount)) {
    return false;
  }
  logger.warn('Player connection rejected - server full', {
    currentPlayers: playerCount,
    maxPlayers: perfIntegration.perfConfig.current.maxPlayers
  });
  socket.emit(SOCKET_EVENTS.SERVER.SERVER_FULL, {
    message: 'Serveur complet. Réessayez plus tard.',
    currentPlayers: playerCount
  });
  socket.disconnect();
  return true;
}

function spawnNewPlayer(socket, sessionId, accountId, gameState, perfIntegration) {
  if (rejectIfServerFull(socket, perfIntegration, gameState)) {
    return false;
  }
  gameState.players[socket.id] = createPlayerState(CONFIG, socket.id, sessionId || null, accountId);
  return true;
}

function applySkillBonuses(socket, accountId, gameState) {
  const player = gameState.players[socket.id];
  if (!accountId || !player || !gameState.progressionIntegration) {
    return;
  }
  gameState.progressionIntegration
    .applySkillBonusesOnSpawn(player, accountId, CONFIG)
    .then(() =>
      logger.info('Skill bonuses applied', {
        socketId: socket.id,
        accountId,
        health: player.health,
        maxHealth: player.maxHealth
      })
    )
    .catch(error =>
      logger.error('Failed to apply skill bonuses', {
        socketId: socket.id,
        accountId,
        error: error.message
      })
    );
}

function emitInitSnapshot(socket, gameState, recovered) {
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
    recovered
  });
  socket.emit(SOCKET_EVENTS.SERVER.GAME_STATE, {
    players: sanitizePlayersState(gameState.players),
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
}

function registerAllHandlers(socket, deps) {
  const {
    gameState,
    io,
    entityManager,
    roomManager,
    container,
    networkManager,
    sessionId,
    accountId
  } = deps;
  registerPlayerMoveHandler(socket, gameState, roomManager);
  registerShootHandler(socket, gameState, entityManager);
  registerRespawnHandler(socket, gameState, entityManager);
  registerSelectUpgradeHandler(socket, gameState);
  registerBuyItemHandler(socket, gameState);
  registerSetNicknameHandler(socket, gameState, io, container);
  registerSpawnProtectionHandlers(socket, gameState);
  registerShopHandlers(socket, gameState);
  registerPingHandler(socket);
  registerRequestFullStateHandler(socket, gameState, emitInitSnapshot);
  // socket.io has its own ping/pong; the legacy custom heartbeat used to
  // kick legitimate clients after 10s. Stub kept for disconnect signature.
  const stopZombieHeartbeat = () => {};
  registerDisconnectHandler(
    socket,
    gameState,
    entityManager,
    sessionId,
    accountId,
    networkManager,
    stopZombieHeartbeat
  );
  if (gameState.adminCommands) {
    gameState.adminCommands.registerCommands(socket);
  }
}

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
    const traceId = attachTraceContext(socket);
    logger.info('Player connected', {
      socketId: socket.id,
      sessionId: sessionId || 'none',
      accountId: accountId || 'none',
      traceId
    });

    // Evict any existing socket sharing the same sessionId (multi-tab guard).
    if (sessionId) {
      for (const [id, s] of io.sockets.sockets) {
        if (id !== socket.id && s.sessionId === sessionId) {
          s.emit('sessionReplaced', { reason: 'another tab connected' });
          s.disconnect(true);
          break;
        }
      }
    }
    socket.sessionId = sessionId || null;

    const recovered = tryRecoverSession(socket, sessionId, accountId, gameState);
    if (!recovered) {
      logger.info('Creating new player', { socketId: socket.id });
      const ok = spawnNewPlayer(socket, sessionId, accountId, gameState, perfIntegration);
      if (!ok) {
        return;
      }
      metricsCollector.incrementTotalPlayers();
    }
    applySkillBonuses(socket, accountId, gameState);
    emitInitSnapshot(socket, gameState, recovered);
    registerAllHandlers(socket, {
      gameState,
      io,
      entityManager,
      roomManager,
      container,
      networkManager,
      sessionId,
      accountId
    });
  };
}

module.exports = { initSocketHandlers, stopSessionCleanupInterval, emitInitSnapshot };
