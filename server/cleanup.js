/**
 * @fileoverview Graceful shutdown — extracted from server.js.
 * @description Coordinates safe teardown: stop timers, drain perfIntegration,
 *   stop monitors and session cleanup, close sockets → http → database, with a
 *   10s force-exit watchdog. Also installs SIGTERM/SIGINT and process error
 *   listeners that only escalate to shutdown on true OS-level failures.
 */

const logger = require('../infrastructure/logging/Logger');

const FATAL_OS_CODES = new Set(['ENOMEM', 'EACCES', 'EADDRINUSE', 'EMFILE']);
const FORCED_EXIT_MS = 10000;

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

function closeRuntime(io, server, dbManager) {
  io.close(() => {
    logger.info('✅ All socket connections closed');
    server.close(() => {
      logger.info('✅ HTTP server closed');
      Promise.resolve(dbManager.close())
        .then(() => {
          logger.info('✅ Database connection closed');
          process.exit(0);
        })
        .catch(err => {
          logger.error('❌ Database closure error:', {
            error: err.message,
            stack: err.stack
          });
          process.exit(1);
        });
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

  function cleanupServer() {
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
    closeRuntime(io, server, dbManager);

    setTimeout(() => {
      logger.error('❌ Forced shutdown after timeout');
      process.exit(1);
    }, FORCED_EXIT_MS);
  }

  function install() {
    process.on('SIGTERM', cleanupServer);
    process.on('SIGINT', cleanupServer);

    process.on('uncaughtException', err => {
      logger.error('Uncaught exception', {
        error: err && err.message,
        code: err && err.code,
        stack: err && err.stack
      });
      if (err && FATAL_OS_CODES.has(err.code)) {
cleanupServer();
}
    });

    process.on('unhandledRejection', reason => {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      logger.error('Unhandled promise rejection', { error: err.message, stack: err.stack });
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
