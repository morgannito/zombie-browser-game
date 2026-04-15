/**
 * @fileoverview Feature flags route
 * @description Exposes feature flags to the client
 * - GET / - Returns all active feature flags
 */

const express = require('express');
const router = express.Router();
const { getAll } = require('../../config/features');

/**
 * GET / - Return all feature flags
 */
router.get('/', (req, res) => {
  res.json({ features: getAll() });
});

module.exports = router;
