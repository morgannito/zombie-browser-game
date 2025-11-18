/**
 * SESSION REPOSITORY INTERFACE
 * Repository pattern for game session management
 * @version 1.0.0
 */

class ISessionRepository {
  /**
   * Create a new game session
   * @param {Object} sessionData - Session data
   * @param {string} sessionData.sessionUuid - Session UUID
   * @param {number} sessionData.playerId - Player ID
   * @param {string} [sessionData.clientVersion] - Client version
   * @param {string} [sessionData.clientPlatform] - Client platform
   * @returns {Promise<Object>} Created session with id
   */
  async create(sessionData) {
    throw new Error('Method not implemented');
  }

  /**
   * End a game session
   * @param {number} sessionId - Session ID
   * @param {Object} endData - End game data
   * @param {string} endData.endReason - Reason for ending
   * @param {number} endData.finalLevel - Final level reached
   * @param {number} endData.finalWave - Final wave reached
   * @param {number} endData.finalScore - Final score
   * @param {number} endData.finalGold - Final gold
   * @param {number} endData.finalXp - Final XP
   * @param {number} endData.zombiesKilled - Zombies killed
   * @param {number} endData.highestCombo - Highest combo
   * @returns {Promise<void>}
   */
  async endSession(sessionId, endData) {
    throw new Error('Method not implemented');
  }

  /**
   * Save active session state for recovery
   * @param {number} sessionId - Session ID
   * @param {string} socketId - Socket ID
   * @param {Object} gameState - Serialized game state
   * @param {string} [roomId] - Room ID
   * @returns {Promise<void>}
   */
  async saveActiveSession(sessionId, socketId, gameState, roomId = null) {
    throw new Error('Method not implemented');
  }

  /**
   * Get active session for recovery
   * @param {number} playerId - Player ID
   * @returns {Promise<Object|null>} Active session or null
   */
  async getActiveSession(playerId) {
    throw new Error('Method not implemented');
  }

  /**
   * Update active session heartbeat
   * @param {number} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async updateHeartbeat(sessionId) {
    throw new Error('Method not implemented');
  }

  /**
   * Clean up stale active sessions
   * @param {number} timeoutSeconds - Timeout in seconds
   * @returns {Promise<number>} Number of sessions cleaned up
   */
  async cleanupStaleSessions(timeoutSeconds) {
    throw new Error('Method not implemented');
  }

  /**
   * Get player session history
   * @param {number} playerId - Player ID
   * @param {number} [limit=10] - Number of sessions to return
   * @returns {Promise<Array>} Array of sessions
   */
  async getPlayerSessions(playerId, limit = 10) {
    throw new Error('Method not implemented');
  }

  /**
   * Get session by UUID
   * @param {string} sessionUuid - Session UUID
   * @returns {Promise<Object|null>} Session or null
   */
  async findByUuid(sessionUuid) {
    throw new Error('Method not implemented');
  }

  /**
   * Get session statistics
   * @param {number} playerId - Player ID
   * @returns {Promise<Object>} Session statistics
   */
  async getSessionStats(playerId) {
    throw new Error('Method not implemented');
  }
}

module.exports = ISessionRepository;