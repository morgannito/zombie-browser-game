/**
 * BUY UPGRADE USE CASE
 * Purchases a permanent upgrade for player
 */

const logger = require('../../infrastructure/Logger');

class BuyUpgradeUseCase {
  constructor(upgradesRepository) {
    this.upgradesRepository = upgradesRepository;
  }

  /**
   * Buy a permanent upgrade
   * @param {Object} data - { playerId, upgradeName, cost }
   * @returns {Promise<PermanentUpgrades>}
   */
  async execute({ playerId, upgradeName, cost, maxLevel = 10 }) {
    // Validate
    const validUpgrades = ['maxHealth', 'damage', 'speed', 'fireRate'];
    if (!validUpgrades.includes(upgradeName)) {
      throw new Error(`Invalid upgrade name: ${upgradeName}`);
    }

    // Get or create upgrades record
    const upgrades = await this.upgradesRepository.getOrCreate(playerId);

    // Check if already at max level
    if (upgrades.isMaxLevel(upgradeName, maxLevel)) {
      throw new Error(`Upgrade ${upgradeName} already at max level`);
    }

    // Apply upgrade
    upgrades.upgrade(upgradeName);

    // Persist
    await this.upgradesRepository.update(upgrades);

    logger.info('Upgrade purchased', {
      playerId,
      upgrade: upgradeName,
      newLevel: upgrades.getLevel(upgradeName),
      cost
    });

    return upgrades;
  }
}

module.exports = BuyUpgradeUseCase;
