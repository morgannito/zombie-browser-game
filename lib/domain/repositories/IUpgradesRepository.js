/**
 * UPGRADES REPOSITORY INTERFACE
 * Domain layer - no implementation details
 */

class IUpgradesRepository {
  /**
   * Get upgrades for player
   * @param {string} playerId
   * @returns {Promise<PermanentUpgrades|null>}
   */
  async findByPlayerId(playerId) {
    throw new Error('Method not implemented');
  }

  /**
   * Create initial upgrades record
   * @param {PermanentUpgrades} upgrades
   * @returns {Promise<PermanentUpgrades>}
   */
  async create(upgrades) {
    throw new Error('Method not implemented');
  }

  /**
   * Update upgrades
   * @param {PermanentUpgrades} upgrades
   * @returns {Promise<PermanentUpgrades>}
   */
  async update(upgrades) {
    throw new Error('Method not implemented');
  }

  /**
   * Get or create upgrades for player
   * @param {string} playerId
   * @returns {Promise<PermanentUpgrades>}
   */
  async getOrCreate(playerId) {
    throw new Error('Method not implemented');
  }
}

module.exports = IUpgradesRepository;
