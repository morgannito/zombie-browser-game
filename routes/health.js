/**
 * @fileoverview Health check route
 * @description Provides health check endpoint with detailed metrics
 * - GET /health - Returns server health status with game, performance, and system metrics
 */

const express = require('express');
const router = express.Router();

/**
 * Initialize health check route
 * @param {Object} dbManager - Database manager instance
 * @param {Object} metricsCollector - Metrics collector instance
 * @param {Object} perfIntegration - Performance integration instance
 * @returns {Router} Express router
 */
function initHealthRoute(dbManager, metricsCollector, perfIntegration) {
  /**
   * GET /health - Health check avancé avec métriques détaillées
   */
  router.get('/', (req, res) => {
    const dbStatus = dbManager.isInitialized ? 'healthy' : 'unhealthy';
    const metrics = metricsCollector.getMetrics();

    const healthStatus = {
      status: dbStatus === 'healthy' ? 'healthy' : 'unhealthy',
      timestamp: Date.now(),
      uptime: metrics.system.uptime,
      performanceMode: perfIntegration.perfConfig.mode,

      // Game state
      game: {
        players: {
          current: metrics.players.current,
          peak: metrics.players.peak
        },
        zombies: {
          current: metrics.zombies.current,
          killed: metrics.zombies.killed
        },
        wave: metrics.game.currentWave,
        activeSessions: metrics.game.activeGames
      },

      // Performance
      performance: {
        fps: {
          actual: metrics.performance.actualFPS,
          target: metrics.performance.targetFPS
        },
        frameTime: {
          avg: parseFloat(metrics.performance.avgFrameTime.toFixed(2)),
          max: parseFloat(metrics.performance.maxFrameTime.toFixed(2))
        }
      },

      // System resources
      system: {
        memory: {
          heapUsedMB: metrics.system.memory.heapUsedMB,
          heapTotalMB: metrics.system.memory.heapTotalMB,
          rssMB: metrics.system.memory.rssMB,
          systemUsagePercent: metrics.system.system.memoryUsagePercent
        },
        cpu: {
          cores: metrics.system.system.cpus,
          loadAverage: metrics.system.system.loadAverage
        }
      },

      // Database
      database: dbStatus
    };

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  });

  return router;
}

module.exports = initHealthRoute;
