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
const logger = require("./infrastructure/logging/Logger");
const { dbManager } = require('./server/database');
const MetricsCollector = require("./infrastructure/metrics/MetricsCollector");
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

// Game loop (setTimeout-recursive with drift compensation) lives in server/timers.js.
const { startGameLoop } = require('./server/timers');

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
const { createCleanup } = require('./server/cleanup');
createCleanup({
  io, server, dbManager, perfIntegration, memoryMonitor, stopSessionCleanupInterval,
  // Lexical capture: cleanup needs the latest values of the runtime state mutated
  // by the bootstrap orchestrator's resolution (timers, gameState, ...).
  getState: () => ({ gameState, stopGameLoop, heartbeatTimer, powerupSpawnerTimer })
}).install();

// Export for testing
module.exports = { app, server, io };
