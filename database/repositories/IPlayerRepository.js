/**
 * PLAYER REPOSITORY INTERFACE
 * Repository pattern for player data access
 * @version 1.0.0
 */

class IPlayerRepository {
  /**
   * Create a new player
   * @param {Object} playerData - Player data
   * @param {string} playerData.nickname - Player nickname
   * @param {string} playerData.playerUuid - UUID for cross-session identification
   * @param {string} [playerData.email] - Optional email
   * @param {string} [playerData.passwordHash] - Optional password hash
   * @returns {Promise<Object>} Created player with id
   */
  async create(playerData) {
    throw new Error('Method not implemented');
  }

  /**
   * Find player by ID
   * @param {number} playerId - Player ID
   * @returns {Promise<Object|null>} Player object or null if not found
   */
  async findById(playerId) {
    throw new Error('Method not implemented');
  }

  /**
   * Find player by UUID
   * @param {string} playerUuid - Player UUID
   * @returns {Promise<Object|null>} Player object or null if not found
   */
  async findByUuid(playerUuid) {
    throw new Error('Method not implemented');
  }

  /**
   * Find player by nickname
   * @param {string} nickname - Player nickname
   * @returns {Promise<Object|null>} Player object or null if not found
   */
  async findByNickname(nickname) {
    throw new Error('Method not implemented');
  }

  /**
   * Check if nickname is available
   * @param {string} nickname - Nickname to check
   * @returns {Promise<boolean>} True if available
   */
  async isNicknameAvailable(nickname) {
    throw new Error('Method not implemented');
  }

  /**
   * Update player last login timestamp
   * @param {number} playerId - Player ID
   * @returns {Promise<void>}
   */
  async updateLastLogin(playerId) {
    throw new Error('Method not implemented');
  }

  /**
   * Get player with full stats
   * @param {number} playerId - Player ID
   * @returns {Promise<Object|null>} Player with stats or null
   */
  async getPlayerProfile(playerId) {
    throw new Error('Method not implemented');
  }

  /**
   * Get player stats
   * @param {number} playerId - Player ID
   * @returns {Promise<Object|null>} Player stats or null
   */
  async getStats(playerId) {
    throw new Error('Method not implemented');
  }

  /**
   * Update player stats (incremental)
   * @param {number} playerId - Player ID
   * @param {Object} updates - Stat updates (will be added to existing values)
   * @returns {Promise<void>}
   */
  async updateStats(playerId, updates) {
    throw new Error('Method not implemented');
  }

  /**
   * Get permanent upgrades for player
   * @param {number} playerId - Player ID
   * @returns {Promise<Object>} Map of upgrade_type to upgrade_level
   */
  async getPermanentUpgrades(playerId) {
    throw new Error('Method not implemented');
  }

  /**
   * Purchase permanent upgrade
   * @param {number} playerId - Player ID
   * @param {string} upgradeType - Type of upgrade
   * @param {number} cost - Gold cost
   * @returns {Promise<boolean>} True if successful
   */
  async purchaseUpgrade(playerId, upgradeType, cost) {
    throw new Error('Method not implemented');
  }

  /**
   * Get player unlocks (weapons, skins, etc)
   * @param {number} playerId - Player ID
   * @param {string} [unlockType] - Optional filter by type
   * @returns {Promise<Array>} Array of unlocks
   */
  async getUnlocks(playerId, unlockType = null) {
    throw new Error('Method not implemented');
  }

  /**
   * Add unlock for player
   * @param {number} playerId - Player ID
   * @param {string} unlockType - Type of unlock
   * @param {string} unlockId - ID of item to unlock
   * @param {number} price - Purchase price
   * @returns {Promise<void>}
   */
  async addUnlock(playerId, unlockType, unlockId, price) {
    throw new Error('Method not implemented');
  }

  /**
   * Ban player
   * @param {number} playerId - Player ID
   * @param {string} reason - Ban reason
   * @param {number|null} expiresAt - Unix timestamp or null for permanent
   * @returns {Promise<void>}
   */
  async banPlayer(playerId, reason, expiresAt = null) {
    throw new Error('Method not implemented');
  }

  /**
   * Check if player is banned
   * @param {number} playerId - Player ID
   * @returns {Promise<boolean>} True if banned
   */
  async isBanned(playerId) {
    throw new Error('Method not implemented');
  }
}

module.exports = IPlayerRepository;