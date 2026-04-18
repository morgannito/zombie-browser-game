/**
 * ADD ACCOUNT XP USE CASE
 * Business logic for adding XP to account progression
 * @version 1.0.0
 */

const logger = require('../../../infrastructure/logging/Logger');
const { ValidationError } = require('../../domain/errors/DomainErrors');

class AddAccountXPUseCase {
  constructor(progressionRepository) {
    this.progressionRepository = progressionRepository;
    this._updateLocks = new Set();
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
        throw new ValidationError('Player ID is required');
      }

      const safeXP = Number.isFinite(xpEarned) ? Math.max(0, Math.min(xpEarned, 1_000_000)) : 0;
      if (safeXP !== xpEarned) {
        logger.warn('XP amount clamped (invalid input)', { playerId, original: xpEarned, clamped: safeXP });
      }
      if (safeXP === 0) {
        return { success: true, levelsGained: 0, skillPointsGained: 0, noop: true };
      }
      xpEarned = safeXP;

      // Get or create progression — atomic to prevent duplicate rows on concurrent calls
      const AccountProgression = require('../../domain/entities/AccountProgression');
      let progression;
      if (typeof this.progressionRepository.findOrCreate === 'function') {
        const { progression: found, created } = this.progressionRepository.findOrCreate(
          playerId,
          new AccountProgression({ playerId })
        );
        progression = found;
        if (created) {
          logger.info('Created new account progression', { playerId });
        }
      } else {
        // Fallback for repositories without findOrCreate (e.g. mocks)
        if (this._updateLocks.has(playerId)) {
          throw new ValidationError(`Update already in progress for player ${playerId}`);
        }
        this._updateLocks.add(playerId);
        try {
          progression = await this.progressionRepository.findByPlayerId(playerId);
          if (!progression) {
            progression = new AccountProgression({ playerId });
            await this.progressionRepository.create(progression);
            logger.info('Created new account progression', { playerId });
          }
        } finally {
          this._updateLocks.delete(playerId);
        }
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
    const clamp = (v, min, max) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(min, Math.min(n, max)) : min;
    };
    const kills = clamp(gameStats.kills, 0, 100_000);
    const wave = clamp(gameStats.wave, 1, 10_000);
    const level = clamp(gameStats.level, 1, 1_000);
    const survivalTimeSeconds = clamp(gameStats.survivalTimeSeconds, 0, 86_400);
    const bossKills = clamp(gameStats.bossKills, 0, 1_000);
    const comboMax = clamp(gameStats.comboMax, 0, 10_000);

    let xp = 100;
    xp += kills * 10;
    xp += (wave - 1) * 100;
    xp += (level - 1) * 50;
    xp += Math.floor(survivalTimeSeconds / 10);
    xp += bossKills * 500;
    xp += comboMax * 5;

    return Math.max(0, Math.min(Math.floor(xp), 1_000_000));
  }
}

module.exports = AddAccountXPUseCase;
