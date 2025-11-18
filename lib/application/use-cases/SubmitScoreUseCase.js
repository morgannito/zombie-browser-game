/**
 * SUBMIT SCORE USE CASE
 * Submits a score to the leaderboard
 */

const LeaderboardEntry = require('../../domain/entities/LeaderboardEntry');
const logger = require('../../infrastructure/Logger');

class SubmitScoreUseCase {
  constructor(leaderboardRepository, playerRepository) {
    this.leaderboardRepository = leaderboardRepository;
    this.playerRepository = playerRepository;
  }

  /**
   * Submit score to leaderboard
   * @param {Object} data - { playerId, wave, level, kills, survivalTime }
   * @returns {Promise<LeaderboardEntry>}
   */
  async execute({ playerId, wave, level, kills, survivalTime }) {
    // Validate input
    if (!playerId || wave < 0 || level < 0 || kills < 0 || survivalTime < 0) {
      throw new Error('Invalid score data');
    }

    // Get player info
    const player = await this.playerRepository.findById(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Calculate score
    const score = LeaderboardEntry.calculateScore(wave, level, kills, survivalTime);

    // Create entry
    const entry = new LeaderboardEntry({
      playerId,
      playerUsername: player.username,
      wave,
      level,
      kills,
      survivalTime,
      score
    });

    // Submit to leaderboard
    await this.leaderboardRepository.submit(entry);

    logger.info('Score submitted to leaderboard', {
      playerId,
      username: player.username,
      wave,
      level,
      score
    });

    return entry;
  }
}

module.exports = SubmitScoreUseCase;
