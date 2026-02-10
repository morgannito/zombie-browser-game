/**
 * ACHIEVEMENTS API ROUTES
 * Handles achievement retrieval and progress tracking
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/infrastructure/Logger');
const { Joi, validateRequest } = require('../middleware/validation');
const { requireSameUserInParam } = require('../middleware/authz');

/**
 * Initialize achievement routes
 * @param {Object} container - DI container
 * @returns {Router}
 */
function initAchievementRoutes(container, options = {}) {
  const requireAuth = options.requireAuth || ((_req, _res, next) => next());
  const uuidSchema = Joi.string().guid({ version: ['uuidv4', 'uuidv5'] });
  const achievementService = container.get('achievementService');
  const achievementRepository = container.getRepository('achievement');

  router.use(requireAuth);

  /**
   * GET /api/achievements/all
   * Get all available achievements
   */
  router.get('/all', async (req, res) => {
    try {
      const achievements = await achievementRepository.getAllAchievements();

      res.json({
        success: true,
        data: achievements.map(a => a.toObject())
      });
    } catch (error) {
      logger.error('Error fetching all achievements', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch achievements'
      });
    }
  });

  /**
   * GET /api/achievements/:playerId
   * Get player's unlocked achievements
   */
  router.get(
    '/:playerId',
    validateRequest({
      params: Joi.object({
        playerId: uuidSchema.required()
      })
    }),
    requireSameUserInParam('playerId'),
    async (req, res) => {
      try {
        const { playerId } = req.params;

        const achievements = await achievementRepository.getPlayerAchievements(playerId);

        res.json({
          success: true,
          data: achievements
        });
      } catch (error) {
        logger.error('Error fetching player achievements', {
          playerId: req.params.playerId,
          error: error.message
        });
        res.status(500).json({
          success: false,
          error: 'Failed to fetch player achievements'
        });
      }
    }
  );

  /**
   * GET /api/achievements/:playerId/progress
   * Get player's achievement progress (unlocked + locked)
   */
  router.get(
    '/:playerId/progress',
    validateRequest({
      params: Joi.object({
        playerId: uuidSchema.required()
      })
    }),
    requireSameUserInParam('playerId'),
    async (req, res) => {
      try {
        const { playerId } = req.params;

        const progress = await achievementService.getPlayerAchievementProgress(playerId);

        res.json({
          success: true,
          data: progress
        });
      } catch (error) {
        logger.error('Error fetching achievement progress', {
          playerId: req.params.playerId,
          error: error.message
        });
        res.status(500).json({
          success: false,
          error: 'Failed to fetch achievement progress'
        });
      }
    }
  );

  /**
   * POST /api/achievements/:playerId/check
   * Check and unlock achievements for player
   */
  router.post(
    '/:playerId/check',
    validateRequest({
      params: Joi.object({
        playerId: uuidSchema.required()
      }),
      body: Joi.object({
        sessionStats: Joi.object().default({})
      }).default({})
    }),
    requireSameUserInParam('playerId'),
    async (req, res) => {
      try {
        const { playerId } = req.params;
        const { sessionStats } = req.body;

        const newlyUnlocked = await achievementService.checkAndUnlockAchievements(
          playerId,
          sessionStats
        );

        res.json({
          success: true,
          data: {
            newlyUnlocked: newlyUnlocked.map(a => a.toObject()),
            count: newlyUnlocked.length
          }
        });
      } catch (error) {
        logger.error('Error checking achievements', {
          playerId: req.params.playerId,
          error: error.message
        });
        res.status(500).json({
          success: false,
          error: 'Failed to check achievements'
        });
      }
    }
  );

  return router;
}

module.exports = initAchievementRoutes;
