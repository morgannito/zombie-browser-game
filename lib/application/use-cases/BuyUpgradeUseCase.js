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
   * @param {Object} data - { playerId, upgradeName }
   * @returns {Promise<PermanentUpgrades>}
   */
  async execute({ playerId, upgradeName, maxLevel: customMaxLevel }) {
    // TODO: look up cost and maxLevel from server-side upgrade catalogue
    const maxLevel = customMaxLevel !== undefined ? customMaxLevel : 10;
    // Validate
    const validUpgrades = ['maxHealth', 'damage', 'speed', 'fireRate'];
    if (!validUpgrades.includes(upgradeName)) {
      throw new ValidationError(`Invalid upgrade name: ${upgradeName}`, 'upgradeName');
    }

    // Atomically get-or-create, validate, apply, and persist to prevent TOCTOU races
    let upgrades;
    if (typeof this.upgradesRepository.upgradeAtomic === 'function') {
      upgrades = this.upgradesRepository.upgradeAtomic(playerId, u => {
        if (u.isMaxLevel(upgradeName, maxLevel)) {
          throw new BusinessLogicError(`Upgrade ${upgradeName} already at max level`);
        }
        u.upgrade(upgradeName);
      });
    } else {
      // Fallback for repos without upgradeAtomic (e.g. test mocks)
      upgrades = await this.upgradesRepository.getOrCreate(playerId);
      if (upgrades.isMaxLevel(upgradeName, maxLevel)) {
        throw new BusinessLogicError(`Upgrade ${upgradeName} already at max level`);
      }
      upgrades.upgrade(upgradeName);
      await this.upgradesRepository.update(upgrades);
    }

    logger.info('Upgrade purchased', {
      playerId,
      upgrade: upgradeName,
      newLevel: upgrades.getLevel(upgradeName)
    });

    return upgrades;
  }
}

module.exports = BuyUpgradeUseCase;
