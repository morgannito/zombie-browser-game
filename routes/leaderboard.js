/**
 * @fileoverview Leaderboard routes
 * @description Handles leaderboard operations
 * - GET /api/leaderboard - Get leaderboard with pagination
 * - POST /api/leaderboard - Submit score to leaderboard
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandlers');
const { Joi, validateRequest } = require('../middleware/validation');
const { requireSameUserInBody, requireSameUserInQuery } = require('../middleware/authz');

/**
 * Initialize leaderboard routes
 * @param {Object} container - Dependency injection container
 * @returns {Router} Express router
 */
function initLeaderboardRoutes(container, options = {}) {
  const requireAuth = options.requireAuth || ((_req, _res, next) => next());
  const uuidSchema = Joi.string().guid({ version: ['uuidv4', 'uuidv5'] });

  /**
   * GET /api/leaderboard - Get leaderboard
   */
  router.get(
    '/',
    requireAuth,
    validateRequest({
      query: Joi.object({
        limit: Joi.number().integer().min(1).max(100).default(10),
        playerId: uuidSchema.optional()
      })
    }),
    requireSameUserInQuery('playerId'),
    asyncHandler(async (req, res) => {
      const { limit, playerId } = req.query;
      const getLeaderboard = container.get('getLeaderboardUseCase');

      const result = await getLeaderboard.execute({
        limit,
        playerId: playerId || null
      });

      res.json(result);
    })
  );

  /**
   * POST /api/leaderboard - Submit score to leaderboard
   */
  router.post(
    '/',
    requireAuth,
    validateRequest({
      body: Joi.object({
        playerId: uuidSchema.required(),
        wave: Joi.number().integer().min(0).required(),
        level: Joi.number().integer().min(0).required(),
        kills: Joi.number().integer().min(0).required(),
        survivalTime: Joi.number().integer().min(0).required()
      })
    }),
    requireSameUserInBody('playerId'),
    asyncHandler(async (req, res) => {
      const { playerId, wave, level, kills, survivalTime } = req.body;
      const submitScore = container.get('submitScoreUseCase');

      const entry = await submitScore.execute({
        playerId,
        wave,
        level,
        kills,
        survivalTime
      });

      res.status(201).json(entry.toObject());
    })
  );

  return router;
}

module.exports = initLeaderboardRoutes;
