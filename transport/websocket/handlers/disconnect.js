/**
 * @fileoverview Disconnect handler.
 * @description Releases per-socket resources (bullets, rate-limit state,
 * metrics violations) and, when a session is in play, snapshots the player
 * state so reconnects within SESSION_RECOVERY_TIMEOUT can restore progress.
 * Ninth slice of the socketHandlers split.
 */

const { SOCKET_EVENTS } = require('../events');
const { safeHandler } = require('../../../sockets/socketUtils');
const { cleanupRateLimits } = require('../../../sockets/rateLimitStore');
const { cleanupPlayerBullets } = require('../../../game/utilityFunctions');
const {
  disconnectedPlayers,
  createRecoverablePlayerState
} = require('../../../contexts/session/sessionRecovery');
const logger = require('../../../infrastructure/logging/Logger');
const MetricsCollector = require('../../../infrastructure/metrics/MetricsCollector');
const { SESSION_RECOVERY_TIMEOUT } = require('../../../config/constants');

/**
 * Register the disconnect handler on a socket.
 * Saves recoverable session state and cleans up bullets, rate-limits, and network queues.
 * @param {import('socket.io').Socket} socket
 * @param {Object} gameState
 * @param {Object} entityManager
 * @param {string|null} sessionId
 * @param {string|null} accountId
 * @param {Object|null} networkManager
 * @param {Function|null} stopZombieHeartbeat
 * @returns {void}
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
        if (player.hasNickname) {
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

module.exports = { registerDisconnectHandler };
