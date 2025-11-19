/**
 * @fileoverview Leaderboard routes
 * @description Handles leaderboard operations
 * - GET /api/leaderboard - Get leaderboard with pagination
 * - POST /api/leaderboard - Submit score to leaderboard
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/infrastructure/Logger');

/**
 * Initialize leaderboard routes
 * @param {Object} container - Dependency injection container
 * @returns {Router} Express router
 */
function initLeaderboardRoutes(container) {
  /**
   * GET /api/leaderboard - Get leaderboard
   */
  router.get('/', async (req, res) => {
    try {
      const { limit = 10, playerId } = req.query;
      const getLeaderboard = container.get('getLeaderboard');

      const result = await getLeaderboard.execute({
        limit: parseInt(limit),
        playerId
      });

      res.json(result);
    } catch (error) {
      logger.error('Leaderboard API error', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/leaderboard - Submit score to leaderboard
   */
  router.post('/', async (req, res) => {
    try {
      const { playerId, wave, level, kills, survivalTime } = req.body;
      const submitScore = container.get('submitScore');

      const entry = await submitScore.execute({
        playerId,
        wave,
        level,
        kills,
        survivalTime
      });

      res.status(201).json(entry.toObject());
    } catch (error) {
      logger.error('Submit score API error', { error: error.message });
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}

module.exports = initLeaderboardRoutes;
