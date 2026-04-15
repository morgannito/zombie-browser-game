/**
 * BUY UPGRADE USE CASE
 * Purchases a permanent upgrade for player
 */

const logger = require('../../../infrastructure/logging/Logger');
const { ValidationError, BusinessLogicError } = require('../../domain/errors/DomainErrors');

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
      throw new ValidationError(`Invalid upgrade name: ${upgradeName}`, 'upgradeName');
    }

    // Get or create upgrades record
    const upgrades = await this.upgradesRepository.getOrCreate(playerId);

    // Check if already at max level
    if (upgrades.isMaxLevel(upgradeName, maxLevel)) {
      throw new BusinessLogicError(`Upgrade ${upgradeName} already at max level`);
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
