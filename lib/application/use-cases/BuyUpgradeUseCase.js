/**
 * BUY UPGRADE USE CASE
 * Purchases a permanent upgrade for player
 */

const logger = require('../../../infrastructure/logging/Logger');
const { ValidationError, BusinessLogicError } = require('../../domain/errors/DomainErrors');
const { getUpgradeDef, UPGRADE_CATALOG } = require('../upgradeCatalog');

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
    const def = getUpgradeDef(upgradeName);
    if (!def) {
      throw new ValidationError(`Invalid upgrade name: ${upgradeName}`, 'upgradeName');
    }
    const maxLevel = customMaxLevel !== undefined ? customMaxLevel : def.maxLevel;

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
