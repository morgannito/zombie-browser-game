/**
 * PROGRESSION API ROUTES
 * Handles account progression, skill tree, prestige system
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/infrastructure/Logger');

/**
 * Initialize progression routes
 * @param {Object} container - DI container
 * @returns {Router}
 */
function initProgressionRoutes(container) {
  const db = container.get('database');
  const SQLiteProgressionRepository = require('../lib/infrastructure/repositories/SQLiteProgressionRepository');
  const progressionRepo = new SQLiteProgressionRepository(db);
  const AccountProgression = require('../lib/domain/entities/AccountProgression');

  /**
   * GET /api/progression/:playerId
   * Get account progression for a player
   */
  router.get('/:playerId', async (req, res) => {
    try {
      const { playerId } = req.params;

      let progression = await progressionRepo.findByPlayerId(playerId);

      // Create if doesn't exist
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
      logger.error('Error fetching progression', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch progression'
      });
    }
  });

  /**
   * POST /api/progression/:playerId/add-xp
   * Add XP to account (called after game ends)
   */
  router.post('/:playerId/add-xp', async (req, res) => {
    try {
      const { playerId } = req.params;
      const { xp } = req.body;

      if (!xp || xp < 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid XP amount'
        });
      }

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
      logger.error('Error adding XP', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to add XP'
      });
    }
  });

  /**
   * POST /api/progression/:playerId/unlock-skill
   * Unlock a skill with skill points
   */
  router.post('/:playerId/unlock-skill', async (req, res) => {
    try {
      const { playerId } = req.params;
      const { skillId } = req.body;

      if (!skillId) {
        return res.status(400).json({
          success: false,
          error: 'Skill ID is required'
        });
      }

      const progression = await progressionRepo.findByPlayerId(playerId);

      if (!progression) {
        return res.status(404).json({
          success: false,
          error: 'Progression not found'
        });
      }

      // Get skill info
      const skill = await progressionRepo.getSkillById(skillId);

      if (!skill) {
        return res.status(404).json({
          success: false,
          error: 'Skill not found'
        });
      }

      // Check prerequisites
      for (const prereqId of skill.prerequisites) {
        if (!progression.hasSkill(prereqId)) {
          return res.status(400).json({
            success: false,
            error: `Prerequisite skill '${prereqId}' not unlocked`
          });
        }
      }

      // Unlock skill
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
      logger.error('Error unlocking skill', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/progression/:playerId/prestige
   * Prestige to earn tokens and reset progress
   */
  router.post('/:playerId/prestige', async (req, res) => {
    try {
      const { playerId } = req.params;

      const progression = await progressionRepo.findByPlayerId(playerId);

      if (!progression) {
        return res.status(404).json({
          success: false,
          error: 'Progression not found'
        });
      }

      const result = progression.prestige(50); // Min level 50
      await progressionRepo.update(progression);

      res.json({
        success: true,
        data: {
          ...result,
          progression: progression.getStats()
        }
      });
    } catch (error) {
      logger.error('Error prestiging', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/progression/skills/all
   * Get complete skill tree
   */
  router.get('/skills/all', async (req, res) => {
    try {
      const skills = await progressionRepo.getAllSkills();

      // Group by category and tier
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
      logger.error('Error fetching skill tree', { error: error.message });
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
  router.get('/leaderboard/level', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const topPlayers = await progressionRepo.getTopByLevel(limit);

      res.json({
        success: true,
        data: topPlayers.map((entry, index) => ({
          rank: index + 1,
          nickname: entry.nickname,
          accountLevel: entry.progression.accountLevel,
          totalXP: entry.progression.totalXPEarned,
          prestigeLevel: entry.progression.prestigeLevel
        }))
      });
    } catch (error) {
      logger.error('Error fetching leaderboard', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch leaderboard'
      });
    }
  });

  /**
   * GET /api/progression/leaderboard/prestige
   * Get top players by prestige level
   */
  router.get('/leaderboard/prestige', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const topPlayers = await progressionRepo.getTopByPrestige(limit);

      res.json({
        success: true,
        data: topPlayers.map((entry, index) => ({
          rank: index + 1,
          nickname: entry.nickname,
          prestigeLevel: entry.progression.prestigeLevel,
          prestigeTokens: entry.progression.prestigeTokens,
          accountLevel: entry.progression.accountLevel
        }))
      });
    } catch (error) {
      logger.error('Error fetching prestige leaderboard', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch prestige leaderboard'
      });
    }
  });

  return router;
}

module.exports = initProgressionRoutes;
