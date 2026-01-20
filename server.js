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
const {
  PORT,
  ALLOWED_ORIGINS
} = require('./config/constants');

// ============================================
// IMPORTS - Infrastructure
// ============================================
const logger = require('./lib/infrastructure/Logger');
const DatabaseManager = require('./lib/database/DatabaseManager');
const Container = require('./lib/application/Container');
const MetricsCollector = require('./lib/infrastructure/MetricsCollector');
const JwtService = require('./lib/infrastructure/auth/JwtService');

// ============================================
// IMPORTS - Middleware
// ============================================
const { getSocketIOCorsConfig } = require('./middleware/cors');
const {
  configureHelmet,
  configureApiLimiter,
  configureBodyParser,
  additionalSecurityHeaders
} = require('./middleware/security');
const {
  notFoundHandler,
  serverErrorHandler,
  apiErrorHandler
} = require('./middleware/errorHandlers');

// ============================================
// IMPORTS - Routes
// ============================================
const initAuthRoutes = require('./routes/auth');
const initHealthRoutes = require('./routes/health');
const initMetricsRoutes = require('./routes/metrics');
const initLeaderboardRoutes = require('./routes/leaderboard');
const initPlayersRoutes = require('./routes/players');

// ============================================
// IMPORTS - Game Logic & Managers
// ============================================
const { initializeGameState } = require('./game/gameState');
const { gameLoop } = require('./game/gameLoop');
const { initializeRooms } = require('./game/roomFunctions');

const ConfigManager = require('./lib/server/ConfigManager');
const EntityManager = require('./lib/server/EntityManager');
const CollisionManager = require('./lib/server/CollisionManager');
const NetworkManager = require('./lib/server/NetworkManager');
const RoomManager = require('./lib/server/RoomManager');
const ZombieManager = require('./lib/server/ZombieManager');
const RunMutatorManager = require('./lib/server/RunMutatorManager');
const perfIntegration = require('./lib/server/PerformanceIntegration');

const { CONFIG, ZOMBIE_TYPES } = ConfigManager;
const { INACTIVITY_TIMEOUT, HEARTBEAT_CHECK_INTERVAL } = require('./config/constants');

// ============================================
// IMPORTS - Socket Handlers
// ============================================
const { initSocketHandlers, stopSessionCleanupInterval } = require('./sockets/socketHandlers');

// ============================================
// SERVER INITIALIZATION
// ============================================

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS configuration
const io = require('socket.io')(server, {
  cors: getSocketIOCorsConfig(),
  // Transport configuration for better WebSocket support
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  // Ping/pong settings for connection health monitoring
  pingInterval: 10000,
  pingTimeout: 5000,
  // Connection settings
  connectTimeout: 45000,
  // Enable compression for better performance
  perMessageDeflate: true,
  httpCompression: true
});

// HIGH FIX: Async database initialization with error handling
const dbManager = DatabaseManager.getInstance();
let dbAvailable = false;
let gameState = null;
let gameLoopTimer = null;
let heartbeatTimer = null;
let powerupSpawnerTimer = null;

async function initializeDatabase() {
  try {
    await Promise.resolve(dbManager.initialize());
    dbAvailable = true;
    logger.info('✅ Database connected successfully');
    return true;
  } catch (err) {
    logger.error('❌ CRITICAL: Database initialization failed', {
      error: err.message,
      stack: err.stack
    });

    // Check if database is required
    const requireDatabase = process.env.REQUIRE_DATABASE === 'true';

    if (requireDatabase) {
      logger.error('❌ Database required but unavailable, shutting down');
      process.exit(1);
    } else {
      logger.warn('⚠️  Running without database - progression features disabled');
      dbAvailable = false;
      return false;
    }
  }
}

// Initialize metrics collector (doesn't need DB)
const metricsCollector = MetricsCollector.getInstance();

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================

// Security middleware
app.use(configureHelmet());
app.use('/api/', configureApiLimiter());
app.use(...configureBodyParser());
app.use(additionalSecurityHeaders);

// Static files
app.use(express.static('public'));

// HIGH FIX: Initialize database before routes
async function startServer() {
  await initializeDatabase();

  // Initialize dependency injection container AFTER database
  const container = dbAvailable ? Container.getInstance() : null;
  if (container) {
    container.initialize();
  }

  // Initialize JWT service
  const jwtService = new JwtService(logger);

  // ============================================
  // API ROUTES
  // ============================================

  app.use('/api/auth', initAuthRoutes(container, jwtService));
  if (dbAvailable) {
    app.use('/api/leaderboard', initLeaderboardRoutes(container));
    app.use('/api/players', initPlayersRoutes(container));
    app.use('/api/progression', require('./routes/progression')(container));
    app.use('/api/achievements', require('./routes/achievements')(container));
    logger.info('✅ Database-dependent routes initialized');
  } else {
    logger.warn('⚠️  Database-dependent routes disabled');
  }

  // Always available routes
  app.use('/api/metrics', initMetricsRoutes(metricsCollector));
  app.use('/health', initHealthRoutes(dbManager, metricsCollector, perfIntegration));

  // ============================================
  // GAME INITIALIZATION
  // ============================================

  // Initialize game state
  gameState = initializeGameState();

  // Initialize rooms (Rogue-like system)
  initializeRooms(gameState, CONFIG);

  // Initialize game managers
  const entityManager = new EntityManager(gameState, CONFIG);
  const collisionManager = new CollisionManager(gameState, CONFIG);
  const networkManager = new NetworkManager(io, gameState);
  const roomManager = new RoomManager(gameState, CONFIG, io);
  const mutatorManager = new RunMutatorManager(gameState, io);
  const zombieManager = new ZombieManager(
    gameState,
    CONFIG,
    ZOMBIE_TYPES,
    (x, y, size) => roomManager.checkWallCollision(x, y, size),
    io
  );

  // CRITICAL FIX: Add roomManager to gameState for zombie movement
  gameState.roomManager = roomManager;
  gameState.mutatorManager = mutatorManager;

  mutatorManager.initialize();
  logger.info('Run mutators initialized');

  // Initialize progression integration (XP, skills, achievements)
  if (dbAvailable) {
    const ProgressionIntegration = require('./lib/server/ProgressionIntegration');
    const progressionIntegration = new ProgressionIntegration(container, io);
    gameState.progressionIntegration = progressionIntegration;
    logger.info('Progression integration initialized');
  } else {
    logger.warn('Progression integration disabled (database unavailable)');
  }

  // Load first room after roomManager is initialized
  const { loadRoom } = require('./game/roomFunctions');
  loadRoom(0, roomManager);

  // Start zombie spawner
  zombieManager.startZombieSpawner();
  logger.info('Zombie spawner started');

  // Initialize admin commands (debug mode)
  const AdminCommands = require('./game/modules/admin/AdminCommands');
  const adminCommands = new AdminCommands(io, gameState, zombieManager);
  gameState.adminCommands = adminCommands;
  logger.info('Admin commands initialized (debug mode enabled)');

  // BUG FIX: Start powerup spawner - was missing, powerups never spawned
  const { spawnPowerup } = require('./game/lootFunctions');
  powerupSpawnerTimer = setInterval(() => {
    spawnPowerup(gameState, roomManager, perfIntegration, metricsCollector);
  }, CONFIG.POWERUP_SPAWN_INTERVAL);
  logger.info(`Powerup spawner started (interval: ${CONFIG.POWERUP_SPAWN_INTERVAL}ms)`);

  // ============================================
  // GAME LOOP
  // ============================================

  // Start game loop with adaptive tick rate
  gameLoopTimer = setInterval(() => {
    gameLoop(gameState, io, metricsCollector, perfIntegration, collisionManager, entityManager, zombieManager, logger);

    // Broadcast game state conditionally based on performance mode
    if (perfIntegration.shouldBroadcast()) {
      networkManager.emitGameState();
    }
  }, perfIntegration.getTickInterval());

  // CRITICAL FIX: Heartbeat check with proper validation and cleanup tracking
  // Uses a flag to prevent race conditions with game loop
  let heartbeatInProgress = false;

  heartbeatTimer = setInterval(() => {
    // CRITICAL FIX: Prevent concurrent execution with game loop
    if (heartbeatInProgress) {
      return;
    }
    heartbeatInProgress = true;

    try {
      const now = Date.now();
      // CRITICAL FIX: Take snapshot of player IDs to avoid iteration issues
      const playerIds = Object.keys(gameState.players).slice();
      let cleanedUp = 0;
      let orphanedObjects = 0;

      // CRITICAL FIX: Mark players for deletion instead of deleting during iteration
      const playersToDelete = [];

      for (const playerId of playerIds) {
        const player = gameState.players[playerId];

        // CRITICAL FIX: Safety check for orphaned/corrupted player objects
        if (!player || typeof player !== 'object') {
          logger.warn('Orphaned player object detected', { playerId });
          playersToDelete.push(playerId);
          orphanedObjects++;
          cleanedUp++;
          continue;
        }

        // CRITICAL FIX: Initialize lastActivityTime if missing (prevents undefined comparison)
        if (!player.lastActivityTime || typeof player.lastActivityTime !== 'number') {
          player.lastActivityTime = now;
          logger.warn('Player missing lastActivityTime, initialized', {
            playerId,
            nickname: player.nickname
          });
          continue;
        }

        const inactiveDuration = now - player.lastActivityTime;

        // Check if player is inactive for too long
        if (inactiveDuration > INACTIVITY_TIMEOUT) {
          logger.info('Player timeout', {
            player: player.nickname || playerId,
            inactiveDuration,
            wasConnected: !!player.socketId
          });

          // Disconnect player socket if still connected
          if (player.socketId) {
            const socket = io.sockets.sockets.get(player.socketId);
            if (socket) {
              socket.disconnect(true);
            }
          }

          playersToDelete.push(playerId);
          cleanedUp++;
        }
      }

      // CRITICAL FIX: Delete players after iteration to prevent race conditions
      for (const playerId of playersToDelete) {
        delete gameState.players[playerId];
        // Also cleanup NetworkManager tracking data
        if (networkManager) {
          networkManager.cleanupPlayer(playerId);
        }
      }

      // CRITICAL FIX: Log cleanup stats for monitoring
      if (cleanedUp > 0) {
        logger.info('Heartbeat cleanup completed', {
          playersRemoved: cleanedUp,
          orphanedObjects,
          remainingPlayers: Object.keys(gameState.players).length,
          timestamp: now
        });

        // Track cleanup metrics
        if (metricsCollector) {
          metricsCollector.recordCleanup({
            playersRemoved: cleanedUp,
            orphaned: orphanedObjects
          });
        }
      }
    } finally {
      heartbeatInProgress = false;
    }
  }, HEARTBEAT_CHECK_INTERVAL);

  // ============================================
  // SOCKET.IO HANDLERS
  // ============================================

  io.use(jwtService.socketMiddleware());
  const socketHandler = initSocketHandlers(io, gameState, entityManager, roomManager, metricsCollector, perfIntegration, dbAvailable ? container : null);
  io.on('connection', socketHandler);

  // ============================================
  // ERROR HANDLING
  // ============================================

  app.use(notFoundHandler);
  app.use(apiErrorHandler); // Handle API errors with JSON responses
  app.use(serverErrorHandler); // Handle HTML errors

  // ============================================
  // SERVER STARTUP
  // ============================================

  server.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📡 Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
    logger.info('🎮 Game server initialized');

    if (dbAvailable) {
      logger.info('🗄️  Database connected');
    } else {
      logger.warn('⚠️  Running in degraded mode - no database');
    }
  });
}

// Start server with database initialization
startServer().catch(err => {
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

  // Stop game loop timers
  if (gameLoopTimer) {
    clearInterval(gameLoopTimer);
    gameLoopTimer = null;
    logger.info('✅ Game loop stopped');
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

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  logger.error('💥 Uncaught Exception:', err);
  cleanupServer();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  cleanupServer();
});

// Export for testing
module.exports = { app, server, io };
