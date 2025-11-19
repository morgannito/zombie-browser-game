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
const path = require('path');

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
  serverErrorHandler
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
const PlayerManager = require('./lib/server/PlayerManager');
const ZombieManager = require('./lib/server/ZombieManager');
const perfIntegration = require('./lib/server/PerformanceIntegration');

const { CONFIG, ZOMBIE_TYPES, LEVEL_UP_UPGRADES } = ConfigManager;
const { INACTIVITY_TIMEOUT, HEARTBEAT_CHECK_INTERVAL } = require('./config/constants');

// ============================================
// IMPORTS - Socket Handlers
// ============================================
const { initSocketHandlers } = require('./sockets/socketHandlers');

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

// Initialize database
const dbManager = DatabaseManager.getInstance();
dbManager.initialize();

// Initialize dependency injection container
const container = Container.getInstance();
container.initialize();

// Initialize metrics collector
const metricsCollector = MetricsCollector.getInstance();

// Initialize JWT service
const jwtService = new JwtService(logger);

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

// ============================================
// API ROUTES
// ============================================

app.use('/api/auth', initAuthRoutes(container, jwtService));
app.use('/api/metrics', initMetricsRoutes(metricsCollector));
app.use('/api/leaderboard', initLeaderboardRoutes(container));
app.use('/api/players', initPlayersRoutes(container));
app.use('/', initHealthRoutes(dbManager));

// ============================================
// GAME INITIALIZATION
// ============================================

// Initialize game state
const gameState = initializeGameState();

// Initialize rooms (Rogue-like system)
initializeRooms(gameState, CONFIG);

// Initialize game managers
const entityManager = new EntityManager(gameState, CONFIG);
const collisionManager = new CollisionManager(gameState, CONFIG);
const networkManager = new NetworkManager(io, gameState);
const roomManager = new RoomManager(gameState, CONFIG, io);
const playerManager = new PlayerManager(gameState, CONFIG, LEVEL_UP_UPGRADES);
const zombieManager = new ZombieManager(
  gameState,
  CONFIG,
  ZOMBIE_TYPES,
  (x, y, size) => roomManager.checkWallCollision(x, y, size),
  io
);


// Load first room after roomManager is initialized
const { loadRoom } = require('./game/roomFunctions');
loadRoom(0, roomManager);

// Start zombie spawner
zombieManager.startZombieSpawner();
console.log('[ZOMBIE MANAGER] Zombie spawner started');


// ============================================
// GAME LOOP
// ============================================

// Start game loop with adaptive tick rate
let gameLoopTimer = setInterval(() => {
  gameLoop(gameState, io, metricsCollector, perfIntegration, collisionManager, entityManager, zombieManager, logger);

  // Broadcast game state conditionally based on performance mode
  if (perfIntegration.shouldBroadcast()) {
    networkManager.emitGameState();
  }
}, perfIntegration.getTickInterval());

// Heartbeat check for inactive players
let heartbeatTimer = setInterval(() => {
  const now = Date.now();

  for (let playerId in gameState.players) {
    const player = gameState.players[playerId];

    // Check if player is inactive for too long
    if (player.lastActivityTime && (now - player.lastActivityTime) > INACTIVITY_TIMEOUT) {
      logger.info('Player timeout', {
        player: player.nickname || playerId,
        inactiveDuration: now - player.lastActivityTime
      });

      // Disconnect player
      if (player.socketId) {
        const socket = io.sockets.sockets.get(player.socketId);
        if (socket) {
          socket.disconnect(true);
        }
      }

      delete gameState.players[playerId];
    }
  }
}, HEARTBEAT_CHECK_INTERVAL);

// ============================================
// SOCKET.IO HANDLERS
// ============================================

const socketHandler = initSocketHandlers(io, gameState, entityManager, roomManager, metricsCollector, perfIntegration);
io.on('connection', socketHandler);

// ============================================
// ERROR HANDLING
// ============================================

app.use(notFoundHandler);
app.use(serverErrorHandler);

// ============================================
// SERVER STARTUP
// ============================================

server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📡 Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  logger.info(`🎮 Game server initialized`);
  logger.info(`🗄️  Database connected`);
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

function cleanupServer() {
  logger.info('🛑 Server shutting down gracefully...');

  // Stop game loop timers
  if (gameLoopTimer) {
    clearInterval(gameLoopTimer);
    logger.info('✅ Game loop stopped');
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    logger.info('✅ Heartbeat timer stopped');
  }

  // Close all socket connections
  io.close(() => {
    logger.info('✅ All socket connections closed');
  });

  // Close HTTP server
  server.close(() => {
    logger.info('✅ HTTP server closed');

    // Close database connection
    dbManager.close();
    logger.info('✅ Database connection closed');

    process.exit(0);
  });

  // Force exit after 10 seconds
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
