/**
 * GET LEADERBOARD USE CASE
 * Retrieves leaderboard entries with in-memory cache
 */

const logger = require('../../infrastructure/logging/Logger');

class GetLeaderboardUseCase {
  constructor(leaderboardRepository, cache = null) {
    this.leaderboardRepository = leaderboardRepository;
    this.cache = cache;
  }

  async execute({ limit = 10, playerId = null } = {}) {
    let entries, playerRank = null, playerBest = null;

    if (playerId) {
      [entries, playerBest, playerRank] = await Promise.all([
        this.leaderboardRepository.getByPlayer(playerId, limit),
        this.leaderboardRepository.getBestForPlayer(playerId),
        this.leaderboardRepository.getPlayerRank(playerId)
      ]);
      logger.debug('Leaderboard retrieved for player', { playerId, entries: entries.length, rank: playerRank });
    } else {
      const cached = this.cache?.get(limit);
      if (cached) {
        entries = cached;
        logger.debug('Leaderboard served from cache', { entries: entries.length });
      } else {
        entries = await this.leaderboardRepository.getTop(limit);
        this.cache?.set(entries);
        logger.debug('Global leaderboard retrieved', { entries: entries.length });
      }
    }

    return {
      entries: entries.map(e => e.toObject ? e.toObject() : e),
      playerRank,
      playerBest: playerBest ? playerBest.toObject() : null
    };
  }
}

module.exports = GetLeaderboardUseCase;
