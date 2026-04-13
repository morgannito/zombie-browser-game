/**
 * @fileoverview Metrics route
 * @description Provides Prometheus-compatible metrics endpoint
 * - GET /api/metrics       - Returns metrics in Prometheus format
 * - GET /api/metrics/game  - Domain stats (waves, kills, powerup rate) — METRICS_TOKEN required
 */

const express = require('express');
const router = express.Router();

/**
 * Build domain game stats snapshot
 * @param {Object} mc - MetricsCollector instance
 * @returns {Object}
 */
function buildGameStats(mc) {
  const m = mc.getMetrics();
  const spawned = m.powerups.spawned || 0;
  const killed = m.zombies.killed || 0;
  const dropRate = killed > 0 ? Number((spawned / killed).toFixed(4)) : 0;
  return {
    waves: { current: m.game.currentWave, highest: m.game.highestWave },
    zombies: { killed, spawned: m.zombies.spawned, current: m.zombies.current },
    powerups: { spawned, collected: m.powerups.collected, dropRate },
    players: { current: m.players.current, peak: m.players.peak, total: m.players.total }
  };
}

/**
 * Initialize metrics route
 * @param {Object} metricsCollector - Metrics collector instance
 * @returns {Router} Express router
 */
function initMetricsRoute(metricsCollector) {
  router.get('/', (req, res) => {
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(metricsCollector.getPrometheusMetrics());
  });

  router.get('/game', (req, res) => {
    res.json(buildGameStats(metricsCollector));
  });

  return router;
}

module.exports = initMetricsRoute;
module.exports.buildGameStats = buildGameStats;
