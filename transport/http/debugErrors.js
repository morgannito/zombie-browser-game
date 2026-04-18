/**
 * @fileoverview Debug errors endpoint — ring buffer des 100 dernières erreurs
 * GET /debug/errors  — Bearer token requis (même token que /metrics)
 */

const express = require('express');
const router = express.Router();
const errorTracker = require('../../infrastructure/metrics/ErrorTracker');
const { requireMetricsToken } = require('../../middleware/security');

router.get('/', requireMetricsToken, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 100);
  res.json({
    errors: errorTracker.getRecent(limit),
    summary: errorTracker.getSummary()
  });
});

module.exports = router;
