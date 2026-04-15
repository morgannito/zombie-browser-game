/**
 * ZOMBIE SURVIVAL - Server Entry Point
 * @version 2.0.0 (Modularized)
 * @description Main server file - refactored into modules for better maintainability
 *
 * Architecture:
 * - /config - Server configuration and constants (dotenv loaded there)
 * - /middleware - Express middleware (security, CORS, error handling)
 * - /routes - API routes (auth, health, metrics, leaderboard, players)
 * - /game - Game logic (state, loop, utilities, validation)
 * - /sockets - Socket.IO event handlers
 * - /lib - Clean Architecture layers (domain, application, infrastructure)
 */

// ============================================
// IMPORTS - External Dependencies
// ============================================
const express = require('express');
const http = require('http');

// ============================================
// IMPORTS - Configuration
// ============================================
const { PORT, ALLOWED_ORIGINS } = require('./config/constants');

// ============================================
// BOOT VALIDATION - Environment + game configs (fail-fast)
// ============================================
const { validateAllConfigs } = require('./lib/infrastructure/ConfigValidator');
validateAllConfigs();

// ============================================
// IMPORTS - Infrastructure
// ============================================
const logger = require('./lib/infrastructure/Logger');
const { dbManager } = require('./server/database');
const MetricsCollector = require('./lib/infrastructure/MetricsCollector');
const { createMemoryMonitor } = require('./server/memory');

// ============================================
// IMPORTS - Middleware
// ============================================
// Middleware wiring now lives in server/middleware.js (configureMiddleware);
// route mounting lives in server/routes.js (configureRoutes).
const {
  notFoundHandler,
  serverErrorHandler,
  apiErrorHandler
} = require('./middleware/errorHandlers');

// ============================================
// IMPORTS - Routes
// ============================================
// Route wiring + game managers + heartbeat are consumed by ./server/bootstrap.js.

// ============================================
// IMPORTS - Game Logic
// ============================================
const { gameLoop } = require('./game/gameLoop');

const ConfigManager = require('./lib/server/ConfigManager');
const perfIntegration = require('./lib/server/PerformanceIntegration');

const { CONFIG, ZOMBIE_TYPES } = ConfigManager;
const { INACTIVITY_TIMEOUT, HEARTBEAT_CHECK_INTERVAL } = require('./config/constants');

// ============================================
// IMPORTS - Socket Handlers
// ============================================
const { initSocketHandlers, stopSessionCleanupInterval } = require('./transport/websocket');

// ============================================
// SERVER INITIALIZATION
// ============================================

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO via the dedicated factory (see server/socketio.js
// for protocol tuning rationale).
const { createSocketIOServer } = require('./server/socketio');
const io = createSocketIOServer(server);

// Runtime state populated by the bootstrap orchestrator (see ./server/bootstrap.js).
let gameState = null;
let stopGameLoop = null; // cleanup function returned by startGameLoop
let heartbeatTimer = null;
let powerupSpawnerTimer = null;

// Initialize metrics collector (doesn't need DB)
const metricsCollector = MetricsCollector.getInstance();

// Initialize memory monitor (infrastructure layer)
const memoryMonitor = createMemoryMonitor();

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================
const { configureMiddleware } = require('./server/middleware');
configureMiddleware(app);

/**
 * Start game loop with setTimeout recursive pattern and drift compensation.
 * Unlike setInterval, this prevents tick overlap: the next tick is only
 * scheduled after the current one completes, with time compensation to
 * maintain the target frame rate.
 *
 * @param {Object} perfIntegration - Performance config (provides tickInterval)
 * @param {Function} tickFn - Function to execute each tick
 * @returns {Function} Cleanup function to stop the loop
 */
function startGameLoop(perfIntegration, tickFn) {
  const { performance: perf } = require('perf_hooks');
  const tickInterval = perfIntegration.getTickInterval();
  let tickTimeout = null;
  let running = true;

  function tick() {
    if (!running) {
      return;
    }

    const now = perf.now();

    try {
      tickFn();
    } catch (err) {
      logger.error('Game loop tick error', { error: err.message, stack: err.stack });
    }

    // Compensate for drift: subtract execution time from next delay
    const elapsed = perf.now() - now;
    const nextTick = Math.max(0, tickInterval - elapsed);
    tickTimeout = setTimeout(tick, nextTick);
  }

  tick();

  // Return cleanup function
  return function stop() {
    running = false;
    if (tickTimeout !== null) {
      clearTimeout(tickTimeout);
      tickTimeout = null;
    }
  };
}

// Bootstrap orchestrator: composes all factories into startServer().
const { createBootstrap } = require('./server/bootstrap');
const { startServer } = createBootstrap({
  app, server, io,
  config: CONFIG,
  zombieTypes: ZOMBIE_TYPES,
  allowedOrigins: ALLOWED_ORIGINS,
  port: PORT,
  metricsCollector, memoryMonitor, dbManager, perfIntegration,
  initSocketHandlers, gameLoop, startGameLoop,
  errorHandlers: { notFoundHandler, serverErrorHandler, apiErrorHandler },
  inactivityTimeout: INACTIVITY_TIMEOUT,
  heartbeatCheckInterval: HEARTBEAT_CHECK_INTERVAL
});

startServer()
  .then(state => {
    gameState = state.gameState;
    stopGameLoop = state.stopGameLoop;
    heartbeatTimer = state.heartbeatTimer;
    powerupSpawnerTimer = state.powerupSpawnerTimer;
  })
  .catch(err => {
    logger.error('❌ FATAL: Server initialization failed', {
      error: err.message,
      stack: err.stack
    });
    process.exit(1);
  });

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

let isShuttingDown = false;

function cleanupServer() {
  // CRITICAL FIX: Prevent multiple simultaneous shutdowns
  if (isShuttingDown) {
    logger.warn('⚠️  Shutdown already in progress, ignoring signal');
    return;
  }
  isShuttingDown = true;

  logger.info('🛑 Server shutting down gracefully...');

  // Stop game loop (setTimeout-based)
  if (stopGameLoop) {
    stopGameLoop();
    stopGameLoop = null;
    logger.info('Game loop stopped');
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    logger.info('✅ Heartbeat timer stopped');
  }
  if (powerupSpawnerTimer) {
    clearInterval(powerupSpawnerTimer);
    powerupSpawnerTimer = null;
    logger.info('Powerup spawner stopped');
  }

  // BUGFIX (memory leak): perfIntegration owns a gcTimer setInterval that
  // was never cleared on shutdown — kept the singleton (and its config)
  // alive forever in test runs and graceful-restart scenarios.
  try {
    if (perfIntegration && typeof perfIntegration.cleanup === 'function') {
      perfIntegration.cleanup();
      logger.info('Performance integration timers stopped');
    }
  } catch (e) {
    logger.warn('perfIntegration.cleanup() failed', { error: e && e.message });
  }

  // Stop memory monitor
  memoryMonitor.stop();
  logger.info('Memory monitor stopped');

  // MEMORY LEAK FIX: Stop session cleanup interval from socketHandlers
  stopSessionCleanupInterval();
  logger.info('Session cleanup interval stopped');

  // MEDIUM FIX: Cleanup HazardManager
  if (gameState && gameState.hazardManager) {
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

  // CRITICAL FIX: Promise-based cleanup sequence
  // Close socket connections first
  io.close(() => {
    logger.info('✅ All socket connections closed');

    // Then close HTTP server
    server.close(() => {
      logger.info('✅ HTTP server closed');

      // Finally close database with proper promise handling
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

  // Force exit after 10 seconds if cleanup hangs
  setTimeout(() => {
    logger.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Handle shutdown signals
process.on('SIGTERM', cleanupServer);
process.on('SIGINT', cleanupServer);

// Handle uncaught errors — do NOT kill the server for non-fatal errors.
// Active sessions must survive async bugs; we only shut down on true OS-level failures.
const FATAL_OS_CODES = new Set(['ENOMEM', 'EACCES', 'EADDRINUSE', 'EMFILE']);

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
  logger.error('Unhandled promise rejection', {
    error: err.message,
    stack: err.stack
  });
  // Do not exit — keep active game sessions alive.
});

// Export for testing
module.exports = { app, server, io };
