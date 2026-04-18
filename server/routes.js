/**
 * @fileoverview Route mounting — extracted from server.js setup block.
 * @description Centralises all HTTP route wiring under /api/v1/*.
 *   Legacy /api/* aliases were removed once all clients migrated.
 */

const logger = require('../infrastructure/logging/Logger');
const { requireMetricsToken } = require('../middleware/security');

const initAuthRoutes = require('../transport/http/auth');
const initHealthRoutes = require('../transport/http/health');
const initMetricsRoutes = require('../transport/http/metrics');
const initAdminStatsRoute = require('../transport/http/adminStats');
const initLeaderboardRoutes = require('../transport/http/leaderboard');
const initPlayersRoutes = require('../transport/http/players');
const initClientErrorRoutes = require('../transport/http/clientError');
const initDashboardRoute = require('../transport/http/dashboard');
const featuresRoutes = require('../transport/http/features');
const debugErrorsRoutes = require('../transport/http/debugErrors');
const debugReplayRoutes = require('../transport/http/debugReplay');

function mountAuthRoutes(app, container, jwtService) {
  const authRoutes = initAuthRoutes(container, jwtService);
  app.use('/api/v1/auth', authRoutes);
}

function mountDbRoutes(app, container, requireAuth) {
  const leaderboardRoutes = initLeaderboardRoutes(container, { requireAuth });
  const playerRoutes = initPlayersRoutes(container, { requireAuth });
  const progressionRoutes = require('../transport/http/progression')(container, { requireAuth });
  const achievementRoutes = require('../transport/http/achievements')(container, { requireAuth });

  const dailyChallengesRoutes = require('../transport/http/dailyChallenges')(container, { requireAuth });

  app.use('/api/v1/leaderboard', leaderboardRoutes);
  app.use('/api/v1/players', playerRoutes);
  app.use('/api/v1/progression', progressionRoutes);
  app.use('/api/v1/achievements', achievementRoutes);
  app.use('/api/v1/daily-challenges', dailyChallengesRoutes);

  logger.info('Database-dependent routes initialized (v1)');
}

function mountSystemRoutes(app, deps) {
  const { metricsCollector, memoryMonitor, dbManager, perfIntegration: _perfIntegration, gameLoopRef } = deps;
  const metricsRoutes = initMetricsRoutes(metricsCollector);
  app.use('/api/v1/metrics', requireMetricsToken, metricsRoutes);
  // Endpoint Prometheus standard (scrape direct sans préfixe API)
  app.get('/metrics', requireMetricsToken, (req, res) => {
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(metricsCollector.getPrometheusMetrics());
  });
  app.use('/api/v1/features', featuresRoutes);
  // Client error ingestion — unauthenticated (clients need to report even
  // pre-auth crashes) but rate-limited inside the route itself.
  const clientErrorRoutes = initClientErrorRoutes();
  app.use('/api/v1/client-error', clientErrorRoutes);
  app.use(
    '/admin/stats',
    requireMetricsToken,
    initAdminStatsRoute(metricsCollector, memoryMonitor)
  );
  app.use('/debug/errors', requireMetricsToken, debugErrorsRoutes);
  app.use('/debug/replay', requireMetricsToken, debugReplayRoutes);
  app.use('/dashboard', requireMetricsToken, initDashboardRoute(metricsCollector, deps.perfIntegration));
  // /health stays unauthenticated for LB / k8s liveness probes.
  app.use('/health', initHealthRoutes(dbManager, metricsCollector, gameLoopRef));
}

/**
 * Mount all routes on the express app.
 * @param {import('express').Express} app
 * @param {{container, jwtService, requireAuth, dbAvailable,
 *          metricsCollector, memoryMonitor, dbManager, perfIntegration}} deps
 */
function mountDocsRoutes(app) {
  const path = require('path');
  app.get('/admin', requireMetricsToken, (req, res) => {
    res.sendFile(path.resolve(__dirname, '../public/admin.html'));
  });
  app.get('/docs', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../public/docs.html'));
  });
  app.get('/openapi.yaml', (req, res) => {
    res.setHeader('Content-Type', 'application/yaml');
    res.sendFile(path.resolve(__dirname, '../openapi.yaml'));
  });
}

/**
 * Mount all routes on the express app.
 * @param {import('express').Express} app
 * @param {{ container: Object, jwtService: Object, requireAuth: Function,
 *           dbAvailable: boolean, metricsCollector: Object, memoryMonitor: Object,
 *           dbManager: Object, perfIntegration: Object, gameLoopRef: Object }} deps
 */
function configureRoutes(app, deps) {
  mountDocsRoutes(app);
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
