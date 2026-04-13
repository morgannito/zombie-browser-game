/**
 * @fileoverview Admin stats route
 * @description Debug dashboard endpoint — requires METRICS_TOKEN (admin auth).
 * - GET /admin/stats - Returns aggregated server + domain stats as JSON
 */

'use strict';

const express = require('express');
const router = express.Router();

function _buildServerStats(sys) {
  return {
    uptimeSeconds: sys.uptime,
    memoryRssMB: sys.memory.rssMB,
    heapUsedMB: sys.memory.heapUsedMB,
    loadAverage: sys.system.loadAverage,
    cpus: sys.system.cpus,
    platform: sys.system.platform
  };
}

function _buildGameDomainStats(m) {
  return {
    activeGames: m.game.activeGames,
    currentWave: m.game.currentWave,
    highestWave: m.game.highestWave,
    players: { current: m.players.current, peak: m.players.peak, total: m.players.total },
    zombies: { current: m.zombies.current, killed: m.zombies.killed, spawned: m.zombies.spawned },
    powerups: {
      current: m.powerups.current,
      spawned: m.powerups.spawned,
      collected: m.powerups.collected
    }
  };
}

/**
 * Build admin stats snapshot
 * @param {Object} mc - MetricsCollector instance
 * @param {Object} memoryMonitor - MemoryMonitor instance
 * @returns {Object}
 */
function buildAdminStats(mc, memoryMonitor) {
  const m = mc.getMetrics();
  return {
    timestamp: new Date().toISOString(),
    server: _buildServerStats(m.system),
    game: _buildGameDomainStats(m),
    performance: {
      fps: { actual: m.performance.actualFPS, target: m.performance.targetFPS },
      frameTimeAvgMs: Number(m.performance.avgFrameTime.toFixed(2)),
      frameTimeMaxMs: Number(m.performance.maxFrameTime.toFixed(2))
    },
    network: m.network,
    anticheat: {
      cheatAttempts: m.anticheat.cheat_attempts_total,
      rateLimitBlocks: m.anticheat.rate_limit_blocks_total,
      movementCorrections: m.anticheat.movement_corrections_total,
      playerDisconnects: m.anticheat.player_disconnects_total
    },
    memoryTrend: memoryMonitor ? memoryMonitor.getStats() : null
  };
}

/**
 * Initialize admin stats route
 * @param {Object} metricsCollector - MetricsCollector instance
 * @param {Object} memoryMonitor - MemoryMonitor instance
 * @returns {Router} Express router
 */
function initAdminStatsRoute(metricsCollector, memoryMonitor) {
  router.get('/', (req, res) => {
    res.json(buildAdminStats(metricsCollector, memoryMonitor));
  });

  return router;
}

module.exports = initAdminStatsRoute;
module.exports.buildAdminStats = buildAdminStats;
