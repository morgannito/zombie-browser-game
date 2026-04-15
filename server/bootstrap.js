/**
 * @fileoverview Server bootstrap orchestrator — final step of the server.js
 *   setup split. Composes the wired factories (database, container, JWT,
 *   routes, game managers, heartbeat, socket handlers) into a single
 *   startServer() entry point.
 */

const logger = require('../infrastructure/logging/Logger');
const Container = require('../lib/application/Container');
const JwtService = require('../lib/infrastructure/auth/JwtService');
const { initializeDatabase } = require('./database');
const { configureRoutes } = require('./routes');
const { createGameManagers } = require('./gameManagers');
const { startHeartbeat } = require('./heartbeat');
const { initializeGameState } = require('../game/gameState');
const { initializeRooms } = require('../game/roomFunctions');

function buildContainer(dbAvailable) {
  if (!dbAvailable) {
return null;
}
  const container = Container.getInstance();
  container.initialize();
  return container;
}

function attachProgression(dbAvailable, container, io, gameState) {
  if (!dbAvailable) {
    logger.warn('Progression integration disabled (database unavailable)');
    return;
  }
  const ProgressionIntegration = require('../lib/server/ProgressionIntegration');
  gameState.progressionIntegration = new ProgressionIntegration(container, io);
  logger.info('Progression integration initialized');
}

function attachAdminCommands(io, gameState, zombieManager) {
  const AdminCommands = require('../game/modules/admin/AdminCommands');
  gameState.adminCommands = new AdminCommands(io, gameState, zombieManager);
  logger.info('Admin commands initialized (debug mode enabled)');
}

function startPowerupSpawner(deps) {
  const { spawnPowerup } = require('../game/lootFunctions');
  const { gameState, roomManager, perfIntegration, metricsCollector, config } = deps;
  const timer = setInterval(() => {
    spawnPowerup(gameState, roomManager, perfIntegration, metricsCollector);
  }, config.POWERUP_SPAWN_INTERVAL);
  logger.info(`Powerup spawner started (interval: ${config.POWERUP_SPAWN_INTERVAL}ms)`);
  return timer;
}

function makeTickFn(deps) {
  const { gameLoop, gameState, io, metricsCollector, perfIntegration,
    collisionManager, entityManager, zombieManager, networkManager } = deps;
  return () => {
    gameLoop(
      gameState, io, metricsCollector, perfIntegration,
      collisionManager, entityManager, zombieManager, logger
    );
    if (perfIntegration.shouldBroadcast()) {
      networkManager.emitGameState();
    }
  };
}

function wireSocketHandlers(deps) {
  const { io, jwtService, initSocketHandlers, gameState, entityManager,
    roomManager, metricsCollector, perfIntegration, container, dbAvailable, networkManager } = deps;
  io.use(jwtService.socketMiddleware());
  const socketHandler = initSocketHandlers(
    io, gameState, entityManager, roomManager,
    metricsCollector, perfIntegration,
    dbAvailable ? container : null, networkManager
  );
  io.on('connection', socketHandler);
}

function attachErrorHandlers(app, errorHandlers) {
  app.use(errorHandlers.notFoundHandler);
  app.use(errorHandlers.apiErrorHandler);
  app.use(errorHandlers.serverErrorHandler);
}

function listenAndLog(server, port, allowedOrigins, dbAvailable) {
  server.listen(port, () => {
    logger.info(`🚀 Server running on port ${port}`);
    logger.info(`📡 Allowed origins: ${allowedOrigins.join(', ')}`);
    logger.info('🎮 Game server initialized');
    if (dbAvailable) {
logger.info('🗄️  Database connected');
} else {
logger.warn('⚠️  Running in degraded mode - no database');
}
  });
}

/**
 * Build a startServer() function bound to the provided runtime deps.
 * The factory pattern keeps server.js declarative and testable.
 *
 * @param {Object} deps  — see server.js for full shape
 * @returns {{startServer: () => Promise<{dbAvailable, gameState, stopGameLoop,
 *           heartbeatTimer, powerupSpawnerTimer}>}}
 */
function createBootstrap(deps) {
  const { app, server, io, config, zombieTypes, allowedOrigins, port,
    metricsCollector, memoryMonitor, dbManager, perfIntegration,
    initSocketHandlers, gameLoop, startGameLoop, errorHandlers,
    inactivityTimeout, heartbeatCheckInterval } = deps;

  async function startServer() {
    const dbAvailable = await initializeDatabase();
    const container = buildContainer(dbAvailable);
    const jwtService = new JwtService(logger);
    const requireAuth = jwtService.expressMiddleware();

    configureRoutes(app, {
      container, jwtService, requireAuth, dbAvailable,
      metricsCollector, memoryMonitor, dbManager, perfIntegration
    });

    const gameState = initializeGameState();
    initializeRooms(gameState, config);
    const managers = createGameManagers({ gameState, config, zombieTypes, io });
    const { entityManager, collisionManager, networkManager, roomManager, zombieManager } = managers;

    attachProgression(dbAvailable, container, io, gameState);

    const { loadRoom } = require('../game/roomFunctions');
    loadRoom(0, roomManager);

    zombieManager.startZombieSpawner();
    logger.info('Zombie spawner started');

    attachAdminCommands(io, gameState, zombieManager);
    const powerupSpawnerTimer = startPowerupSpawner({
      gameState, roomManager, perfIntegration, metricsCollector, config
    });

    const stopGameLoop = startGameLoop(perfIntegration, makeTickFn({
      gameLoop, gameState, io, metricsCollector, perfIntegration,
      collisionManager, entityManager, zombieManager, networkManager
    }));

    const heartbeat = startHeartbeat({
      gameState, io, networkManager, metricsCollector,
      inactivityTimeout, interval: heartbeatCheckInterval
    });

    wireSocketHandlers({
      io, jwtService, initSocketHandlers, gameState, entityManager, roomManager,
      metricsCollector, perfIntegration, container, dbAvailable, networkManager
    });

    attachErrorHandlers(app, errorHandlers);
    listenAndLog(server, port, allowedOrigins, dbAvailable);

    return {
      dbAvailable, gameState, stopGameLoop,
      heartbeatTimer: heartbeat.timer, powerupSpawnerTimer
    };
  }

  return { startServer };
}

module.exports = { createBootstrap };
