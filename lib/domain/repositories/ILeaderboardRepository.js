/**
 * LEADERBOARD REPOSITORY INTERFACE
 * Domain layer - no implementation details
 */

class ILeaderboardRepository {
  /**
   * Submit a new score to leaderboard
   * @param {LeaderboardEntry} entry
   * @returns {Promise<LeaderboardEntry>}
   */
  async submit(entry) {
    throw new Error('Method not implemented');
  }

  /**
   * Get top entries
   * @param {number} limit
   * @returns {Promise<LeaderboardEntry[]>}
   */
  async getTop(limit = 10) {
    throw new Error('Method not implemented');
  }

  /**
   * Get entries for specific player
   * @param {string} playerId
   * @param {number} limit
   * @returns {Promise<LeaderboardEntry[]>}
   */
  async getByPlayer(playerId, limit = 10) {
    throw new Error('Method not implemented');
  }

  /**
   * Get player's best score
   * @param {string} playerId
   * @returns {Promise<LeaderboardEntry|null>}
   */
  async getBestForPlayer(playerId) {
    throw new Error('Method not implemented');
  }

  /**
   * Get player's rank
   * @param {string} playerId
   * @returns {Promise<number|null>}
   */
  async getPlayerRank(playerId) {
    throw new Error('Method not implemented');
  }

  /**
   * Clean up old entries (keep top N)
   * @param {number} keepCount
   * @returns {Promise<number>}
   */
  async cleanup(keepCount = 1000) {
    throw new Error('Method not implemented');
  }
}

module.exports = ILeaderboardRepository;
