/**
 * GET LEADERBOARD USE CASE
 * Retrieves leaderboard entries
 */

const logger = require('../../infrastructure/Logger');

class GetLeaderboardUseCase {
  constructor(leaderboardRepository) {
    this.leaderboardRepository = leaderboardRepository;
  }

  /**
   * Get top entries from leaderboard
   * @param {Object} options - { limit, playerId }
   * @returns {Promise<Object>}
   */
  async execute({ limit = 10, playerId = null } = {}) {
    let entries;
    let playerRank = null;
    let playerBest = null;

    if (playerId) {
      // Get player-specific data
      entries = await this.leaderboardRepository.getByPlayer(playerId, limit);
      playerBest = await this.leaderboardRepository.getBestForPlayer(playerId);
      playerRank = await this.leaderboardRepository.getPlayerRank(playerId);

      logger.debug('Leaderboard retrieved for player', {
        playerId,
        entries: entries.length,
        rank: playerRank
      });
    } else {
      // Get global leaderboard
      entries = await this.leaderboardRepository.getTop(limit);

      logger.debug('Global leaderboard retrieved', { entries: entries.length });
    }

    return {
      entries: entries.map(e => e.toObject()),
      playerRank,
      playerBest: playerBest ? playerBest.toObject() : null
    };
  }
}

module.exports = GetLeaderboardUseCase;
