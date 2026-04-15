/**
 * @fileoverview Route mounting — extracted from server.js setup block.
 * @description Centralises all Express route wiring (versioned v1 + legacy
 *   aliases). Keeps server.js free of per-route require() noise.
 */

const logger = require('../infrastructure/logging/Logger');
const { requireMetricsToken } = require('../middleware/security');

const initAuthRoutes = require('../transport/http/auth');
const initHealthRoutes = require('../transport/http/health');
const initMetricsRoutes = require('../transport/http/metrics');
const initAdminStatsRoute = require('../transport/http/adminStats');
const initLeaderboardRoutes = require('../transport/http/leaderboard');
const initPlayersRoutes = require('../transport/http/players');
const featuresRoutes = require('../transport/http/features');

function mountAuthRoutes(app, container, jwtService) {
  const authRoutes = initAuthRoutes(container, jwtService);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/auth', authRoutes);
}

function mountDbRoutes(app, container, requireAuth) {
  const leaderboardRoutes = initLeaderboardRoutes(container, { requireAuth });
  const playerRoutes = initPlayersRoutes(container, { requireAuth });
  const progressionRoutes = require('../transport/http/progression')(container, { requireAuth });
  const achievementRoutes = require('../transport/http/achievements')(container, { requireAuth });

  app.use('/api/v1/leaderboard', leaderboardRoutes);
  app.use('/api/v1/players', playerRoutes);
  app.use('/api/v1/progression', progressionRoutes);
  app.use('/api/v1/achievements', achievementRoutes);

  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/players', playerRoutes);
  app.use('/api/progression', progressionRoutes);
  app.use('/api/achievements', achievementRoutes);

  logger.info('Database-dependent routes initialized (v1 + legacy)');
}

function mountSystemRoutes(app, deps) {
  const { metricsCollector, memoryMonitor, dbManager, perfIntegration } = deps;
  const metricsRoutes = initMetricsRoutes(metricsCollector);
  app.use('/api/v1/metrics', requireMetricsToken, metricsRoutes);
  app.use('/api/metrics', requireMetricsToken, metricsRoutes);
  app.use('/api/v1/features', featuresRoutes);
  app.use('/api/features', featuresRoutes);
  app.use(
    '/admin/stats',
    requireMetricsToken,
    initAdminStatsRoute(metricsCollector, memoryMonitor)
  );
  // /health stays unauthenticated for LB / k8s liveness probes.
  app.use('/health', initHealthRoutes(dbManager, metricsCollector, perfIntegration, memoryMonitor));
}

/**
 * Mount all routes on the express app.
 * @param {import('express').Express} app
 * @param {{container, jwtService, requireAuth, dbAvailable,
 *          metricsCollector, memoryMonitor, dbManager, perfIntegration}} deps
 */
function configureRoutes(app, deps) {
  mountAuthRoutes(app, deps.container, deps.jwtService);
  if (deps.dbAvailable) {
    mountDbRoutes(app, deps.container, deps.requireAuth);
  } else {
    logger.warn('Database-dependent routes disabled');
  }
  mountSystemRoutes(app, deps);
}

module.exports = {
  configureRoutes,
  // Exported for unit tests
  mountAuthRoutes,
  mountDbRoutes,
  mountSystemRoutes
};
