/**
 * ACHIEVEMENT SERVICE
 * Service layer for managing achievement unlocks
 * @version 1.0.0
 */

const logger = require('../infrastructure/Logger');

class AchievementService {
  constructor(achievementRepository, playerRepository) {
    this.achievementRepository = achievementRepository;
    this.playerRepository = playerRepository;
  }

  /**
   * Check and unlock achievements for a player
   * @param {String} playerId - Player UUID
   * @param {Object} sessionStats - Stats from completed session
   * @returns {Promise<Array>} - Newly unlocked achievements
   */
  async checkAndUnlockAchievements(playerId, sessionStats = {}) {
    try {
      // Get all achievements
      const allAchievements = await this.achievementRepository.getAllAchievements();

      // Get player stats
      const playerStats = await this.playerRepository.getStats(playerId);

      // Get already unlocked achievements
      const unlockedIds = (await this.achievementRepository.getPlayerAchievements(playerId))
        .map(a => a.achievementId);

      const newlyUnlocked = [];

      // Check each achievement
      for (const achievement of allAchievements) {
        // Skip if already unlocked
        if (unlockedIds.includes(achievement.id)) {
          continue;
        }

        // Check requirements
        if (achievement.checkRequirements(playerStats)) {
          // Unlock achievement
          const unlocked = await this.achievementRepository.unlockAchievement(
            playerId,
            achievement.id,
            sessionStats.sessionId
          );

          if (unlocked) {
            newlyUnlocked.push(achievement);
            logger.info('Achievement unlocked', {
              playerId,
              achievementId: achievement.id,
              achievementName: achievement.name
            });
          }
        }
      }

      return newlyUnlocked;
    } catch (error) {
      logger.error('Failed to check achievements', {
        playerId,
        error: error.message,
        stack: error.stack
      });
      return [];
    }
  }

  /**
   * Get player's achievement progress
   * @param {String} playerId - Player UUID
   * @returns {Promise<Object>} - { unlocked, locked, totalPoints, percentComplete }
   */
  async getPlayerAchievementProgress(playerId) {
    try {
      const allAchievements = await this.achievementRepository.getAllAchievements();
      const playerAchievements = await this.achievementRepository.getPlayerAchievements(playerId);

      const unlockedIds = playerAchievements.map(a => a.achievementId);
      const unlocked = allAchievements.filter(a => unlockedIds.includes(a.id));
      const locked = allAchievements.filter(a => !unlockedIds.includes(a.id) && !a.hidden);

      const totalPoints = playerAchievements.reduce((sum, a) => sum + a.points, 0);
      const maxPoints = allAchievements.reduce((sum, a) => sum + a.points, 0);
      const percentComplete = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;

      return {
        unlocked: unlocked.map(a => a.toObject()),
        locked: locked.map(a => a.toObject()),
        totalPoints,
        maxPoints,
        percentComplete: Math.round(percentComplete),
        unlockedCount: unlocked.length,
        totalCount: allAchievements.length
      };
    } catch (error) {
      logger.error('Failed to get achievement progress', {
        playerId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = AchievementService;
