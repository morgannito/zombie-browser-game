/**
 * UPDATE PLAYER STATS USE CASE
 * Updates player statistics after game session
 */

const logger = require('../../infrastructure/Logger');

class UpdatePlayerStatsUseCase {
  constructor(playerRepository) {
    this.playerRepository = playerRepository;
  }

  /**
   * Update player stats after session
   * @param {Object} data - { playerId, kills, deaths, wave, level, playtime, goldEarned }
   * @returns {Promise<Player>}
   */
  async execute({ playerId, kills, deaths, wave, level, playtime, goldEarned }) {
    // Find player
    const player = await this.playerRepository.findById(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    // Record if this is a new personal best
    const isNewRecord = player.isNewRecord(wave, level);

    // Update stats using domain logic
    player.updateStats({
      kills: kills || 0,
      deaths: deaths || 0,
      wave: wave || 0,
      level: level || 0,
      playtime: playtime || 0,
      goldEarned: goldEarned || 0
    });

    // Persist
    await this.playerRepository.update(player);

    logger.info('Player stats updated', {
      playerId,
      kills,
      deaths,
      wave,
      level,
      newRecord: isNewRecord
    });

    return player;
  }
}

module.exports = UpdatePlayerStatsUseCase;
