/**
 * GET UPGRADES USE CASE
 * Retrieves player's permanent upgrades
 */

const logger = require('../../infrastructure/Logger');

class GetUpgradesUseCase {
  constructor(upgradesRepository) {
    this.upgradesRepository = upgradesRepository;
  }

  /**
   * Get player upgrades
   * @param {Object} data - { playerId }
   * @returns {Promise<Object>}
   */
  async execute({ playerId }) {
    if (!playerId) {
      throw new Error('Player ID required');
    }

    // Get or create upgrades
    const upgrades = await this.upgradesRepository.getOrCreate(playerId);

    logger.debug('Upgrades retrieved', {
      playerId,
      totalUpgrades: upgrades.getTotalUpgrades()
    });

    return {
      upgrades: upgrades.toObject(),
      levels: upgrades.getAllLevels(),
      totalPoints: upgrades.getTotalUpgrades()
    };
  }
}

module.exports = GetUpgradesUseCase;
