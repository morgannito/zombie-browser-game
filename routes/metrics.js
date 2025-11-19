/**
 * @fileoverview Metrics route
 * @description Provides Prometheus-compatible metrics endpoint
 * - GET /api/metrics - Returns metrics in Prometheus format
 */

const express = require('express');
const router = express.Router();

/**
 * Initialize metrics route
 * @param {Object} metricsCollector - Metrics collector instance
 * @returns {Router} Express router
 */
function initMetricsRoute(metricsCollector) {
  /**
   * GET /api/metrics - Métriques Prometheus pour monitoring externe
   */
  router.get('/', (req, res) => {
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(metricsCollector.getPrometheusMetrics());
  });

  return router;
}

module.exports = initMetricsRoute;
