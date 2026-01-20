/**
 * LEADERBOARD REPOSITORY INTERFACE
 * Repository pattern for leaderboard operations
 * @version 1.0.0
 */

class ILeaderboardRepository {
  /**
   * Submit score to leaderboard
   * @param {Object} scoreData - Score data
   * @param {number} scoreData.playerId - Player ID
   * @param {number} scoreData.score - Score value
   * @param {string} scoreData.leaderboardType - Type (daily, weekly, monthly, all_time)
   * @param {number} scoreData.levelReached - Level reached
   * @param {number} scoreData.waveReached - Wave reached
   * @param {number} scoreData.zombiesKilled - Zombies killed
   * @param {number} scoreData.playTimeSeconds - Play time
   * @param {number} [scoreData.sessionId] - Session ID
   * @returns {Promise<void>}
   */
  async submitScore(_scoreData) {
    throw new Error('Method not implemented');
  }

  /**
   * Get top scores for a leaderboard type
   * @param {string} leaderboardType - Type of leaderboard
   * @param {number} [limit=100] - Number of entries to return
   * @returns {Promise<Array>} Array of leaderboard entries with player info
   */
  async getTopScores(_leaderboardType, _limit = 100) {
    throw new Error('Method not implemented');
  }

  /**
   * Get player rank in leaderboard
   * @param {number} playerId - Player ID
   * @param {string} leaderboardType - Type of leaderboard
   * @returns {Promise<Object|null>} Rank info or null if not ranked
   */
  async getPlayerRank(_playerId, _leaderboardType) {
    throw new Error('Method not implemented');
  }

  /**
   * Get players around a specific rank
   * @param {number} rank - Center rank
   * @param {string} leaderboardType - Type of leaderboard
   * @param {number} [range=5] - Number of players above and below
   * @returns {Promise<Array>} Array of leaderboard entries
   */
  async getScoresAroundRank(_rank, _leaderboardType, _range = 5) {
    throw new Error('Method not implemented');
  }

  /**
   * Get players around a specific player
   * @param {number} playerId - Player ID
   * @param {string} leaderboardType - Type of leaderboard
   * @param {number} [range=5] - Number of players above and below
   * @returns {Promise<Array>} Array of leaderboard entries
   */
  async getScoresAroundPlayer(_playerId, _leaderboardType, _range = 5) {
    throw new Error('Method not implemented');
  }

  /**
   * Recalculate ranks for a leaderboard type
   * @param {string} leaderboardType - Type of leaderboard
   * @returns {Promise<void>}
   */
  async recalculateRanks(_leaderboardType) {
    throw new Error('Method not implemented');
  }

  /**
   * Archive old leaderboard entries
   * @param {number} daysToKeep - Number of days to keep
   * @returns {Promise<number>} Number of entries archived
   */
  async archiveOldEntries(_daysToKeep) {
    throw new Error('Method not implemented');
  }

  /**
   * Get current period timestamp for leaderboard type
   * @param {string} leaderboardType - Type of leaderboard
   * @returns {number} Period start timestamp
   */
  getPeriodStart(_leaderboardType) {
    throw new Error('Method not implemented');
  }
}

module.exports = ILeaderboardRepository;
