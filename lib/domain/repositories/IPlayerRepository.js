/**
 * PLAYER REPOSITORY INTERFACE
 * Defines contract for player persistence
 * Domain layer - no implementation details
 */

class IPlayerRepository {
  /**
   * Find player by ID
   * @param {string} id
   * @returns {Promise<Player|null>}
   */
  async findById(_id) {
    throw new Error('Method not implemented');
  }

  /**
   * Find player by username
   * @param {string} username
   * @returns {Promise<Player|null>}
   */
  async findByUsername(_username) {
    throw new Error('Method not implemented');
  }

  /**
   * Create new player
   * @param {Player} player
   * @returns {Promise<Player>}
   */
  async create(_player) {
    throw new Error('Method not implemented');
  }

  /**
   * Update existing player
   * @param {Player} player
   * @returns {Promise<Player>}
   */
  async update(_player) {
    throw new Error('Method not implemented');
  }

  /**
   * Get top players by score
   * @param {number} limit
   * @returns {Promise<Player[]>}
   */
  async getTopPlayers(_limit = 10) {
    throw new Error('Method not implemented');
  }

  /**
   * Get player statistics
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getStats(_id) {
    throw new Error('Method not implemented');
  }
}

module.exports = IPlayerRepository;
