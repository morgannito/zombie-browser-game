/**
 * @fileoverview Heartbeat / inactivity cleanup interval.
 * @description Detects orphaned player objects and timed-out players, evicts
 *   them safely (mark-then-delete to avoid mutation during iteration), and
 *   reports counts to the metrics collector.
 */

const logger = require('../infrastructure/logging/Logger');
const MetricsCollector = require('../infrastructure/metrics/MetricsCollector');
const { cleanupRateLimits } = require('../sockets/rateLimitStore');

function isOrphan(player) {
  return !player || typeof player !== 'object';
}

function ensureActivityTimestamp(player, now) {
  if (!player.lastActivityTime || typeof player.lastActivityTime !== 'number') {
    player.lastActivityTime = now;
    logger.warn('Player missing lastActivityTime, initialized', {
      nickname: player.nickname
    });
    return false;
  }
  return true;
}

function disconnectStaleSocket(player, io) {
  if (!player.socketId) {
return;
}
  const socket = io.sockets.sockets.get(player.socketId);
  if (socket) {
socket.disconnect(true);
}
}

function evictPlayers(gameState, networkManager, ids) {
  const metrics = MetricsCollector.getInstance();
  for (const playerId of ids) {
    delete gameState.players[playerId];
    if (networkManager) {
      networkManager.cleanupPlayer(playerId);
    }
    if (typeof metrics.clearViolations === 'function') {
      metrics.clearViolations(playerId);
    }
    cleanupRateLimits(playerId);
  }
}

function reportCleanup(metricsCollector, gameState, cleanedUp, orphanedObjects, now) {
  logger.info('Heartbeat cleanup completed', {
    playersRemoved: cleanedUp,
    orphanedObjects,
    remainingPlayers: Object.keys(gameState.players).length,
    timestamp: now
  });
  if (metricsCollector) {
    metricsCollector.recordCleanup({ playersRemoved: cleanedUp, orphaned: orphanedObjects });
  }
}

function evictTimedOutPlayer(player, playerId, io, playersToDelete) {
  logger.info('Player timeout', {
    player: player.nickname || playerId,
    inactiveDuration: Date.now() - player.lastActivityTime,
    wasConnected: !!player.socketId
  });
  disconnectStaleSocket(player, io);
  playersToDelete.push(playerId);
}

function scanPlayers(gameState, io, inactivityTimeout, now) {
  const playerIds = Object.keys(gameState.players).slice();
  const playersToDelete = [];
  let cleanedUp = 0;
  let orphanedObjects = 0;

  for (const playerId of playerIds) {
    const player = gameState.players[playerId];
    if (isOrphan(player)) {
      logger.warn('Orphaned player object detected', { playerId });
      playersToDelete.push(playerId);
      orphanedObjects++;
      cleanedUp++;
      continue;
    }
    if (!ensureActivityTimestamp(player, now)) {
 continue;
}
    if (now - player.lastActivityTime > inactivityTimeout) {
      evictTimedOutPlayer(player, playerId, io, playersToDelete);
      cleanedUp++;
    }
  }
  return { playersToDelete, cleanedUp, orphanedObjects };
}

/**
 * Start the heartbeat interval. Returns a stop() function for cleanup.
 * @param {{gameState, io, networkManager, metricsCollector,
 *          inactivityTimeout, interval}} deps
 * @returns {{timer: NodeJS.Timer, stop: () => void}}
 */
function startHeartbeat(deps) {
  const { gameState, io, networkManager, metricsCollector, inactivityTimeout, interval } = deps;
  let inProgress = false;

  const timer = setInterval(() => {
    if (inProgress) {
return;
}
    inProgress = true;
    try {
      const now = Date.now();
      const { playersToDelete, cleanedUp, orphanedObjects } = scanPlayers(
        gameState, io, inactivityTimeout, now
      );
      evictPlayers(gameState, networkManager, playersToDelete);
      if (cleanedUp > 0) {
        reportCleanup(metricsCollector, gameState, cleanedUp, orphanedObjects, now);
      }
    } finally {
      inProgress = false;
    }
  }, interval);

  return { timer, stop: () => clearInterval(timer) };
}

module.exports = {
  startHeartbeat,
  // Exported for unit tests
  isOrphan,
  ensureActivityTimestamp,
  scanPlayers,
  evictPlayers
};
