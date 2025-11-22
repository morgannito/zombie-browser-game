/**
 * ADD ACCOUNT XP USE CASE
 * Business logic for adding XP to account progression
 * @version 1.0.0
 */

const logger = require('../../infrastructure/Logger');

class AddAccountXPUseCase {
  constructor(progressionRepository) {
    this.progressionRepository = progressionRepository;
  }

  /**
   * Add XP to player's account progression
   * @param {Object} params
   * @param {String} params.playerId - Player UUID
   * @param {Number} params.xpEarned - XP earned from game
   * @param {Object} params.gameStats - Additional game stats
   * @returns {Promise<Object>} - { levelsGained, skillPointsGained, newLevel, currentXP, xpForNext }
   */
  async execute({ playerId, xpEarned, gameStats = {} }) {
    try {
      if (!playerId) {
        throw new Error('Player ID is required');
      }

      if (!xpEarned || xpEarned < 0) {
        throw new Error('Valid XP amount is required');
      }

      // Get or create progression
      let progression = await this.progressionRepository.findByPlayerId(playerId);

      if (!progression) {
        // Create new progression
        const AccountProgression = require('../../domain/entities/AccountProgression');
        progression = new AccountProgression({ playerId });
        await this.progressionRepository.create(progression);
        logger.info('Created new account progression', { playerId });
      }

      // Add XP and handle level ups
      const result = progression.addXP(xpEarned);

      // Save updated progression
      await this.progressionRepository.update(progression);

      logger.info('Account XP added', {
        playerId,
        xpEarned,
        levelsGained: result.levelsGained,
        newLevel: result.newLevel,
        gameStats
      });

      return {
        success: true,
        ...result,
        progression: progression.getStats(),
        prestigeBonuses: progression.getPrestigeBonuses()
      };
    } catch (error) {
      logger.error('Failed to add account XP', {
        playerId,
        xpEarned,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Calculate XP earned from game session
   * Formula: Base XP + (Kills * 10) + (Wave * 100) + (Level * 50) + (SurvivalTime/10)
   * @param {Object} gameStats
   * @returns {Number} - Total XP earned
   */
  static calculateXPFromGameStats(gameStats) {
    const {
      kills = 0,
      wave = 1,
      level = 1,
      survivalTimeSeconds = 0,
      bossKills = 0,
      comboMax = 0
    } = gameStats;

    let xp = 100; // Base XP for playing

    // Kills: 10 XP per kill
    xp += kills * 10;

    // Wave progression: 100 XP per wave
    xp += (wave - 1) * 100;

    // Level progression: 50 XP per level
    xp += (level - 1) * 50;

    // Survival time: 1 XP per 10 seconds
    xp += Math.floor(survivalTimeSeconds / 10);

    // Boss kills: 500 XP per boss
    xp += bossKills * 500;

    // Max combo bonus: 5 XP per combo level
    xp += comboMax * 5;

    return Math.floor(xp);
  }
}

module.exports = AddAccountXPUseCase;
