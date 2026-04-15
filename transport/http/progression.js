/**
 * PROGRESSION API ROUTES
 * Handles account progression, skill tree, prestige system
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const logger = require("../../lib/infrastructure/Logger");
const { Joi, validateRequest } = require("../../middleware/validation");
const { requireSameUserInParam } = require("../../middleware/authz");

/**
 * Initialize progression routes
 * @param {Object} container - DI container
 * @param {{ requireAuth?: Function }} options - Route middleware options
 * @returns {Router}
 */
function initProgressionRoutes(container, options = {}) {
  const requireAuth = options.requireAuth || ((_req, _res, next) => next());
  const db = container.get('database');
  const SQLiteProgressionRepository = require("../../lib/infrastructure/repositories/SQLiteProgressionRepository");
  const progressionRepo = new SQLiteProgressionRepository(db);
  const AccountProgression = require("../../lib/domain/entities/AccountProgression");
  const playerIdSchema = Joi.string().guid({ version: ['uuidv4', 'uuidv5'] });

  router.use(requireAuth);

  /**
   * GET /api/progression/skills/all
   * Get complete skill tree
   */
  router.get('/skills/all', async (req, res) => {
    try {
      const skills = await progressionRepo.getAllSkills();

      const grouped = skills.reduce((acc, skill) => {
        if (!acc[skill.category]) {
          acc[skill.category] = {};
        }
        if (!acc[skill.category][skill.tier]) {
          acc[skill.category][skill.tier] = [];
        }
        acc[skill.category][skill.tier].push(skill);
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          skills,
          grouped
        }
      });
    } catch (error) {
      logger.error('Error fetching skill tree', { requestId: req.id, error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch skill tree'
      });
    }
  });

  /**
   * GET /api/progression/leaderboard/level
   * Get top players by account level
   */
  router.get(
    '/leaderboard/level',
    validateRequest({
      query: Joi.object({
        limit: Joi.number().integer().min(1).max(100).default(10)
      })
    }),
    async (req, res) => {
      try {
        const { limit } = req.query;
        const topPlayers = await progressionRepo.getTopByLevel(limit);

        res.json({
          success: true,
          data: topPlayers.map((entry, index) => ({
            rank: index + 1,
            username: entry.username,
            accountLevel: entry.progression.accountLevel,
            totalXP: entry.progression.totalXPEarned,
            prestigeLevel: entry.progression.prestigeLevel
          }))
        });
      } catch (error) {
        logger.error('Error fetching leaderboard', { requestId: req.id, error: error.message });
        res.status(500).json({
          success: false,
          error: 'Failed to fetch leaderboard'
        });
      }
    }
  );

  /**
   * GET /api/progression/leaderboard/prestige
   * Get top players by prestige level
   */
  router.get(
    '/leaderboard/prestige',
    validateRequest({
      query: Joi.object({
        limit: Joi.number().integer().min(1).max(100).default(10)
      })
    }),
    async (req, res) => {
      try {
        const { limit } = req.query;
        const topPlayers = await progressionRepo.getTopByPrestige(limit);

        res.json({
          success: true,
          data: topPlayers.map((entry, index) => ({
            rank: index + 1,
            username: entry.username,
            prestigeLevel: entry.progression.prestigeLevel,
            prestigeTokens: entry.progression.prestigeTokens,
            accountLevel: entry.progression.accountLevel
          }))
        });
      } catch (error) {
        logger.error('Error fetching prestige leaderboard', {
          requestId: req.id,
          error: error.message
        });
        res.status(500).json({
          success: false,
          error: 'Failed to fetch prestige leaderboard'
        });
      }
    }
  );

  /**
   * GET /api/progression/:playerId
   * Get account progression for a player
   */
  router.get(
    '/:playerId',
    validateRequest({
      params: Joi.object({
        playerId: playerIdSchema.required()
      })
    }),
    requireSameUserInParam('playerId'),
    async (req, res) => {
      try {
        const { playerId } = req.params;

        let progression = await progressionRepo.findByPlayerId(playerId);

        if (!progression) {
          progression = new AccountProgression({ playerId });
          await progressionRepo.create(progression);
        }

        res.json({
          success: true,
          data: {
            ...progression.toObject(),
            stats: progression.getStats()
          }
        });
      } catch (error) {
        logger.error('Error fetching progression', { requestId: req.id, error: error.message });
        res.status(500).json({
          success: false,
          error: 'Failed to fetch progression'
        });
      }
    }
  );

  /**
   * POST /api/progression/:playerId/add-xp
   * Add XP to account (called after game ends)
   */
  router.post(
    '/:playerId/add-xp',
    validateRequest({
      params: Joi.object({
        playerId: playerIdSchema.required()
      }),
      body: Joi.object({
        xp: Joi.number().integer().min(0).max(100000000).required()
      })
    }),
    requireSameUserInParam('playerId'),
    async (req, res) => {
      try {
        const { playerId } = req.params;
        const { xp } = req.body;

        let progression = await progressionRepo.findByPlayerId(playerId);

        if (!progression) {
          progression = new AccountProgression({ playerId });
          await progressionRepo.create(progression);
        }

        const result = progression.addXP(xp);
        await progressionRepo.update(progression);

        res.json({
          success: true,
          data: {
            ...result,
            progression: progression.getStats()
          }
        });
      } catch (error) {
        logger.error('Error adding XP', { requestId: req.id, error: error.message });
        res.status(500).json({
          success: false,
          error: 'Failed to add XP'
        });
      }
    }
  );

  /**
   * POST /api/progression/:playerId/unlock-skill
   * Unlock a skill with skill points
   */
  router.post(
    '/:playerId/unlock-skill',
    validateRequest({
      params: Joi.object({
        playerId: playerIdSchema.required()
      }),
      body: Joi.object({
        skillId: Joi.string().trim().min(1).max(64).required()
      })
    }),
    requireSameUserInParam('playerId'),
    async (req, res) => {
      try {
        const { playerId } = req.params;
        const { skillId } = req.body;

        const progression = await progressionRepo.findByPlayerId(playerId);

        if (!progression) {
          return res.status(404).json({
            success: false,
            error: 'Progression not found'
          });
        }

        const skill = await progressionRepo.getSkillById(skillId);

        if (!skill) {
          return res.status(404).json({
            success: false,
            error: 'Skill not found'
          });
        }

        for (const prereqId of skill.prerequisites) {
          if (!progression.hasSkill(prereqId)) {
            return res.status(400).json({
              success: false,
              error: `Prerequisite skill '${prereqId}' not unlocked`
            });
          }
        }

        progression.unlockSkill(skillId, skill.cost);
        await progressionRepo.update(progression);

        res.json({
          success: true,
          data: {
            skill,
            progression: progression.getStats()
          }
        });
      } catch (error) {
        logger.error('Error unlocking skill', { requestId: req.id, error: error.message });
        const isKnownDomainError =
          error.message &&
          error.message.length < 120 &&
          !error.message.includes('SQL') &&
          !error.message.includes('sqlite');
        res.status(400).json({
          success: false,
          error: isKnownDomainError ? error.message : 'Failed to unlock skill'
        });
      }
    }
  );

  /**
   * POST /api/progression/:playerId/prestige
   * Prestige to earn tokens and reset progress
   */
  router.post(
    '/:playerId/prestige',
    validateRequest({
      params: Joi.object({
        playerId: playerIdSchema.required()
      })
    }),
    requireSameUserInParam('playerId'),
    async (req, res) => {
      try {
        const { playerId } = req.params;

        const progression = await progressionRepo.findByPlayerId(playerId);

        if (!progression) {
          return res.status(404).json({
            success: false,
            error: 'Progression not found'
          });
        }

        const result = progression.prestige(50);
        await progressionRepo.update(progression);

        res.json({
          success: true,
          data: {
            ...result,
            progression: progression.getStats()
          }
        });
      } catch (error) {
        logger.error('Error prestiging', { requestId: req.id, error: error.message });
        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    }
  );

  return router;
}

module.exports = initProgressionRoutes;
