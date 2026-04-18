/**
 * @fileoverview Graceful shutdown — extracted from server.js.
 * @description Coordinates safe teardown: stop timers, drain perfIntegration,
 *   stop monitors and session cleanup, close sockets → http → database, with a
 *   10s force-exit watchdog. Also installs SIGTERM/SIGINT and process error
 *   listeners that only escalate to shutdown on true OS-level failures.
 */

const logger = require('../infrastructure/logging/Logger');

const _FATAL_OS_CODES = new Set(['ENOMEM', 'EACCES', 'EADDRINUSE', 'EMFILE']);
const FORCED_EXIT_MS = 30000;

function stopTimers(state) {
  if (state.stopGameLoop) {
    state.stopGameLoop();
    state.stopGameLoop = null;
    logger.info('Game loop stopped');
  }
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
    logger.info('✅ Heartbeat timer stopped');
  }
  if (state.powerupSpawnerTimer) {
    clearInterval(state.powerupSpawnerTimer);
    state.powerupSpawnerTimer = null;
    logger.info('Powerup spawner stopped');
  }
  const zombieManager = state.gameState && state.gameState.zombieManager;
  if (zombieManager && typeof zombieManager.stopZombieSpawner === 'function') {
    zombieManager.stopZombieSpawner();
    logger.info('Zombie spawner stopped');
  }
}

function stopPerfIntegration(perfIntegration) {
  try {
    if (perfIntegration && typeof perfIntegration.cleanup === 'function') {
      perfIntegration.cleanup();
      logger.info('Performance integration timers stopped');
    }
  } catch (e) {
    logger.warn('perfIntegration.cleanup() failed', { error: e && e.message });
  }
}

function stopHazards(gameState) {
  if (!gameState || !gameState.hazardManager) {
return;
}
  try {
    gameState.hazardManager.clearAll();
    logger.info('✅ HazardManager cleaned up');
  } catch (err) {
    logger.error('❌ Error cleaning up HazardManager', {
      error: err.message,
      stack: err.stack
    });
  }
}

function drainSockets(io) {
  const sockets = io && io.sockets && io.sockets.sockets;
  if (!sockets || sockets.size === 0) {
return;
}
  logger.info(`Draining ${sockets.size} active socket(s)...`);
  sockets.forEach(socket => {
    try {
      socket.emit('server:shutdown', { reason: 'Server shutting down', saveState: true });
      socket.disconnect(true);
    } catch (_e) { /* ignore per-socket errors */ }
  });
  logger.info('Active sockets disconnected');
}

/**
 * Drain all sockets, close the Socket.IO server, stop accepting new HTTP
 * connections, close the database, then exit the process.
 *
 * @param {import('socket.io').Server} io
 * @param {import('http').Server} server
 * @param {object} dbManager
 * @param {number} [exitCode=0] - Process exit code (1 on crash, 0 on clean signal)
 */
function closeRuntime(io, server, dbManager, exitCode = 0) {
  drainSockets(io);
  io.close(() => {
    logger.info('All socket connections closed');
    // Stop accepting new HTTP connections (incl. keep-alive)
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    server.close(() => {
      logger.info('HTTP server closed');
      try {
        dbManager.close();
        logger.info('Database connection closed');
        process.exit(exitCode);
      } catch (err) {
        logger.error('Database closure error', { error: err.message });
        process.exit(1);
      }
    });
  });
}

/**
 * Build the cleanup runtime: returns {cleanupServer, install} bound to the
 * provided dependencies. install() registers signal + process-error listeners.
 *
 * @param {{io, server, dbManager, perfIntegration, memoryMonitor,
 *          stopSessionCleanupInterval, getState: () => Object}} deps
 */
function createCleanup(deps) {
  const { io, server, dbManager, perfIntegration,
    memoryMonitor, stopSessionCleanupInterval, getState } = deps;
  let isShuttingDown = false;

  /**
   * Orchestrate graceful shutdown. Idempotent — a second call while shutdown is
   * already in progress is silently ignored.
   *
   * @param {number} [exitCode=0] - Process exit code forwarded to closeRuntime
   */
  function cleanupServer(exitCode = 0) {
    if (isShuttingDown) {
      logger.warn('⚠️  Shutdown already in progress, ignoring signal');
      return;
    }
    isShuttingDown = true;
    logger.info('🛑 Server shutting down gracefully...');

    const state = getState();
    stopTimers(state);
    stopPerfIntegration(perfIntegration);
    memoryMonitor.stop();
    logger.info('Memory monitor stopped');
    stopSessionCleanupInterval();
    logger.info('Session cleanup interval stopped');
    stopHazards(state.gameState);
    closeRuntime(io, server, dbManager, exitCode);

    setTimeout(() => {
      logger.error('Forced shutdown after 30s timeout');
      process.exit(1);
    }, FORCED_EXIT_MS).unref();
  }

  function install() {
    process.on('SIGTERM', cleanupServer);
    process.on('SIGINT', cleanupServer);

    process.on('uncaughtException', err => {
      const isDev = process.env.NODE_ENV !== 'production';
      logger.error('Uncaught exception', {
        error: err && err.message,
        code: err && err.code,
        ...(isDev ? { stack: err && err.stack } : {})
      });
      // Always exit with a non-zero code after an uncaught exception so process
      // managers (PM2, systemd) know the process crashed and can restart it.
      cleanupServer(1);
    });

    process.on('unhandledRejection', reason => {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      const isDev = process.env.NODE_ENV !== 'production';
      logger.error('Unhandled promise rejection', {
        error: err.message,
        ...(isDev ? { stack: err.stack } : {})
      });
      // Do not exit — keep active game sessions alive.
    });
  }

  return { cleanupServer, install };
}

module.exports = {
  createCleanup,
  // Exported for unit tests
  stopTimers,
  stopPerfIntegration,
  stopHazards
};
