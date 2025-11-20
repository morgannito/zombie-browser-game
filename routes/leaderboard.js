/**
 * @fileoverview Leaderboard routes
 * @description Handles leaderboard operations
 * - GET /api/leaderboard - Get leaderboard with pagination
 * - POST /api/leaderboard - Submit score to leaderboard
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandlers');

/**
 * Initialize leaderboard routes
 * @param {Object} container - Dependency injection container
 * @returns {Router} Express router
 */
function initLeaderboardRoutes(container) {
  /**
   * GET /api/leaderboard - Get leaderboard
   */
  router.get('/', asyncHandler(async (req, res) => {
    const { limit = 10, playerId } = req.query;
    const getLeaderboard = container.get('getLeaderboard');

    const result = await getLeaderboard.execute({
      limit: parseInt(limit),
      playerId
    });

    res.json(result);
  }));

  /**
   * POST /api/leaderboard - Submit score to leaderboard
   */
  router.post('/', asyncHandler(async (req, res) => {
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
  }));

  return router;
}

module.exports = initLeaderboardRoutes;
