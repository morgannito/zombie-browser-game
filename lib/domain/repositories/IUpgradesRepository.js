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
  async findByPlayerId(_playerId) {
    throw new Error('Method not implemented');
  }

  /**
   * Create initial upgrades record
   * @param {PermanentUpgrades} upgrades
   * @returns {Promise<PermanentUpgrades>}
   */
  async create(_upgrades) {
    throw new Error('Method not implemented');
  }

  /**
   * Update upgrades
   * @param {PermanentUpgrades} upgrades
   * @returns {Promise<PermanentUpgrades>}
   */
  async update(_upgrades) {
    throw new Error('Method not implemented');
  }

  /**
   * Get or create upgrades for player
   * @param {string} playerId
   * @returns {Promise<PermanentUpgrades>}
   */
  async getOrCreate(_playerId) {
    throw new Error('Method not implemented');
  }
}

module.exports = IUpgradesRepository;
